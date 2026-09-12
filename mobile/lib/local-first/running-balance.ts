/**
 * Pure chronological cash running balance (no DB / RN imports).
 * Matches backend create rules: paid moves cash; due snapshots without moving.
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
