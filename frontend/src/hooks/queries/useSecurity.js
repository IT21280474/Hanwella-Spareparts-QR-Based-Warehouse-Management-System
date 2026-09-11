import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { securityApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

/**
 * Finance completes payments on other terminals, so the gate cannot rely on
 * its own mutations to learn that an order entered the yard. The yard views
 * re-poll on this interval and whenever the tab regains focus.
 */
export const YARD_REFRESH_MS = 20_000;

const live = {
  staleTime: 0,
  refetchInterval: YARD_REFRESH_MS,
  refetchOnWindowFocus: true,
};

export function useSecurityDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.security.dashboard(),
    queryFn: () => securityApi.dashboard(),
    ...live,
  });
}

export function useYardStockQuery(params) {
  return useQuery({
    queryKey: queryKeys.security.yard(params),
    queryFn: () => securityApi.yardStock(params),
    placeholderData: keepPreviousData,
    ...live,
  });
}

export function useYardOrderQuery(id) {
  return useQuery({
    queryKey: queryKeys.security.order(id),
    queryFn: () => securityApi.getOrder(id),
    enabled: !!id,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useDispatchHistoryQuery(params) {
  return useQuery({
    queryKey: queryKeys.security.history(params),
    queryFn: () => securityApi.dispatchHistory(params),
    placeholderData: keepPreviousData,
    ...live,
  });
}

/** Lookup is an explicit action (Enter or a scan), not a cached query. */
export function useOrderLookup() {
  return useMutation({
    mutationFn: (orderNo) => securityApi.searchOrder(orderNo),
  });
}

/**
 * A dispatch changes the yard, the history, the dashboard counts and the
 * order's own record — so the whole security cache and the orders cache are
 * refreshed together, and the order's detail is primed with the server's
 * post-dispatch copy so the page shows DISPATCHED immediately.
 */
export function useDispatchOrder(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => securityApi.dispatch(id, payload),
    onSuccess: ({ order }) => {
      if (order) queryClient.setQueryData(queryKeys.security.order(id), order);
      queryClient.invalidateQueries({ queryKey: queryKeys.security.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() });
    },
    onError: () => {
      // Whatever beat us to it, show the order as it now stands.
      queryClient.invalidateQueries({ queryKey: queryKeys.security.all() });
    },
  });
}
