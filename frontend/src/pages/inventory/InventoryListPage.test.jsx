import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, buildUser } from '@/test/test-utils';
import { ApiError } from '@/utils/errors';
import InventoryListPage from './InventoryListPage';

vi.mock('@/services/api', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
  inventoryApi: { list: vi.fn() },
  categoriesApi: { list: vi.fn().mockResolvedValue({ rows: [], meta: null }) },
}));

import { authApi, inventoryApi } from '@/services/api';

async function renderPage() {
  authApi.me.mockResolvedValueOnce(buildUser());
  renderWithProviders(<InventoryListPage />, { route: '/inventory' });
}

describe('InventoryListPage', () => {
  it('shows the error state instead of a blank page when the list request fails', async () => {
    inventoryApi.list.mockRejectedValueOnce(
      new ApiError({ status: 500, message: 'An unexpected error occurred. Please try again.' }),
    );
    await renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('An unexpected error occurred. Please try again.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows the empty state when the list request succeeds with no rows', async () => {
    inventoryApi.list.mockResolvedValueOnce({
      rows: [],
      meta: { units_on_hand: 0, needs_attention: 0, status_counts: { all: 0, in: 0, low: 0, out: 0 } },
    });
    await renderPage();

    expect(await screen.findByText('No spare parts match this view')).toBeInTheDocument();
  });
});
