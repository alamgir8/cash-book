import type { Transaction, TransactionFilters } from "@/services/transactions";

/** Stable filter object for React Query keys (drops empty values). */
export const serializeTransactionFilters = (
  filters: TransactionFilters,
): Record<string, string | number | boolean> => {
  const serialized: Record<string, string | number | boolean> = {};
  const entries = Object.entries(filters).sort(([a], [b]) => a.localeCompare(b));

  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === "") continue;
    serialized[key] = value;
  }

  return serialized;
};

export const getPartyRefId = (
  ref: Transaction["party"] | Transaction["for_party"] | string | null | undefined,
): string | undefined => {
  if (!ref) return undefined;
  if (typeof ref === "string") return ref;
  const id = ref._id;
  return id != null ? String(id) : undefined;
};

/** Client-side guard when server-side party filters are active. */
export const filterTransactionsByPartyFilters = (
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] => {
  if (filters.for_party_id) {
    const target = String(filters.for_party_id);
    return transactions.filter(
      (txn) => getPartyRefId(txn.for_party) === target,
    );
  }

  if (filters.party_id) {
    const target = String(filters.party_id);
    return transactions.filter((txn) => getPartyRefId(txn.party) === target);
  }

  return transactions;
};
