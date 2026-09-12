import type { Db } from "./client";
import { scopeWhere } from "./meta";
import type { ScopeFilter } from "./types";
import { partyBalanceSumSql } from "@/lib/local-first/party-balance";
import {
  computeRunningBalances,
  computeBalanceFromDeltas,
  type RunningBalanceTxn,
} from "@/lib/local-first/running-balance";

export {
  computeRunningBalances,
  computeBalanceFromDeltas,
  type RunningBalanceTxn,
};

const paidClause = (alias = "") => {
  const col = alias ? `${alias}.payment_status` : "payment_status";
  return `(${col} = 'paid' OR ${col} IS NULL OR ${col} = '')`;
};

/** How many balance_after rows to rewrite per UPDATE (avoids N× prepareAsync). */
const TRAIL_UPDATE_BATCH = 80;

/**
 * Fast cash balance: opening + paid credits − paid debits (Mongo convention).
 * One query + one UPDATE — safe after migrate/sync with thousands of rows.
 */
export async function recalculateAccountCashBalance(
  db: Db,
  accountId: string,
): Promise<number> {
  const account = await db.getFirstAsync<{
    id: string;
    server_id: string | null;
    opening_balance: number;
  }>(
    `SELECT id, server_id, opening_balance FROM accounts
     WHERE (id = ? OR server_id = ?) AND deleted_at IS NULL LIMIT 1`,
    accountId,
    accountId,
  );
  if (!account) return 0;

  const serverId = account.server_id || account.id;
  const sum = await db.getFirstAsync<{
    paid_debit: number;
    paid_credit: number;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'debit' AND ${paidClause()} THEN amount ELSE 0 END), 0) as paid_debit,
       COALESCE(SUM(CASE WHEN type = 'credit' AND ${paidClause()} THEN amount ELSE 0 END), 0) as paid_credit
     FROM transactions
     WHERE deleted_at IS NULL
       AND (account_id = ? OR account_id = ?)`,
    account.id,
    serverId,
  );

  const finalBalance =
    Number(account.opening_balance) +
    Number(sum?.paid_credit ?? 0) -
    Number(sum?.paid_debit ?? 0);

  await db.runAsync(
    `UPDATE accounts SET current_balance = ? WHERE id = ?`,
    finalBalance,
    account.id,
  );
  return finalBalance;
}

/**
 * Rewrite every txn's balance_after_transaction in chronological order.
 *
 * Linear SELECT + computeRunningBalances + batched CASE UPDATEs.
 * Avoids both:
 * - N× prepareAsync (FunctionCallException on ~900+ txs)
 * - O(n²) correlated SQL that freezes Home/sync for minutes
 */
export async function recalculateAccountRunningBalances(
  db: Db,
  accountId: string,
): Promise<number> {
  const account = await db.getFirstAsync<{
    id: string;
    server_id: string | null;
    opening_balance: number;
  }>(
    `SELECT id, server_id, opening_balance FROM accounts
     WHERE (id = ? OR server_id = ?) AND deleted_at IS NULL LIMIT 1`,
    accountId,
    accountId,
  );
  if (!account) return 0;

  const serverId = account.server_id || account.id;
  const opening = Number(account.opening_balance) || 0;

  const rows = await db.getAllAsync<{
    id: string;
    type: string;
    amount: number;
    payment_status: string | null;
  }>(
    `SELECT id, type, amount, payment_status
     FROM transactions
     WHERE deleted_at IS NULL
       AND (account_id = ? OR account_id = ?)
     ORDER BY date ASC, created_at ASC, id ASC`,
    account.id,
    serverId,
  );

  const computed = computeRunningBalances(opening, rows);

  for (let i = 0; i < computed.length; i += TRAIL_UPDATE_BATCH) {
    const chunk = computed.slice(i, i + TRAIL_UPDATE_BATCH);
    if (!chunk.length) continue;
    const whenClauses = chunk.map(() => "WHEN ? THEN ?").join(" ");
    const params: Array<string | number> = [];
    for (const row of chunk) {
      params.push(row.id, row.balance_after);
    }
    for (const row of chunk) {
      params.push(row.id);
    }
    await db.runAsync(
      `UPDATE transactions
       SET balance_after_transaction = CASE id ${whenClauses} END
       WHERE id IN (${chunk.map(() => "?").join(",")})`,
      ...params,
    );
  }

  return recalculateAccountCashBalance(db, account.id);
}

/**
 * Cash + party balances only (no per-txn trail). Use on repair/first paint
 * when trails can finish in the background.
 */
export async function recalculateCashBalancesOnly(
  db: Db,
  scope?: ScopeFilter,
): Promise<{ accounts: number; parties: number }> {
  const { sql, params } = scopeWhere("", scope);

  const accounts = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM accounts WHERE ${sql} AND deleted_at IS NULL`,
    ...params,
  );

  for (const account of accounts) {
    await recalculateAccountCashBalance(db, account.id);
  }

  const parties = await db.getAllAsync<{
    id: string;
    server_id: string | null;
    opening_balance: number;
    type: string | null;
  }>(
    `SELECT id, server_id, opening_balance, type FROM parties WHERE ${sql} AND deleted_at IS NULL`,
    ...params,
  );

  for (const party of parties) {
    const serverId = party.server_id || party.id;
    const sign = partyBalanceSumSql(party.type, "amount", "type");
    const sum = await db.getFirstAsync<{ net: number | null }>(
      `SELECT COALESCE(SUM(${sign}), 0) as net
       FROM transactions
       WHERE deleted_at IS NULL
         AND ${paidClause()}
         AND (party_id = ? OR party_id = ?)`,
      party.id,
      serverId,
    );
    const current = Number(party.opening_balance) + Number(sum?.net ?? 0);
    await db.runAsync(
      `UPDATE parties SET current_balance = ? WHERE id = ?`,
      current,
      party.id,
    );
  }

  return { accounts: accounts.length, parties: parties.length };
}

