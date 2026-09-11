import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui';
import { loginPathFor } from '@/constants/navigation';
import { PERMISSIONS } from '@/constants/permissions';

/**
 * Route guard.
 *
 * While the session is still resolving nothing is rendered and nothing is
 * redirected — redirecting during `loading` is what produces a sign-in loop on
 * a page refresh. An unauthenticated visitor is sent to /login carrying the
 * page they wanted, so they land there after signing in — or to the gate's own
 * /security/login when the page they wanted was a Security one.
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
    return <Navigate to={loginPathFor(location.pathname)} replace state={{ from: location }} />;
  }

  if (permission && !can(permission)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}

/** Keeps a signed-in user out of the login screen. */
export function GuestRoute() {
  const { isLoading, isAuthenticated, homePath, can } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="app__fallback" role="status" aria-live="polite">
        <Spinner size={20} tone="var(--color-muted-2)" />
      </div>
    );
  }

  if (isAuthenticated) {
    // Someone signing in at the gate lands on the gate, even an administrator
    // whose everyday home is the warehouse dashboard.
    const fallback =
      location.pathname.startsWith('/security') && can(PERMISSIONS.VIEW_YARD_STOCK) ? '/security/dashboard' : homePath;
    return <Navigate to={location.state?.from?.pathname || fallback} replace />;
  }

  return <Outlet />;
}

/** `/` lands each role on its own home screen rather than one it cannot open. */
export function HomeRedirect() {
  const { homePath } = useAuth();
  return <Navigate to={homePath} replace />;
}
