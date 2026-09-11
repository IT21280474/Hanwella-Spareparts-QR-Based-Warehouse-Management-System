import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/services/api';
import { SESSION_EXPIRED_EVENT } from '@/services/apiClient';
import { toApiError } from '@/utils/errors';
import { toast } from '@/store/toastStore';
import { homePathFor } from '@/constants/navigation';

export const AuthContext = createContext(null);

/**
 * Session state for the whole app.
 *
 * The session itself lives in an httpOnly cookie; this context only mirrors
 * *who* that cookie belongs to. On boot it asks the server — a 401 simply means
 * "not signed in" and is not an error worth surfacing.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | guest
  const queryClient = useQueryClient();

  const resolveSession = useCallback(async () => {
    try {
      const current = await authApi.me();
      setUser(current);
      setStatus('authenticated');
    } catch (error) {
      const apiError = toApiError(error);
      setUser(null);
      setStatus('guest');
      // A dead network on boot is worth telling the user about; a 401 is not.
      if (apiError.isNetwork) {
        toast.error('Cannot reach the server', apiError.message);
      }
    }
  }, []);

  useEffect(() => {
    resolveSession();
  }, [resolveSession]);

  // The API rejected the session mid-flight (expired or revoked server-side).
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setStatus('guest');
      queryClient.clear();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [queryClient]);

  const login = useCallback(async (credentials) => {
    const signedIn = await authApi.login(credentials);
    setUser(signedIn);
    setStatus('authenticated');
    return signedIn;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Whether or not the server acknowledged, this browser is signed out.
      setUser(null);
      setStatus('guest');
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo(() => {
    const permissions = new Set(user?.permissions ?? []);
    return {
      user,
      status,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated' && !!user,
      permissions,
      /** UI-level check only; the server authorises every request again. */
      can: (permission) => (permission ? permissions.has(permission) : true),
      canAny: (list = []) => list.length === 0 || list.some((p) => permissions.has(p)),
      hasRole: (slug) => user?.role?.slug === slug,
      /** Default landing screen for this user's role. */
      homePath: homePathFor(user),
      login,
      logout,
      refresh: resolveSession,
    };
  }, [user, status, login, logout, resolveSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
