import type { Db } from "./client";
import { scopeWhere } from "./meta";
import type { ScopeFilter } from "./types";

/**
 * Recompute account + party balances from opening + paid transactions.
 * Call after restore and after sync apply.
 */
export async function recalculateBalances(
  db: Db,
  scope?: ScopeFilter,
): Promise<{ accounts: number; parties: number }> {
  const { sql, params } = scopeWhere("", scope);

  const accounts = await db.getAllAsync<{ id: string; opening_balance: number }>(
    `SELECT id, opening_balance FROM accounts WHERE ${sql} AND deleted_at IS NULL`,
    ...params,
  );

  for (const account of accounts) {
    const full = await db.getFirstAsync<{ id: string; server_id: string | null }>(
      `SELECT id, server_id FROM accounts WHERE id = ?`,
      account.id,
    );
    const sum = await db.getFirstAsync<{ net: number | null }>(
      `SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as net
       FROM transactions
       WHERE (account_id = ? OR account_id = ?)
         AND deleted_at IS NULL
         AND (payment_status = 'paid' OR payment_status IS NULL OR payment_status = '')`,
      account.id,
      full?.server_id ?? account.id,
    );
    const current = Number(account.opening_balance) + Number(sum?.net ?? 0);
    await db.runAsync(
      `UPDATE accounts SET current_balance = ? WHERE id = ?`,
      current,
      account.id,
    );
  }

  const parties = await db.getAllAsync<{ id: string; opening_balance: number }>(
    `SELECT id, opening_balance FROM parties WHERE ${sql} AND deleted_at IS NULL`,
    ...params,
  );

  for (const party of parties) {
    const sum = await db.getFirstAsync<{ net: number | null }>(
      `SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) as net
       FROM transactions
       WHERE party_id = ?
         AND deleted_at IS NULL
         AND (payment_status = 'paid' OR payment_status IS NULL OR payment_status = '')`,
      party.id,
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
