import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '@/context/AuthContext';
import { PERMISSIONS } from '@/constants/permissions';
import { homePathFor } from '@/constants/navigation';
import { ApiError } from '@/utils/errors';
import { buildUser } from '@/test/test-utils';
import { HomeRedirect, ProtectedRoute } from './ProtectedRoute';

vi.mock('@/services/api', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));

import { authApi } from '@/services/api';

const securityUser = buildUser({
  role: { slug: 'SECURITY', name: 'Security officer' },
  permissions: ['view_yard_stock', 'dispatch_orders'],
});

beforeEach(() => {
  vi.clearAllMocks();
});

/** The real guards around stand-in pages, mirroring the branches in routes/index.jsx. */
function renderAt(path) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<p>Main sign-in</p>} />
            <Route path="/security/login" element={<p>Security sign-in</p>} />
            <Route element={<ProtectedRoute />}>
              <Route index element={<HomeRedirect />} />
              <Route element={<ProtectedRoute permission={PERMISSIONS.VIEW_DASHBOARD} />}>
                <Route path="/dashboard" element={<p>Warehouse dashboard</p>} />
              </Route>
              <Route element={<ProtectedRoute permission={PERMISSIONS.VIEW_TRANSACTIONS} />}>
                <Route path="/orders" element={<p>Orders</p>} />
              </Route>
              <Route element={<ProtectedRoute permission={PERMISSIONS.MANAGE_USERS} />}>
                <Route path="/users" element={<p>Users</p>} />
              </Route>
              <Route element={<ProtectedRoute permission={PERMISSIONS.VIEW_YARD_STOCK} />}>
                <Route path="/security/dashboard" element={<p>Gate dashboard</p>} />
              </Route>
              <Route path="/403" element={<p>Access denied</p>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Security routing', () => {
  it('sends a security user from / to the gate dashboard', async () => {
    authApi.me.mockResolvedValue(securityUser);
    renderAt('/');
    expect(await screen.findByText('Gate dashboard')).toBeInTheDocument();
  });

  it.each(['/dashboard', '/orders', '/users'])('keeps a security user out of %s', async (path) => {
    authApi.me.mockResolvedValue(securityUser);
    renderAt(path);
    expect(await screen.findByText('Access denied')).toBeInTheDocument();
  });

  it('keeps a warehouse user out of the gate', async () => {
    authApi.me.mockResolvedValue(buildUser({ permissions: ['view_dashboard', 'view_transactions'] }));
    renderAt('/security/dashboard');
    expect(await screen.findByText('Access denied')).toBeInTheDocument();
  });

  it('sends a signed-out visitor at a security page to the security sign-in', async () => {
    authApi.me.mockRejectedValue(new ApiError({ status: 401, message: 'Unauthenticated.' }));
    renderAt('/security/dashboard');
    expect(await screen.findByText('Security sign-in')).toBeInTheDocument();
  });

  it('sends a signed-out visitor at a warehouse page to the main sign-in', async () => {
    authApi.me.mockRejectedValue(new ApiError({ status: 401, message: 'Unauthenticated.' }));
    renderAt('/orders');
    expect(await screen.findByText('Main sign-in')).toBeInTheDocument();
  });

  it('picks each role’s home screen', () => {
    expect(homePathFor(securityUser)).toBe('/security/dashboard');
    expect(homePathFor(buildUser())).toBe('/dashboard');
  });
});
