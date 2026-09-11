/**
 * Party balance sign convention — single source of truth, mirroring the backend
 * (`backend/controllers/sync.controller.js` → `partyBalanceDelta`).
 *
 * Cash-book convention (see `backend/models/Party.js`):
 *   customer → credit increases balance (receivable)
 *   supplier / both → debit increases balance (payable)
 *
 * Historically the local ledger used `credit` = + for every party, which made
 * on-device supplier balances diverge from the server after sync. Phase 7 fixes
 * that by routing every party delta through this helper.
 */
export type PartyTypeLike =
  | "customer"
  | "supplier"
  | "both"
  | string
  | null
  | undefined;

export type TxnType = "debit" | "credit";

const isCustomerType = (partyType: PartyTypeLike): boolean =>
  !partyType || partyType === "customer";

/** True when credit increases the balance (customers). Suppliers invert. */
export function isCustomerPartyType(partyType: PartyTypeLike): boolean {
  return isCustomerType(partyType);
}

/** Net signed balance from aggregated credit/debit totals. */
export function partyNetFromTotals(
  partyType: PartyTypeLike,
  totalCredit: number,
  totalDebit: number,
): number {
  const c = Number(totalCredit) || 0;
  const d = Number(totalDebit) || 0;
  return isCustomerType(partyType) ? c - d : d - c;
}

/** Signed delta applied to `parties.current_balance`. Dues are skipped. */
export function partySignedDelta(
  partyType: PartyTypeLike,
  txnType: TxnType,
  amount: number,
  paymentStatus?: "paid" | "due" | string | null,
): number {
  if (paymentStatus === "due") return 0;
  const n = Number(amount) || 0;
  if (isCustomerType(partyType)) {
    return txnType === "credit" ? n : -n;
  }
  return txnType === "debit" ? n : -n;
}

/**
 * SQL fragment used when recomputing a party balance from its paid
 * transactions. `alias` is the transactions table alias (optional).
 */
export function partyBalanceSumSql(
  partyType: PartyTypeLike,
  amountColumn = "amount",
  typeColumn = "type",
): string {
  const op = isCustomerType(partyType) ? "credit" : "debit";
  return `CASE WHEN ${typeColumn} = '${op}' THEN ${amountColumn} ELSE -${amountColumn} END`;
}
