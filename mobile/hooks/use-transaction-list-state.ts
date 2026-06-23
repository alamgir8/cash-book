import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Transaction, TransactionFilters } from "@/services/transactions";
import {
  applyChipFilter,
  filterTransactionsByActiveFilters,
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
};

type Options = {
  defaultLimit?: number;
  preserveKeys?: (keyof TransactionFilters)[];
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

  const visibleTransactions = useMemo(
    () => filterTransactionsByActiveFilters(allTransactions, filters),
    [allTransactions, filters],
  );

  useEffect(() => {
    if (!query.data || query.isPending || query.isFetching) return;

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
      setFilters((prev) => withPreservedKeys(applyChipFilter(prev, type, value)));
    },
    [resetList, setFilters, withPreservedKeys],
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
      setFilters((prev) =>
        withPreservedKeys(mergeTransactionFilters(prev, patch)),
      );
    },
    [resetList, setFilters, withPreservedKeys],
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
