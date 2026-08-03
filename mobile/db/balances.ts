import type { Db } from "./client";
import { scopeWhere } from "./meta";
import type { ScopeFilter } from "./types";

const paidClause = (alias = "") => {
  const col = alias ? `${alias}.payment_status` : "payment_status";
  return `(${col} = 'paid' OR ${col} IS NULL OR ${col} = '')`;
};

/**
 * Recompute account + party balances from opening + paid transactions.
 * Call after restore and after sync apply.
 */
export async function recalculateBalances(
  db: Db,
  scope?: ScopeFilter,
): Promise<{ accounts: number; parties: number }> {
  const { sql, params } = scopeWhere("", scope);

  const accounts = await db.getAllAsync<{
    id: string;
    server_id: string | null;
    opening_balance: number;
  }>(
    `SELECT id, server_id, opening_balance FROM accounts WHERE ${sql} AND deleted_at IS NULL`,
    ...params,
  );

  for (const account of accounts) {
    const serverId = account.server_id || account.id;
    // Keep cash math on the same org scope as the account list (plus legacy
    // NULL-org orphans when includePersonal is set).
    const txnScope = scopeWhere("t", scope);
    const sum = await db.getFirstAsync<{ net: number | null }>(
      `SELECT COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE -t.amount END), 0) as net
       FROM transactions t
       WHERE t.deleted_at IS NULL
         AND ${paidClause("t")}
         AND ${txnScope.sql}
         AND (t.account_id = ? OR t.account_id = ?)`,
      ...txnScope.params,
      account.id,
      serverId,
    );
    const current = Number(account.opening_balance) + Number(sum?.net ?? 0);
    await db.runAsync(
      `UPDATE accounts SET current_balance = ? WHERE id = ?`,
      current,
      account.id,
    );
  }

  const parties = await db.getAllAsync<{
    id: string;
    server_id: string | null;
    opening_balance: number;
  }>(
    `SELECT id, server_id, opening_balance FROM parties WHERE ${sql} AND deleted_at IS NULL`,
    ...params,
  );

  for (const party of parties) {
    const serverId = party.server_id || party.id;
    // Match local UUID or Mongo server id stored on the txn (migrate/dual-write).
    const sum = await db.getFirstAsync<{ net: number | null }>(
      `SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as net
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

/** Pure helper for tests — compute balance from opening + deltas. */
export function computeBalanceFromDeltas(
  opening: number,
  deltas: Array<{ type: "debit" | "credit"; amount: number }>,
): number {
  return deltas.reduce((bal, d) => {
    return d.type === "credit" ? bal + d.amount : bal - d.amount;
  }, opening);
}
