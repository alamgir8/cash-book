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

/**
 * Rewrite `balance_after_transaction` for every txn on an account (date order)
 * and set `accounts.current_balance` to the final running total.
 *
 * Fixes offline creates that used a drifted `current_balance` while older rows
 * still showed the chronological trail from migrate/sync.
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
  const rows = await db.getAllAsync<RunningBalanceTxn>(
    `SELECT id, type, amount, payment_status FROM transactions
     WHERE deleted_at IS NULL
       AND (account_id = ? OR account_id = ?)
     ORDER BY date ASC, created_at ASC, id ASC`,
    account.id,
    serverId,
  );

  const computed = computeRunningBalances(
    Number(account.opening_balance) || 0,
    rows,
  );
  for (const row of computed) {
    await db.runAsync(
      `UPDATE transactions SET balance_after_transaction = ? WHERE id = ?`,
      row.balance_after,
      row.id,
    );
  }

  const finalBalance =
    computed.length > 0
      ? computed[computed.length - 1].balance_after
      : Number(account.opening_balance) || 0;

  await db.runAsync(
    `UPDATE accounts SET current_balance = ? WHERE id = ?`,
    finalBalance,
    account.id,
  );
  return finalBalance;
}

/**
 * Recompute account + party balances from opening + paid transactions.
 * Account path also rewrites per-txn balance_after so the UI trail stays correct.
 * Call after restore and after sync apply.
 */
export async function recalculateBalances(
  db: Db,
  scope?: ScopeFilter,
): Promise<{ accounts: number; parties: number }> {
  const { sql, params } = scopeWhere("", scope);

  const accounts = await db.getAllAsync<{
    id: string;
  }>(
    `SELECT id FROM accounts WHERE ${sql} AND deleted_at IS NULL`,
    ...params,
  );

  for (const account of accounts) {
    await recalculateAccountRunningBalances(db, account.id);
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
    // Type-aware sign: customers are credit-positive, suppliers debit-positive.
    // Matches the backend `partyBalanceDelta` convention (Phase 7).
    const sign = partyBalanceSumSql(party.type, "amount", "type");
    // Match local UUID or Mongo server id stored on the txn (migrate/dual-write).
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
