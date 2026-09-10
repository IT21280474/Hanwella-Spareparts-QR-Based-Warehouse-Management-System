import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthProvider } from '@/context/AuthContext';

/** A logged-in user shaped exactly like `GET /auth/me` (see AuthTest.php on the backend). */
export function buildUser(overrides = {}) {
  return {
    id: 1,
    name: 'Sadeeka Perera',
    email: 'sadeeka@hanwellaspares.lk',
    role: { slug: 'ADMIN', name: 'Warehouse admin' },
    permissions: [
      'view_dashboard', 'view_inventory', 'create_inventory', 'update_inventory', 'delete_inventory',
      'scan_qr', 'print_labels', 'create_stock_in', 'create_stock_out', 'view_transactions',
      'view_reports', 'export_reports', 'manage_users', 'manage_settings',
    ],
    ...overrides,
  };
}

function newTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Render with the same provider stack every real page mounts under: a fresh
 * query cache (so tests never see another test's cached data), a memory
 * router, and the real AuthProvider. `authApi.me` must already be mocked by
 * the caller before this fires, since AuthProvider calls it on mount.
 */
export function renderWithProviders(ui, { route = '/', queryClient = newTestQueryClient(), ...options } = {}) {
  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>{children}</AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

export * from '@testing-library/react';
