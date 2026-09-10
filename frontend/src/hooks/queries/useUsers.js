import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

export function useUsersQuery(params) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => usersApi.list(params),
    placeholderData: keepPreviousData,
  });
}

/** The role catalogue changes rarely; hold it for the length of a session. */
export function useRolesQuery() {
  return useQuery({
    queryKey: queryKeys.users.roles(),
    queryFn: () => usersApi.roles(),
    staleTime: 30 * 60_000,
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (payload) => usersApi.create(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateUser(id) {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (payload) => usersApi.update(id, payload),
    onSuccess: invalidate,
  });
}

/** Accounts are deactivated rather than deleted so history keeps its author. */
export function useSetUserActive() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, isActive }) => usersApi.setActive(id, isActive),
    onSuccess: invalidate,
  });
}
