import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { partsApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

export function usePartsQuery(params) {
  return useQuery({
    queryKey: queryKeys.parts.list(params),
    queryFn: () => partsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function usePartQuery(id, options = {}) {
  return useQuery({
    queryKey: queryKeys.parts.detail(id),
    queryFn: () => partsApi.get(id),
    enabled: !!id,
    ...options,
  });
}

export function usePartMovementsQuery(id, params = {}) {
  return useQuery({
    queryKey: queryKeys.parts.movements(id, params),
    queryFn: () => partsApi.movements(id, params),
    enabled: !!id,
  });
}

/** Anything that changes a part invalidates the same three caches. */
export function useInvalidateParts() {
  const queryClient = useQueryClient();
  return (id) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.parts.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    if (id) queryClient.invalidateQueries({ queryKey: queryKeys.parts.detail(id) });
  };
}

export function useCreatePart() {
  const invalidate = useInvalidateParts();
  return useMutation({
    mutationFn: (payload) => partsApi.create(payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdatePart(id) {
  const invalidate = useInvalidateParts();
  return useMutation({
    mutationFn: (payload) => partsApi.update(id, payload),
    onSuccess: () => invalidate(id),
  });
}

export function useDeletePart() {
  const invalidate = useInvalidateParts();
  return useMutation({
    mutationFn: (id) => partsApi.remove(id),
    onSuccess: () => invalidate(),
  });
}
