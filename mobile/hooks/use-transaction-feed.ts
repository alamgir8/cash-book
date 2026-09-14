import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import {
  type TransactionFilters,
} from "@/services/transactions";
import {
  dalFetchAccounts,
  dalFetchAccountTransactions,
} from "@/data/accounts";
import {
  dalFetchBookTransactionCount,
  dalFetchTransactionTotals,
  dalFetchTransactions,
} from "@/data/transactions";
import { dalFetchCategories } from "@/data/categories";
import { dalFetchCounterparties, dalFetchVendors } from "@/data/parties";
import { queryKeys } from "@/lib/queryKeys";
import { useTransactionListState } from "@/hooks/use-transaction-list-state";
import { useTransactionFilterOptions } from "@/hooks/use-transaction-filter-options";
import { usePreferences } from "@/hooks/use-preferences";
import { useActiveOrgId } from "@/hooks/use-organization";
import { useLocalFirstFlags } from "@/hooks/use-local-first-flags";
import { serializeTransactionFilters } from "@/lib/transaction-filters";

/** Default page sizes — keep first paint light; filtered lists load more. */
export const FEED_PAGE_LIMIT = 30;
export const ACCOUNT_FEED_PAGE_LIMIT = 30;
/** When any chip / panel filter is active, load a wide page so SQL results aren't truncated. */
export const FILTERED_FEED_PAGE_LIMIT = 2000;

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
  organizationId: string | null | undefined,
  initial?: Partial<TransactionFilters>,
): TransactionFilters => ({
  page: 1,
  limit: pageLimit,
  ...(accountId ? { accountId } : {}),
  // Local-first never scopes personal ledger lists by org (SQLite personal only).
  ...(organizationId ? { organizationId } : {}),
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
  const activeOrgId = useActiveOrgId();
  const { localFirstEnabled, ready: flagsReady } = useLocalFirstFlags();
  // Local-first still respects org vs personal — both live in SQLite.
  const organizationId = activeOrgId;
  const { formatAmount, preferences } = usePreferences();
  const language = preferences.language ?? "en";
  const resolvedLimit =
    pageLimit ?? (accountId ? ACCOUNT_FEED_PAGE_LIMIT : FEED_PAGE_LIMIT);
  const orgKey = localFirstEnabled
    ? `local:${activeOrgId ?? "personal"}`
    : activeOrgId ?? "personal";

  const defaultFilters = useMemo(
    () =>
      buildDefaultFilters(
        accountId,
        resolvedLimit,
        organizationId,
        initialFilters,
      ),
    [accountId, resolvedLimit, organizationId, initialFilters],
  );

  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters);

  // Keep filters scoped when switching org / personal / local-first mode
  useEffect(() => {
    setFilters(defaultFilters);
  }, [defaultFilters]);

  // Shared filter metadata — long staleTime so dual Home+Ledger mounts don't double-fetch
  const accountsQuery = useQuery({
    queryKey: [...queryKeys.accounts, orgKey],
    queryFn: () => dalFetchAccounts(organizationId || undefined),
    staleTime: 5 * 60_000,
    enabled: flagsReady && enabled,
  });

  const categoriesQuery = useQuery({
    queryKey: [...queryKeys.categories.all, orgKey],
    queryFn: () =>
      dalFetchCategories({ organizationId: organizationId || undefined }),
    staleTime: 5 * 60_000,
    enabled: flagsReady && enabled,
  });

  const counterpartiesQuery = useQuery({
    queryKey: [...queryKeys.counterparties, orgKey],
    queryFn: () => dalFetchCounterparties(undefined, organizationId || undefined),
    staleTime: 5 * 60_000,
    enabled: flagsReady && enabled,
  });

  const vendorsQuery = useQuery({
    queryKey: [...queryKeys.vendors, orgKey],
    queryFn: () => dalFetchVendors(undefined, organizationId || undefined),
    staleTime: 5 * 60_000,
    enabled: flagsReady && enabled,
  });

  const transactionsQuery = useQuery({
    queryKey: accountId
      ? queryKeys.accountTransactions(accountId, filters)
      : queryKeys.transactions(filters),
    queryFn: () =>
      accountId
        ? dalFetchAccountTransactions(accountId, filters)
        : dalFetchTransactions(filters),
    enabled:
      flagsReady &&
      enabled &&
      (accountId !== undefined ? Boolean(accountId) : true),
    staleTime: 45_000,
    // After migrate/sync, remounting Home/Ledger must not keep a thin cache.
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
  });

  // Full-ledger debit/credit for StatsCards — same filters as the list (no page).
  const totalsQuery = useQuery({
    queryKey: [
      "transaction-totals",
      orgKey,
      accountId ?? "all",
      serializeTransactionFilters({ ...filters, page: undefined }),
    ],
    queryFn: () =>
      dalFetchTransactionTotals({
        ...filters,
        page: undefined,
        limit: undefined,
        accountId: accountId || filters.accountId,
        organizationId: organizationId || filters.organizationId,
      }),
    enabled:
      flagsReady &&
      enabled &&
      (accountId !== undefined ? Boolean(accountId) : true),
    staleTime: 45_000,
    refetchOnMount: "always",
  });

  // Absolute SQLite size (ignores chips) — banner + stale-cache detection.
  const bookCountQuery = useQuery({
    queryKey: ["local-book-txn-count", orgKey],
    queryFn: dalFetchBookTransactionCount,
    enabled: flagsReady && enabled && localFirstEnabled,
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  // Tab focus: Home and Ledger share filters but were left stale by
  // queryClient defaults (refetchOnMount/focus false).
  useFocusEffect(
    useCallback(() => {
      if (!flagsReady || !enabled) return;
      void transactionsQuery.refetch();
      void totalsQuery.refetch();
      if (localFirstEnabled) void bookCountQuery.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional focus refetch
    }, [flagsReady, enabled, localFirstEnabled, orgKey, accountId]),
  );

  const listState = useTransactionListState(
    filters,
    setFilters,
    {
      data: transactionsQuery.data,
      isPending: transactionsQuery.isPending,
      isFetching: transactionsQuery.isFetching,
      isPlaceholderData: transactionsQuery.isPlaceholderData,
    },
    {
      defaultLimit: resolvedLimit,
      preserveKeys: accountId
        ? ["accountId", "organizationId"]
        : ["organizationId"],
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
    totalsQuery.data?.count ??
    transactionsQuery.data?.pagination?.total ??
    listState.allTransactions.length;

  const bookTransactionCount = bookCountQuery.data ?? totalTransactionCount;

  // Unfiltered feed drifted behind SQLite (common after migrate while Home
  // kept a thin React Query page). Force a fresh read of the full book.
  const staleBookRepairRef = useRef<string | null>(null);
  useEffect(() => {
    if (!localFirstEnabled || !flagsReady) return;
    if (hasActiveFilters) return;
    const book = bookCountQuery.data;
    if (book == null || book <= 0) return;
    if (totalTransactionCount >= book) {
      staleBookRepairRef.current = null;
      return;
    }
    if (book - totalTransactionCount < 20) return;
    const token = `${book}:${totalTransactionCount}`;
    if (staleBookRepairRef.current === token) return;
    staleBookRepairRef.current = token;
    void transactionsQuery.refetch();
    void totalsQuery.refetch();
  }, [
    localFirstEnabled,
    flagsReady,
    hasActiveFilters,
    bookCountQuery.data,
    totalTransactionCount,
    transactionsQuery,
    totalsQuery,
  ]);

  const ledgerTotals = useMemo(() => {
    if (!totalsQuery.data) return null;
    return {
      debit: totalsQuery.data.debit,
      credit: totalsQuery.data.credit,
    };
  }, [totalsQuery.data]);

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
    bookTransactionCount,
    ledgerTotals,
    totalsQuery,
    ...listState,
    ...filterOptions,
    handleResetFilters,
    handleApplyFilters,
  };
}
