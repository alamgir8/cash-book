import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { Transaction, TransactionFilters } from "@/services/transactions";

interface PaginatedTransactionData {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Hook for managing paginated transaction data
 * Handles merging new pages with existing cached data
 */
export function usePaginationCache() {
  const queryClient = useQueryClient();

  const mergeTransactionPages = useCallback(
    (filters: TransactionFilters, newData: PaginatedTransactionData) => {
      const cacheKey = queryKeys.transactions(filters);

      queryClient.setQueryData(cacheKey, (oldData: any) => {
        if (!oldData) return newData;

        // If it's the first page, replace the data
        if (filters.page === 1) {
          return newData;
        }

        // Otherwise, merge with existing transactions
        const existingTransactions = oldData.transactions || [];
        const mergedTransactions = [
          ...existingTransactions,
          ...newData.transactions,
        ];

        // Remove duplicates based on transaction ID
        const uniqueTransactions = Array.from(
          new Map(mergedTransactions.map((tx) => [tx._id, tx])).values(),
        );

        return {
          ...newData,
          transactions: uniqueTransactions,
          total: newData.total,
        };
      });
    },
    [queryClient],
  );

  return { mergeTransactionPages };
}

/**
 * Hook for prefetching related data
 */
export function usePrefetchData() {
  const queryClient = useQueryClient();

  const prefetchNextPage = useCallback(
    async (filters: TransactionFilters) => {
      const nextPage = (filters.page ?? 1) + 1;
      await queryClient.prefetchQuery({
        queryKey: queryKeys.transactions({ ...filters, page: nextPage }),
        staleTime: 1000 * 60 * 5, // 5 minutes
      });
    },
    [queryClient],
  );

  return { prefetchNextPage };
}
