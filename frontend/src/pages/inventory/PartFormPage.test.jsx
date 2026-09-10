import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '@/context/AuthContext';
import { buildUser } from '@/test/test-utils';
import { ApiError } from '@/utils/errors';
import PartFormPage from './PartFormPage';

vi.mock('@/services/api', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
  partsApi: { get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), movements: vi.fn() },
  categoriesApi: { list: vi.fn().mockResolvedValue({ rows: [], meta: null }) },
  suppliersApi: { list: vi.fn().mockResolvedValue({ rows: [], meta: null }) },
}));

import { authApi, partsApi } from '@/services/api';

function renderCreateForm() {
  authApi.me.mockResolvedValueOnce(buildUser());
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/inventory/new']}>
        <AuthProvider>
          <Routes>
            <Route path="/inventory/new" element={<PartFormPage mode="create" />} />
            <Route path="/inventory/:id" element={<p>Part detail page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PartFormPage (create)', () => {
  it('renders the required identity and pricing fields', async () => {
    renderCreateForm();
    expect(await screen.findByLabelText('Part name', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Part number', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Selling price', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Opening stock', { exact: false })).toBeInTheDocument();
  });

  it('shows inline validation errors instead of submitting when required fields are missing', async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.click(await screen.findByRole('button', { name: 'Add spare part' }));

    expect(await screen.findByText('Give the part a recognisable name')).toBeInTheDocument();
    expect(screen.getByText('Part number is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a selling price')).toBeInTheDocument();
    expect(partsApi.create).not.toHaveBeenCalled();
  });

  it('submits a valid part and navigates to its detail page', async () => {
    partsApi.create.mockResolvedValueOnce({
      part: { id: 241, name: 'Brake Pad Set', qr_code: 'SJL-00241' },
      message: 'Spare part created successfully.',
    });
    const user = userEvent.setup();
    renderCreateForm();

    await user.type(await screen.findByLabelText('Part name', { exact: false }), 'Brake Pad Set');
    await user.type(screen.getByLabelText('Part number', { exact: false }), '04465-0K260');
    await user.type(screen.getByLabelText('Selling price', { exact: false }), '4500');
    await user.clear(screen.getByLabelText('Opening stock', { exact: false }));
    await user.type(screen.getByLabelText('Opening stock', { exact: false }), '20');

    await user.click(screen.getByRole('button', { name: 'Add spare part' }));

    expect(await screen.findByText('Part detail page')).toBeInTheDocument();
    expect(partsApi.create).toHaveBeenCalledTimes(1);
    const payload = partsApi.create.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: 'Brake Pad Set',
      part_number: '04465-0K260',
      selling_price: 4500,
      quantity: 20,
    });
  });

  it('maps a server-side uniqueness error onto the part number field', async () => {
    partsApi.create.mockRejectedValueOnce(
      new ApiError({
        status: 422,
        message: 'Validation failed.',
        errors: { part_number: ['That part number is already in use.'] },
      }),
    );
    const user = userEvent.setup();
    renderCreateForm();

    await user.type(await screen.findByLabelText('Part name', { exact: false }), 'Brake Pad Set');
    await user.type(screen.getByLabelText('Part number', { exact: false }), '04465-0K260');
    await user.type(screen.getByLabelText('Selling price', { exact: false }), '4500');
    await user.clear(screen.getByLabelText('Opening stock', { exact: false }));
    await user.type(screen.getByLabelText('Opening stock', { exact: false }), '20');

    await user.click(screen.getByRole('button', { name: 'Add spare part' }));

    expect(await screen.findByText('That part number is already in use.')).toBeInTheDocument();
  });
});
