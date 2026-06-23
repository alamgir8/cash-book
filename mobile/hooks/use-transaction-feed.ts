import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAccountTransactions } from "@/services/accounts";
import {
  fetchTransactions,
  fetchCounterparties,
  fetchVendors,
  type TransactionFilters,
} from "@/services/transactions";
import { fetchCategories } from "@/services/categories";
import { fetchAccounts } from "@/services/accounts";
import { queryKeys } from "@/lib/queryKeys";
import { useTransactionListState } from "@/hooks/use-transaction-list-state";
import { useTransactionFilterOptions } from "@/hooks/use-transaction-filter-options";
import { usePreferences } from "@/hooks/use-preferences";

export type TransactionFeedConfig = {
  /** When set, only transactions for this account are loaded. */
  accountId?: string;
  pageLimit?: number;
  initialFilters?: Partial<TransactionFilters>;
  editingCounterparty?: string;
  includeEmptyCategoryOption?: boolean;
  /** When false, skips the transactions query (e.g. missing route param). */
  enabled?: boolean;
};

const buildDefaultFilters = (
  accountId: string | undefined,
  pageLimit: number,
  initial?: Partial<TransactionFilters>,
): TransactionFilters => ({
  page: 1,
  limit: pageLimit,
  ...(accountId ? { accountId } : {}),
  ...initial,
});

export function hasActiveTransactionFilters(
  filters: TransactionFilters,
  defaults: TransactionFilters,
) {
  if (filters.range && filters.range !== defaults.range) return true;
  const keys: (keyof TransactionFilters)[] = [
    "accountId",
    "categoryId",
    "category_name",
    "counterparty",
    "party_id",
    "party_name",
    "for_party_id",
    "for_party_name",
    "payment_status",
    "loan_filter",
    "financialScope",
    "type",
    "search",
    "accountName",
    "startDate",
    "endDate",
    "from",
    "to",
    "minAmount",
    "maxAmount",
    "includeDeleted",
  ];
  return keys.some((key) => {
    const val = filters[key];
    const def = defaults[key];
    if (typeof val === "number") return val !== undefined && val !== def;
    if (typeof val === "boolean") return val !== undefined && val !== def;
    return val !== undefined && val !== "" && val !== def;
  });
}

/**
 * Shared data layer for Home, Ledger, and Account transaction lists.
 * Owns filters, queries, filter options, pagination, and chip-filter handlers.
 */
export function useTransactionFeed({
  accountId,
  pageLimit,
  initialFilters,
  editingCounterparty,
  includeEmptyCategoryOption = false,
  enabled = true,
}: TransactionFeedConfig) {
  const { formatAmount, preferences } = usePreferences();
  const language = preferences.language ?? "en";
  const resolvedLimit = pageLimit ?? (accountId ? 50 : 20);

  const defaultFilters = useMemo(
    () => buildDefaultFilters(accountId, resolvedLimit, initialFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountId, resolvedLimit],
  );

  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters);

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccounts,
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => fetchCategories(),
  });

  const counterpartiesQuery = useQuery({
    queryKey: queryKeys.counterparties,
    queryFn: () => fetchCounterparties(),
  });

  const vendorsQuery = useQuery({
    queryKey: queryKeys.vendors,
    queryFn: () => fetchVendors(),
  });

  const transactionsQuery = useQuery({
    queryKey: accountId
      ? queryKeys.accountTransactions(accountId, filters)
      : queryKeys.transactions(filters),
    queryFn: () =>
      accountId
        ? fetchAccountTransactions(accountId, filters)
        : fetchTransactions(filters),
    enabled:
      enabled && (accountId !== undefined ? Boolean(accountId) : true),
  });

  const listState = useTransactionListState(
    filters,
    setFilters,
    {
      data: transactionsQuery.data,
      isPending: transactionsQuery.isPending,
      isFetching: transactionsQuery.isFetching,
    },
    {
      defaultLimit: resolvedLimit,
      preserveKeys: accountId ? ["accountId"] : [],
    },
  );

  const filterOptions = useTransactionFilterOptions({
    language,
    rawTransactions: listState.rawTransactions,
    editingCounterparty,
    categoriesQuery,
    counterpartiesQuery,
    vendorsQuery,
    accountsQuery,
    formatAmount,
    includeEmptyCategoryOption,
  });

  const hasActiveFilters = useMemo(
    () => hasActiveTransactionFilters(filters, defaultFilters),
    [filters, defaultFilters],
  );

  const totalTransactionCount =
    transactionsQuery.data?.pagination?.total ??
    listState.allTransactions.length;

  const handleResetFilters = useCallback(() => {
    listState.resetToFilters(defaultFilters);
  }, [listState, defaultFilters]);

  const handleApplyFilters = useCallback(() => {
    listState.resetToPageOne();
    void transactionsQuery.refetch();
  }, [listState, transactionsQuery]);

  return {
    accountId,
    filters,
    setFilters,
    defaultFilters,
    transactionsQuery,
    accountsQuery,
    categoriesQuery,
    hasActiveFilters,
    totalTransactionCount,
    ...listState,
    ...filterOptions,
    handleResetFilters,
    handleApplyFilters,
  };
}
