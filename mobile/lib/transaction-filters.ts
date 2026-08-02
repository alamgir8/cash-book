import type { Transaction, TransactionFilters } from "@/services/transactions";
import {
  isLoanCategoryType,
  isLoanGivenRoot,
  isLoanReceivedRoot,
} from "@/lib/loan-utils";

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

  // Explicit undefined/null/"" in patch clears keys (spread alone keeps old values).
  const clearable: (keyof TransactionFilters)[] = [
    ...CHIP_DIMENSION_KEYS,
    "payment_status",
    "loan_filter",
    "range",
    "startDate",
    "endDate",
    "from",
    "to",
    "type",
    "search",
    "q",
    "accountId",
    "accountName",
    "minAmount",
    "maxAmount",
  ];
  for (const key of clearable) {
    if (!(key in patch)) continue;
    const val = patch[key];
    if (val === undefined || val === null || val === "") {
      delete next[key];
    }
  }

  if (patch.payment_status) {
    delete next.loan_filter;
  }
  if (patch.loan_filter) {
    delete next.payment_status;
  }
  // Range vs calendar dates are mutually exclusive.
  if (patch.range) {
    delete next.startDate;
    delete next.endDate;
    delete next.from;
    delete next.to;
  }
  if (
    patch.startDate ||
    patch.endDate ||
    patch.from ||
    patch.to ||
    ("startDate" in patch && !patch.startDate && !patch.range)
  ) {
    if (patch.startDate || patch.endDate || patch.from || patch.to) {
      delete next.range;
    }
  }

  return next;
}

/** Client-side guard so lists match active filters even if cache is stale. */
export const filterTransactionsByActiveFilters = (
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] => {
  let result = transactions;

  const from = filters.from ?? filters.startDate;
  const to = filters.to ?? filters.endDate;
  if (from || to || filters.range) {
    // Soft client guard — SQL already applies bounds for local-first.
    const start = from ? new Date(from).getTime() : null;
    const end = to ? new Date(to).getTime() : null;
    if (start != null && !Number.isNaN(start)) {
      result = result.filter((txn) => new Date(txn.date).getTime() >= start);
    }
    if (end != null && !Number.isNaN(end)) {
      const endOfDay = end + 24 * 60 * 60 * 1000 - 1;
      result = result.filter((txn) => new Date(txn.date).getTime() <= endOfDay);
    }
  }

  if (filters.type === "debit" || filters.type === "credit") {
    result = result.filter((txn) => txn.type === filters.type);
  }

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
      (txn) =>
        loosePartyNameKey(getPartyRefName(txn.party) ?? "") === target ||
        loosePartyNameKey(txn.vendor ?? "") === target ||
        loosePartyNameKey(txn.counterparty ?? "") === target,
    );
  } else if (filters.party_id) {
    const target = String(filters.party_id);
    result = result.filter((txn) => getPartyRefId(txn.party) === target);
  }

  if (filters.payment_status) {
    result = result.filter((txn) => {
      const status = txn.payment_status ?? "paid";
      if (status !== filters.payment_status) return false;
      if (filters.payment_status === "due" && !filters.loan_filter) {
        return !isLoanCategoryType(txn.category?.type);
      }
      return true;
    });
  }

  if (filters.loan_filter === "loan_given") {
    result = result.filter(
      (txn) =>
        isLoanGivenRoot(txn) &&
        !!txn.loan_summary &&
        !txn.loan_summary.is_settled &&
        (txn.loan_summary.owed_by_them ?? 0) > 0,
    );
  } else if (filters.loan_filter === "loan_received") {
    result = result.filter(
      (txn) =>
        isLoanReceivedRoot(txn) &&
        !!txn.loan_summary &&
        !txn.loan_summary.is_settled &&
        (txn.loan_summary.owed_by_me ?? 0) > 0,
    );
  }

  return result;
};

/** @deprecated Use filterTransactionsByActiveFilters */
export const filterTransactionsByPartyFilters = filterTransactionsByActiveFilters;
