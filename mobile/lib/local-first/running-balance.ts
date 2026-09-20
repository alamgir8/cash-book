/**
 * Pure chronological cash running balance (no DB / RN imports).
 * Matches wallet cash: paid moves the balance; due snapshots without moving
 * (same as Mongo $inc rules). Open dues are obligations, not cash yet.
 *
 * THIS IS THE AUTHORITATIVE RULE for the displayed "Balance after".
 *
 * There are two implementations of this walk — this ascending one, and the
 * backend's descending `recomputeDescendingBalances`. They must agree, and this
 * one wins for what a device shows:
 *
 *  - Ascending here, seeded from `opening_balance`, newest last.
 *  - Descending on the server, seeded from `current_balance`, newest first.
 *
 * They disagreed about dues: the server unwound them (shifting every older
 * row's balance) while this walk deliberately skips them, because a due never
 * moved cash and `current_balance` is itself derived from paid rows only. That
 * made the same row show a different value before and after a sync. Fixes on
 * both sides, so they now agree:
 *
 *  - The server no longer unwinds due rows (`backend/utils/balance.js`).
 *  - `upsertTransactionFromSync` keeps the local value when one exists, so a
 *    payload can never overwrite the on-device trail.
 *  - After a pull, `sync/engine.ts` re-derives the trail for every account the
 *    pull touched.
 */

export type RunningBalanceTxn = {
  id: string;
  type: "debit" | "credit" | string;
  amount: number;
  payment_status?: string | null;
};

export function computeRunningBalances(
  opening: number,
  txns: RunningBalanceTxn[],
): Array<{ id: string; balance_after: number }> {
  let running = Number(opening) || 0;
  const out: Array<{ id: string; balance_after: number }> = [];
  for (const txn of txns) {
    // Due roots (open or settled) stay payment_status='due' — snapshot only.
    const status = txn.payment_status || "paid";
    if (status !== "due") {
      const amt = Number(txn.amount) || 0;
      running += txn.type === "credit" ? amt : -amt;
    }
    out.push({ id: txn.id, balance_after: running });
  }
  return out;
}

export function computeBalanceFromDeltas(
  opening: number,
  deltas: Array<{ type: "debit" | "credit"; amount: number }>,
): number {
  return deltas.reduce((bal, d) => {
    return d.type === "credit" ? bal + d.amount : bal - d.amount;
  }, opening);
}
