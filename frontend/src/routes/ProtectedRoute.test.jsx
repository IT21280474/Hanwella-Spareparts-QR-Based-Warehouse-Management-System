import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '@/context/AuthContext';
import { ApiError } from '@/utils/errors';
import { ProtectedRoute, GuestRoute } from './ProtectedRoute';

vi.mock('@/services/api', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));

import { authApi } from '@/services/api';

function renderAt(initialPath) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <Routes>
            <Route element={<GuestRoute />}>
              <Route path="/login" element={<p>Login page</p>} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<p>Dashboard home</p>} />
            </Route>

            <Route element={<ProtectedRoute permission="manage_users" />}>
              <Route path="/users" element={<p>Users admin page</p>} />
            </Route>

            <Route path="/403" element={<p>Forbidden</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProtectedRoute', () => {
  it('sends an unauthenticated visitor to /login', async () => {
    authApi.me.mockRejectedValueOnce(new ApiError({ status: 401, message: 'Unauthenticated.' }));
    renderAt('/dashboard');

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('renders the route for an authenticated user with no permission requirement', async () => {
    authApi.me.mockResolvedValueOnce({ id: 1, name: 'Sadeeka', permissions: [] });
    renderAt('/dashboard');

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument();
  });

  it('sends an authenticated user lacking the required permission to /403', async () => {
    authApi.me.mockResolvedValueOnce({ id: 4, name: 'Nimali', permissions: ['view_dashboard'] });
    renderAt('/users');

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
  });

  it('renders the route when the authenticated user holds the required permission', async () => {
    authApi.me.mockResolvedValueOnce({ id: 1, name: 'Sadeeka', permissions: ['manage_users'] });
    renderAt('/users');

    expect(await screen.findByText('Users admin page')).toBeInTheDocument();
  });
});

describe('GuestRoute', () => {
  it('keeps a signed-in user out of /login by sending them to the dashboard', async () => {
    authApi.me.mockResolvedValueOnce({ id: 1, name: 'Sadeeka', permissions: [] });
    renderAt('/login');

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument();
  });

  it('lets a guest reach /login', async () => {
    authApi.me.mockRejectedValueOnce(new ApiError({ status: 401, message: 'Unauthenticated.' }));
    renderAt('/login');

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
