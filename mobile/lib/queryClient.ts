import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      staleTime: 30 * 1000, // 30s — avoid refetch storms while typing/filtering
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Only refetch on mount when data is stale (not every navigation)
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
      retryDelay: 1000,
    },
  },
});

/**
 * Clear all cached data from React Query
 * Call this on logout to ensure fresh data for new users
 */
export const clearQueryCache = () => {
  queryClient.clear();
};
