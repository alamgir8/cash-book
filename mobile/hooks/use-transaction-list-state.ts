import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Transaction, TransactionFilters } from "@/services/transactions";
import {
  applyChipFilter,
  mergeTransactionFilters,
  serializeTransactionFilters,
  type ChipFilterType,
} from "@/lib/transaction-filters";

type QuerySlice = {
  data?: {
    transactions?: Transaction[];
    pagination?: { page: number; pages: number };
  };
  isPending: boolean;
  isFetching: boolean;
  isPlaceholderData?: boolean;
};

type Options = {
  defaultLimit?: number;
  preserveKeys?: (keyof TransactionFilters)[];
};

const signatureWithoutPage = (filters: TransactionFilters) => {
  const serialized = serializeTransactionFilters(filters);
  delete serialized.page;
  return JSON.stringify(serialized);
};

/**
 * Shared paginated transaction list state for Dashboard, Ledger, and Account screens.
 * Filter state lives in the parent so React Query can use the same `filters` object.
 */
export function useTransactionListState(
  filters: TransactionFilters,
  setFilters: Dispatch<SetStateAction<TransactionFilters>>,
  query: QuerySlice,
  options: Options = {},
) {
  const { defaultLimit = 20, preserveKeys = [] } = options;

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const filterSignature = useMemo(
    () => JSON.stringify(serializeTransactionFilters(filters)),
    [filters],
  );
  const scopeSignature = useMemo(
    () => signatureWithoutPage(filters),
    [filters],
  );
  const prevScopeRef = useRef(scopeSignature);

  // Drop stale rows as soon as org/account/chips change (don't keep personal list
  // visible while the org request is in flight with placeholderData).
  useEffect(() => {
    if (prevScopeRef.current === scopeSignature) return;
    prevScopeRef.current = scopeSignature;
    setAllTransactions([]);
    setHasMorePages(true);
    setLoadingMore(false);
  }, [scopeSignature]);

  // SQL / API already applied filters. Re-filtering here dropped valid rows
  // when party._id was server_id while the chip used local UUID (and vice versa).
  const visibleTransactions = allTransactions;

  // Re-apply when fetch settles. Pull-to-refresh used to clear the list then
  // skip this effect when React Query kept the same data reference (empty forever).
  const fetchSettled = !query.isPending && !query.isFetching;

  useEffect(() => {
    if (!query.data || query.isPending) return;
    // Placeholder is previous query's rows — never commit those under a new scope
    if (query.isPlaceholderData) return;

    const freshData = query.data.transactions ?? [];
    const pagination = query.data.pagination;
    const currentPage = filters.page ?? 1;

    if (pagination && pagination.page !== currentPage) return;

    if (currentPage === 1) {
      setAllTransactions(freshData);
      if (pagination) {
        setHasMorePages(pagination.page < pagination.pages);
      } else {
        setHasMorePages(freshData.length === (filters.limit ?? defaultLimit));
      }
    } else {
      setAllTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t._id));
        const newItems = freshData.filter((t) => !existingIds.has(t._id));
        return [...prev, ...newItems];
      });
      if (pagination) {
        setHasMorePages(pagination.page < pagination.pages);
      } else {
        setHasMorePages(freshData.length === (filters.limit ?? defaultLimit));
      }
      setLoadingMore(false);
    }
  }, [
    query.data,
    query.isPending,
    query.isFetching,
    query.isPlaceholderData,
    fetchSettled,
    filters.page,
    filters.limit,
    filterSignature,
    defaultLimit,
  ]);

  const resetList = useCallback(() => {
    setAllTransactions([]);
    setHasMorePages(true);
  }, []);

  const withPreservedKeys = useCallback(
    (next: TransactionFilters): TransactionFilters => {
      const preserved: Partial<TransactionFilters> = {};
      for (const key of preserveKeys) {
        const val = filters[key];
        if (val !== undefined && val !== "") {
          (preserved as Record<string, unknown>)[key] = val;
        }
      }
      return { ...next, ...preserved };
    },
    [filters, preserveKeys],
  );

  const applyChip = useCallback(
    (type: ChipFilterType, value?: string) => {
      resetList();
      setFilters((prev) => {
        const next = withPreservedKeys(applyChipFilter(prev, type, value));
        // Wide limit so filtered SQL pages aren't truncated at 30.
        const hasDim =
          next.categoryId ||
          next.category_name ||
          next.counterparty ||
          next.party_id ||
          next.party_name ||
          next.for_party_id ||
          next.for_party_name ||
          next.payment_status ||
          next.loan_filter ||
          next.search ||
          next.q;
        if (hasDim && (next.limit ?? defaultLimit) < 2000) {
          next.limit = 2000;
        }
        if (!hasDim) {
          next.limit = defaultLimit;
        }
        return next;
      });
    },
    [resetList, setFilters, withPreservedKeys, defaultLimit],
  );

  const handleCategoryFilter = useCallback(
    (categoryId?: string) => applyChip("category", categoryId),
    [applyChip],
  );

  const handleCounterpartyFilter = useCallback(
    (counterparty?: string) => applyChip("counterparty", counterparty),
    [applyChip],
  );

  const handleVendorFilter = useCallback(
    (partyId?: string) => applyChip("vendor", partyId),
    [applyChip],
  );

  const handleForPartyFilter = useCallback(
    (forPartyId?: string) => applyChip("for", forPartyId),
    [applyChip],
  );

  const handlePaymentStatusFilter = useCallback(
    (status?: "paid" | "due") => applyChip("payment_status", status),
    [applyChip],
  );

  const handleFilterChange = useCallback(
    (patch: Partial<TransactionFilters> & { searchInput?: string }) => {
      resetList();
      setFilters((prev) => {
        const next = withPreservedKeys(mergeTransactionFilters(prev, patch));
        const hasDim =
          next.categoryId ||
          next.category_name ||
          next.counterparty ||
          next.party_id ||
          next.party_name ||
          next.for_party_id ||
          next.for_party_name ||
          next.payment_status ||
          next.loan_filter ||
          next.search ||
          next.q ||
          next.from ||
          next.to ||
          next.startDate ||
          next.endDate;
        if (hasDim && (next.limit ?? defaultLimit) < 2000) {
          next.limit = 2000;
        }
        if (!hasDim) {
          next.limit = defaultLimit;
        }
        return next;
      });
    },
    [resetList, setFilters, withPreservedKeys, defaultLimit],
  );

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMorePages || query.isFetching) return;
    setLoadingMore(true);
    setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }));
  }, [loadingMore, hasMorePages, query.isFetching, setFilters]);

  const resetToPageOne = useCallback(() => {
    resetList();
    setFilters((prev) => ({ ...prev, page: 1 }));
  }, [resetList, setFilters]);

  const resetToFilters = useCallback(
    (base: TransactionFilters) => {
      resetList();
      setFilters(base);
    },
    [resetList, setFilters],
  );

  return {
    allTransactions: visibleTransactions,
    rawTransactions: allTransactions,
    hasMorePages,
    loadingMore,
    resetList,
    resetToPageOne,
    resetToFilters,
    handleCategoryFilter,
    handleCounterpartyFilter,
    handleVendorFilter,
    handleForPartyFilter,
    handlePaymentStatusFilter,
    handleFilterChange,
    handleLoadMore,
  };
}
