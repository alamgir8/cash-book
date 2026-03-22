import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 60 * 1000, // 1 minute — financial data should be reasonably fresh
      gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
      refetchOnWindowFocus: false, // React Native: no window focus
      refetchOnReconnect: true, // Refetch when network reconnects
      refetchOnMount: "always", // Always check staleness on mount
    },
    mutations: {
      retry: 1,
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
