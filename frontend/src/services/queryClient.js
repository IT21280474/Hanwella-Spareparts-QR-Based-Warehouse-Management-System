import { QueryClient } from '@tanstack/react-query';
import { toApiError } from '@/utils/errors';

/**
 * Shared cache configuration.
 *
 * Warehouse data changes under other people's hands, so windows stay short —
 * but a request the server refused for lack of permission or a missing record
 * is never worth retrying.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const apiError = toApiError(error);
        if (apiError.status >= 400 && apiError.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
