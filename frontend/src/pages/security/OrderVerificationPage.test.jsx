import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { AuthProvider } from '@/context/AuthContext';
import { ApiError } from '@/utils/errors';
import { buildUser } from '@/test/test-utils';
import OrderVerificationPage from './OrderVerificationPage';

vi.mock('@/services/api', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
  securityApi: { getOrder: vi.fn(), dispatch: vi.fn() },
}));

import { authApi, securityApi } from '@/services/api';

const securityUser = buildUser({
  role: { slug: 'SECURITY', name: 'Security officer' },
  permissions: ['view_yard_stock', 'dispatch_orders'],
});

/** Shaped exactly like YardOrderResource on the backend. */
function buildYardOrder(overrides = {}) {
  return {
    id: 42,
    order_no: 'SO-2026-0123',
    bill_no: 'SO-2026-0123',
    customer_name: 'Nimal Traders',
    customer_phone: '0771234567',
    ordered_at: '2026-09-11T04:30:00+00:00',
    paid_at: '2026-09-11T05:00:00+00:00',
    items_count: 2,
    total_quantity: 15,
    total: 250000,
    paid_amount: 250000,
    balance: 0,
    payment_status: 'PAID',
    is_fully_paid: true,
    yard_status: 'READY_FOR_DISPATCH',
    dispatch_status: 'AWAITING_DISPATCH',
    items: [
      { id: 1, part_name: 'Item A', part_number: 'BRK-001', qr_code: 'SJL-00001', quantity: 10, unit: 'pcs' },
      { id: 2, part_name: 'Item B', part_number: 'FLT-002', qr_code: 'SJL-00002', quantity: 5, unit: 'set' },
    ],
    dispatch: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authApi.me.mockResolvedValue(securityUser);
});

function renderVerification(id = 42) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/security/orders/${id}`]}>
        <AuthProvider>
          <Routes>
            <Route path="/security/orders/:id" element={<OrderVerificationPage />} />
            <Route path="/security/dashboard" element={<p>Gate dashboard home</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OrderVerificationPage', () => {
  it('shows the gate verdict, customer, exact payment and every item', async () => {
    securityApi.getOrder.mockResolvedValue(buildYardOrder());
    renderVerification();

    expect(await screen.findByRole('heading', { name: 'SO-2026-0123' })).toBeInTheDocument();
    expect(screen.getAllByText('FULLY PAID').length).toBeGreaterThan(0);
    expect(screen.getByText('READY FOR DISPATCH')).toBeInTheDocument();
    expect(screen.getByText('Nimal Traders')).toBeInTheDocument();
    expect(screen.getAllByText('Rs 250,000.00')).toHaveLength(2);
    expect(screen.getByText('Rs 0.00')).toBeInTheDocument();
    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();
    expect(securityApi.getOrder).toHaveBeenCalledWith('42');
  });

  it('asks for confirmation before dispatching, and only then calls the API', async () => {
    const user = userEvent.setup();
    const released = buildYardOrder({
      yard_status: 'DISPATCHED',
      dispatch_status: 'DISPATCHED',
      dispatch: {
        id: 7,
        dispatch_no: 'DSP-000007',
        dispatched_at: '2026-09-11T06:00:00+00:00',
        dispatched_by: { id: 1, name: 'Yard Security' },
        notes: 'Lorry WP-1234',
      },
    });
    // Like the server: ready until dispatched, released on every read after.
    securityApi.getOrder.mockResolvedValueOnce(buildYardOrder()).mockResolvedValue(released);
    securityApi.dispatch.mockResolvedValue({
      dispatch: { id: 7, dispatch_no: 'DSP-000007' },
      order: released,
      message: 'Order SO-2026-0123 dispatched (DSP-000007).',
    });
    renderVerification();

    const [dispatchButton] = await screen.findAllByRole('button', { name: 'Dispatch order' });
    await user.click(dispatchButton);

    const dialog = await screen.findByRole('dialog', { name: 'Dispatch order SO-2026-0123?' });
    expect(within(dialog).getByText(/Are you sure you want to dispatch Order SO-2026-0123\?/)).toBeInTheDocument();
    expect(within(dialog).getByText('15 units')).toBeInTheDocument();
    expect(securityApi.dispatch).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText('Dispatch note'), 'Lorry WP-1234');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm dispatch' }));

    expect(securityApi.dispatch).toHaveBeenCalledTimes(1);
    expect(securityApi.dispatch).toHaveBeenCalledWith('42', { notes: 'Lorry WP-1234' });
    expect(await screen.findByText(/Released at the gate — DSP-000007/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dispatch order' })).not.toBeInTheDocument();
  });

  it('cancelling the confirmation dispatches nothing', async () => {
    const user = userEvent.setup();
    securityApi.getOrder.mockResolvedValue(buildYardOrder());
    renderVerification();

    const [dispatchButton] = await screen.findAllByRole('button', { name: 'Dispatch order' });
    await user.click(dispatchButton);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(securityApi.dispatch).not.toHaveBeenCalled();
  });

  it('offers no dispatch for an order that has already left the yard', async () => {
    securityApi.getOrder.mockResolvedValue(
      buildYardOrder({
        yard_status: 'DISPATCHED',
        dispatch_status: 'DISPATCHED',
        dispatch: {
          id: 3,
          dispatch_no: 'DSP-000003',
          dispatched_at: '2026-09-10T09:00:00+00:00',
          dispatched_by: { id: 2, name: 'Night Guard' },
          notes: null,
        },
      }),
    );
    renderVerification();

    expect(await screen.findByText('DISPATCHED')).toBeInTheDocument();
    expect(screen.getByText(/Night Guard/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dispatch order' })).not.toBeInTheDocument();
  });

  it('explains when an order is not in the yard', async () => {
    securityApi.getOrder.mockRejectedValue(new ApiError({ status: 404, message: 'The requested resource was not found.' }));
    renderVerification(99);

    expect(await screen.findByText('This order is not in the yard')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dispatch order' })).not.toBeInTheDocument();
  });
});