/**
 * Recompute account + party cash balances. Also rewrites per-txn
 * balance_after with a linear batch UPDATE per account (no N-loop, no O(n²)).
 */
export async function recalculateBalances(
  db: Db,
  scope?: ScopeFilter,
): Promise<{ accounts: number; parties: number }> {
  const { sql, params } = scopeWhere("", scope);

  const accounts = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM accounts WHERE ${sql} AND deleted_at IS NULL`,
    ...params,
  );

  for (const account of accounts) {
    try {
      await recalculateAccountRunningBalances(db, account.id);
    } catch (e) {
      // Never abort the whole sync/repair on one account — fall back to cash only.
      console.warn(
        `[balances] trail rewrite failed for ${account.id}, cash-only fallback`,
        e,
      );
      await recalculateAccountCashBalance(db, account.id);
    }
  }

  const parties = await db.getAllAsync<{
    id: string;
    server_id: string | null;
    opening_balance: number;
    type: string | null;
  }>(
    `SELECT id, server_id, opening_balance, type FROM parties WHERE ${sql} AND deleted_at IS NULL`,
    ...params,
  );

  for (const party of parties) {
    const serverId = party.server_id || party.id;
    const sign = partyBalanceSumSql(party.type, "amount", "type");
    const sum = await db.getFirstAsync<{ net: number | null }>(
      `SELECT COALESCE(SUM(${sign}), 0) as net
       FROM transactions
       WHERE deleted_at IS NULL
         AND ${paidClause()}
         AND (party_id = ? OR party_id = ?)`,
      party.id,
      serverId,
    );
    const current = Number(party.opening_balance) + Number(sum?.net ?? 0);
    await db.runAsync(
      `UPDATE parties SET current_balance = ? WHERE id = ?`,
      current,
      party.id,
    );
  }

  return { accounts: accounts.length, parties: parties.length };
}
