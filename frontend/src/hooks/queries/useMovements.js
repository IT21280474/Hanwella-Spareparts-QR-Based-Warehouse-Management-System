import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { movementsApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

/**
 * The global stock-movement feed.
 *
 * Filtering and paging are server-side; the previous page stays on screen while
 * the next one loads so the ledger does not blink between pages.
 */
export function useMovementsQuery(params) {
  return useQuery({
    queryKey: queryKeys.movements.list(params),
    queryFn: () => movementsApi.list(params),
    placeholderData: keepPreviousData,
  });
}
