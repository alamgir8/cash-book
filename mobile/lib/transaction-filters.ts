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
  ref:
    | Transaction["party"]
    | Transaction["for_party"]
    | string
    | null
    | undefined,
): string | undefined => {
  if (!ref) return undefined;
  if (typeof ref === "string") return ref;
  const id = ref._id;
  return id != null ? String(id) : undefined;
};

export const getPartyRefName = (
  ref:
    | Transaction["party"]
    | Transaction["for_party"]
    | string
    | null
    | undefined,
): string | undefined => {
  if (!ref) return undefined;
  if (typeof ref === "string") return ref.trim() || undefined;
  return ref.name?.trim() || undefined;
};

export const getCategoryRefId = (
  category: Transaction["category"] | string | null | undefined,
): string | undefined => {
  if (!category) return undefined;
  if (typeof category === "string") return category;
  const id = category._id;
  return id != null ? String(id) : undefined;
};

export const getCategoryRefName = (
  category: Transaction["category"] | string | null | undefined,
): string | undefined => {
  if (!category) return undefined;
  if (typeof category === "string") return category.trim() || undefined;
  return category.name?.trim() || undefined;
};

/**
 * Normalize party names for comparison — mirrors backend loosePartyNameKey.
 */
export const loosePartyNameKey = (name = "") =>
  String(name)
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u09BE-\u09CC\u09D7]/g, "")
    .replace(/\u09BC/g, "");

export const looseCategoryNameKey = (name = "") =>
  String(name)
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ");

/** Dimension filters — only one chip dimension should be active at a time. */
export const CHIP_DIMENSION_KEYS = [
  "categoryId",
  "category_name",
  "counterparty",
  "party_id",
  "party_name",
  "for_party_id",
  "for_party_name",
] as const;

export type ChipFilterType =
  | "category"
  | "counterparty"
  | "vendor"
  | "for"
  | "payment_status";

/** Apply a chip tap: clear other dimension filters, set the selected one. */
export function applyChipFilter(
  prev: TransactionFilters,
  type: ChipFilterType,
  value?: string,
): TransactionFilters {
  const next: TransactionFilters = { ...prev, page: 1 };

  for (const key of CHIP_DIMENSION_KEYS) {
    delete next[key];
  }

  switch (type) {
    case "category":
      if (value) next.category_name = value;
      break;
    case "counterparty":
      if (value) next.counterparty = value;
      break;
    case "vendor":
      if (value) next.party_name = value;
      break;
    case "for":
      if (value) next.for_party_name = value;
      break;
    case "payment_status":
      next.loan_filter = undefined;
      if (value === "paid" || value === "due") {
        next.payment_status = value;
      } else {
        delete next.payment_status;
      }
      break;
  }

  return next;
}

/**
 * Merge filter panel changes onto previous filters.
 * Empty/falsy dimension values explicitly clear those keys.
 */
export function mergeTransactionFilters(
  prev: TransactionFilters,
  patch: Partial<TransactionFilters> & { searchInput?: string },
): TransactionFilters {
  const { searchInput, ...rest } = patch;
  const next: TransactionFilters = {
    ...prev,
    ...rest,
    page: 1,
  };

  if (searchInput !== undefined) {
    const trimmed = searchInput.trim();
    if (trimmed) next.search = trimmed;
    else delete next.search;
  }

  for (const key of CHIP_DIMENSION_KEYS) {
    const val = patch[key];
    if (val === undefined || val === null || val === "") {
      if (key in patch) delete next[key];
    }
  }

  if ("payment_status" in patch && !patch.payment_status) {
    delete next.payment_status;
  }
  if ("loan_filter" in patch && !patch.loan_filter) {
    delete next.loan_filter;
  }

  return next;
}

/** Client-side guard so lists match active filters even if cache is stale. */
export const filterTransactionsByActiveFilters = (
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] => {
  let result = transactions;

  if (filters.category_name) {
    const target = looseCategoryNameKey(filters.category_name);
    result = result.filter(
      (txn) => looseCategoryNameKey(getCategoryRefName(txn.category) ?? "") === target,
    );
  } else if (filters.categoryId) {
    const target = String(filters.categoryId);
    result = result.filter((txn) => getCategoryRefId(txn.category) === target);
  }

  if (filters.counterparty) {
    const target = filters.counterparty.trim().toLowerCase();
    result = result.filter(
      (txn) => txn.counterparty?.trim().toLowerCase() === target,
    );
  }

  if (filters.for_party_name) {
    const target = loosePartyNameKey(filters.for_party_name);
    result = result.filter(
      (txn) => loosePartyNameKey(getPartyRefName(txn.for_party) ?? "") === target,
    );
  } else if (filters.for_party_id) {
    const target = String(filters.for_party_id);
    result = result.filter(
      (txn) => getPartyRefId(txn.for_party) === target,
    );
  }

  if (filters.party_name) {
    const target = loosePartyNameKey(filters.party_name);
    result = result.filter(
      (txn) => loosePartyNameKey(getPartyRefName(txn.party) ?? "") === target,
    );
  } else if (filters.party_id) {
    const target = String(filters.party_id);
    result = result.filter((txn) => getPartyRefId(txn.party) === target);
  }

  if (filters.payment_status) {
    result = result.filter((txn) => {
      const status = txn.payment_status ?? "paid";
      return status === filters.payment_status;
    });
  }

  return result;
};

/** @deprecated Use filterTransactionsByActiveFilters */
export const filterTransactionsByPartyFilters = filterTransactionsByActiveFilters;
