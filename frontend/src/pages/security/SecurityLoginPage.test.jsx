import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '@/context/AuthContext';
import { ApiError } from '@/utils/errors';
import { buildUser } from '@/test/test-utils';
import SecurityLoginPage from './SecurityLoginPage';

vi.mock('@/services/api', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));

import { authApi } from '@/services/api';

const securityUser = buildUser({
  id: 9,
  name: 'Yard Security',
  email: 'security@hanwellaspares.lk',
  role: { slug: 'SECURITY', name: 'Security officer' },
  permissions: ['view_yard_stock', 'dispatch_orders'],
});

beforeEach(() => {
  vi.clearAllMocks();
  authApi.me.mockRejectedValue(new ApiError({ status: 401, message: 'Unauthenticated.' }));
});

function renderSecurityLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/security/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/security/login" element={<SecurityLoginPage />} />
            <Route path="/security/dashboard" element={<p>Gate dashboard home</p>} />
            <Route path="/login" element={<p>Main sign-in</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillAndSubmit(user, email, password) {
  await user.type(await screen.findByLabelText('Email', { exact: false }), email);
  await user.type(screen.getByLabelText('Password', { exact: false }), password);
  await user.click(screen.getByRole('button', { name: 'Sign in to the gate' }));
}

describe('SecurityLoginPage', () => {
  it('validates required fields before calling the API', async () => {
    const user = userEvent.setup();
    renderSecurityLogin();

    await user.click(await screen.findByRole('button', { name: 'Sign in to the gate' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('signs in through the security portal and lands on the gate dashboard', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValue(securityUser);
    renderSecurityLogin();

    await fillAndSubmit(user, 'security@hanwellaspares.lk', 'password');

    expect(authApi.login).toHaveBeenCalledWith({
      email: 'security@hanwellaspares.lk',
      password: 'password',
      portal: 'security',
    });
    expect(await screen.findByText('Gate dashboard home')).toBeInTheDocument();
  });

  it('shows the server’s refusal for an account without Security access', async () => {
    const user = userEvent.setup();
    authApi.login.mockRejectedValue(
      new ApiError({
        status: 422,
        message: 'Validation failed.',
        errors: { email: ['This account does not have Security access. Use the main warehouse sign-in instead.'] },
      }),
    );
    renderSecurityLogin();

    await fillAndSubmit(user, 'kasun@hanwellaspares.lk', 'password');

    expect(
      await screen.findByText('This account does not have Security access. Use the main warehouse sign-in instead.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Gate dashboard home')).not.toBeInTheDocument();
  });

  it('shows invalid credentials clearly', async () => {
    const user = userEvent.setup();
    authApi.login.mockRejectedValue(
      new ApiError({
        status: 422,
        message: 'Validation failed.',
        errors: { email: ['These credentials do not match our records.'] },
      }),
    );
    renderSecurityLogin();

    await fillAndSubmit(user, 'security@hanwellaspares.lk', 'wrong');

    expect(await screen.findByText('These credentials do not match our records.')).toBeInTheDocument();
  });
});
