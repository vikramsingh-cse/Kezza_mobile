/**
 * React Query client configuration.
 *
 * Sensible defaults for a mobile app:
 *  - staleTime 60 s — avoids unnecessary refetches on tab focus
 *  - retry 2 on 5xx errors only (never on 4xx — those need user action)
 *  - gcTime 10 min — keep unused query data in memory for quick re-renders
 *
 * Wrap the app in <QueryClientProvider client={queryClient}> in _layout.tsx.
 */

import { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,            // 1 minute
      gcTime: 10 * 60 * 1000,          // 10 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry on client errors (4xx)
        if (isAxiosError(error) && (error.response?.status ?? 0) < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      // Surface mutation errors to the calling component, not globally
      onError: () => {},
    },
  },
});
