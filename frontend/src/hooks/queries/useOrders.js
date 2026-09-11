import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

export function useOrdersQuery(params) {
  return useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => ordersApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useOrderQuery(id, options = {}) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => ordersApi.get(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * An order moves stock, so anything that changes one also invalidates the
 * inventory, the movement ledger and the dashboard — never just the order.
 */
export function useInvalidateOrders() {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.parts.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.movements.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    queryClient.invalidateQueries({ queryKey: queryKeys.securityDashboard() });
    if (id) queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(id) });
  };
}

export function useCreateOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (payload) => ordersApi.create(payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateOrderPayment(id) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (payload) => ordersApi.updatePayment(id, payload),
    onSuccess: () => invalidate(id),
  });
}

export function useCancelOrder(id) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (payload) => ordersApi.cancel(id, payload),
    onSuccess: () => invalidate(id),
  });
}

export function useDispatchOrder(id) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: () => ordersApi.dispatch(id),
    onSuccess: () => invalidate(id),
  });
}
