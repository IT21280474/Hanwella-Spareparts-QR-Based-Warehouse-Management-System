import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Routes, Route, MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '@/context/AuthContext';
import { ApiError } from '@/utils/errors';
import LoginPage from './LoginPage';

// The factory must not close over an outer identifier (`ApiError` included) —
// vi.mock is hoisted above every import in this file, so anything it
// references from outside must not exist yet at hoist time.
vi.mock('@/services/api', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));

import { authApi } from '@/services/api';

// Every test in this file exercises the login form itself, so the session
// probe on mount should always resolve to "no session yet".
beforeEach(() => {
  authApi.me.mockRejectedValue(new ApiError({ status: 401, message: 'Unauthenticated.' }));
});

/** LoginPage calls `navigate('/dashboard')` on success, so a real target route is needed. */
function renderLoginRoute() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<p>Dashboard home</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  it('renders the sign-in form', async () => {
    renderLoginRoute();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Password', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows validation messages for an empty submission', async () => {
    const user = userEvent.setup();
    renderLoginRoute();

    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('rejects a malformed email before hitting the API', async () => {
    const user = userEvent.setup();
    renderLoginRoute();

    await user.type(await screen.findByLabelText('Email', { exact: false }), 'not-an-email');
    await user.type(screen.getByLabelText('Password', { exact: false }), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('signs in with valid credentials and navigates to the dashboard', async () => {
    authApi.login.mockResolvedValueOnce({
      id: 1, name: 'Sadeeka Perera', email: 'sadeeka@hanwellaspares.lk',
      role: { slug: 'ADMIN', name: 'Warehouse admin' }, permissions: ['view_dashboard'],
    });
    const user = userEvent.setup();
    renderLoginRoute();

    await user.type(await screen.findByLabelText('Email', { exact: false }), 'sadeeka@hanwellaspares.lk');
    await user.type(screen.getByLabelText('Password', { exact: false }), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument();
    expect(authApi.login).toHaveBeenCalledWith({
      email: 'sadeeka@hanwellaspares.lk',
      password: 'password',
      remember: false,
    });
  });

  it('shows the server-rejected-credentials message inline and does not navigate', async () => {
    authApi.login.mockRejectedValueOnce(
      new ApiError({
        status: 422,
        message: 'Validation failed.',
        errors: { email: ['These credentials do not match our records.'] },
      }),
    );
    const user = userEvent.setup();
    renderLoginRoute();

    await user.type(await screen.findByLabelText('Email', { exact: false }), 'sadeeka@hanwellaspares.lk');
    await user.type(screen.getByLabelText('Password', { exact: false }), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('These credentials do not match our records.')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard home')).not.toBeInTheDocument();
  });

  it('shows a generic alert for a network failure', async () => {
    authApi.login.mockRejectedValueOnce(new ApiError({ code: 'network', message: 'Cannot reach the server. Check your connection and try again.' }));
    const user = userEvent.setup();
    renderLoginRoute();

    await user.type(await screen.findByLabelText('Email', { exact: false }), 'sadeeka@hanwellaspares.lk');
    await user.type(screen.getByLabelText('Password', { exact: false }), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
  });
});
