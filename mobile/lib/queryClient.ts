import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      // Longer stale window = fewer remount/tab refetches
      staleTime: 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Cached data is enough on navigate; pull-to-refresh / mutations invalidate
      refetchOnMount: false,
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
