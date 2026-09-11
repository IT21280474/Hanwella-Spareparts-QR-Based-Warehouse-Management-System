import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

/**
 * Polled rather than pushed — this app has no websocket/broadcast layer, and
 * a 30s interval is close enough for an alert that isn't time-critical
 * (a stock-out warning or a dispatch-ready order stays true until acted on).
 */
const POLL_INTERVAL_MS = 30000;

export function useNotificationsQuery(params = {}) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: () => notificationsApi.list(params),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => notificationsApi.read(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.readAll(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
