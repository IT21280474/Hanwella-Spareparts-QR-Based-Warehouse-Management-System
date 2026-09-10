import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stockApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

/**
 * Every stock write changes the same four views: the part, the inventory
 * table, the movement ledger and the dashboard. Invalidating them in one place
 * means a new movement screen cannot forget one of them.
 */
function useInvalidateStock() {
  const queryClient = useQueryClient();
  return (partId) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.parts.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.movements.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    if (partId) queryClient.invalidateQueries({ queryKey: queryKeys.parts.detail(partId) });
  };
}

export function useStockIn() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: (payload) => stockApi.stockIn(payload),
    onSuccess: (_result, variables) => invalidate(variables?.part_id),
  });
}

export function useStockOut() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: (payload) => stockApi.stockOut(payload),
    onSuccess: (_result, variables) => invalidate(variables?.part_id),
  });
}
