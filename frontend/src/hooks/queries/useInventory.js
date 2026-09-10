import { useQuery } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { inventoryApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

/**
 * Server-side search, filter, sort and pagination for the inventory table.
 * `keepPreviousData` holds the current page on screen while the next one loads,
 * so paging does not flash an empty table.
 */
export function useInventoryQuery(params) {
  return useQuery({
    queryKey: queryKeys.inventory.list(params),
    queryFn: () => inventoryApi.list(params),
    placeholderData: keepPreviousData,
  });
}
