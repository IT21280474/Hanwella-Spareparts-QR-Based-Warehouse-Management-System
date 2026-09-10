import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui';

/**
 * Route guard.
 *
 * While the session is still resolving nothing is rendered and nothing is
 * redirected — redirecting during `loading` is what produces a sign-in loop on
 * a page refresh. An unauthenticated visitor is sent to /login carrying the
 * page they wanted, so they land there after signing in.
 */
export function ProtectedRoute({ permission }) {
  const { isLoading, isAuthenticated, can } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="app__fallback" role="status" aria-live="polite">
        <Spinner size={20} tone="var(--color-muted-2)" />
        <span>Checking your session…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (permission && !can(permission)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}

/** Keeps a signed-in user out of the login screen. */
export function GuestRoute() {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="app__fallback" role="status" aria-live="polite">
        <Spinner size={20} tone="var(--color-muted-2)" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;
  }

  return <Outlet />;
}
