import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { renderWithProviders, buildUser } from '@/test/test-utils';
import { ApiError } from '@/utils/errors';
import ScannerPage from './ScannerPage';

// vi.mock is hoisted above every import/const in this file, so the factory
// cannot close over a normal top-level `const` — vi.hoisted runs first and
// hands the factory a value that already exists by the time it's needed.
const { hasCamera } = vi.hoisted(() => ({ hasCamera: vi.fn().mockResolvedValue(false) }));

vi.mock('qr-scanner', () => ({
  default: class MockQrScanner {
    static hasCamera = hasCamera;
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn();
    destroy = vi.fn();
    hasFlash = vi.fn().mockResolvedValue(false);
    toggleFlash = vi.fn();
  },
}));

vi.mock('@/store/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), fromError: vi.fn() },
}));

vi.mock('@/services/api', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
  qrApi: { scan: vi.fn(), recentScans: vi.fn().mockResolvedValue([]) },
}));

import { authApi, qrApi } from '@/services/api';
import { toast } from '@/store/toastStore';

async function renderScanner() {
  authApi.me.mockResolvedValueOnce(buildUser());
  renderWithProviders(<ScannerPage />, { route: '/scan' });
  // The camera check resolves false, driving cameraState to 'unavailable'.
  expect(await screen.findByText('No camera on this device')).toBeInTheDocument();
}

describe('ScannerPage', () => {
  it('shows the camera-unavailable state and an empty result panel on load', async () => {
    await renderScanner();
    expect(screen.getByText('Nothing scanned yet')).toBeInTheDocument();
  });

  it('resolves a manually entered code to a part', async () => {
    qrApi.scan.mockResolvedValueOnce({
      part: {
        id: 1, name: 'Wheel Cylinder - Suzuki Every', part_number: 'BRK-SUZ-3361',
        qr_code: 'SJL-00001', quantity: 58, selling_price: 24000, min_stock: 13, bin: 'A-04-2',
      },
    });
    const user = userEvent.setup();
    await renderScanner();

    await user.type(screen.getByLabelText('Enter a QR code manually'), 'SJL-00001');
    await user.click(screen.getByRole('button', { name: 'Look up' }));

    // The name legitimately appears twice once resolved — once in the Result
    // panel, once in "Recent scans" (the page calls `remember(part)` on every
    // successful lookup) — so identify the Result panel by its unique meta line.
    expect(await screen.findByText('BRK-SUZ-3361 · SJL-00001')).toBeInTheDocument();
    expect(screen.getAllByText('Wheel Cylinder - Suzuki Every').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Add to order' })).toBeInTheDocument();
    expect(qrApi.scan).toHaveBeenCalledWith('SJL-00001');
  });

  it('shows the not-found state for a code with no matching part', async () => {
    qrApi.scan.mockRejectedValueOnce(new ApiError({ status: 404, message: 'No spare part is linked to that code.' }));
    const user = userEvent.setup();
    await renderScanner();

    await user.type(screen.getByLabelText('Enter a QR code manually'), 'SJL-99999');
    await user.click(screen.getByRole('button', { name: 'Look up' }));

    expect(await screen.findByText('That code is not in the system')).toBeInTheDocument();
    expect(screen.getByText(/SJL-99999/)).toBeInTheDocument();
  });

  it('toasts and keeps the empty state for a server error that is not a 404', async () => {
    qrApi.scan.mockRejectedValueOnce(new ApiError({ status: 500, message: 'An unexpected error occurred.' }));
    const user = userEvent.setup();
    await renderScanner();

    await user.type(screen.getByLabelText('Enter a QR code manually'), 'SJL-00002');
    await user.click(screen.getByRole('button', { name: 'Look up' }));

    await screen.findByText('Nothing scanned yet');
    expect(toast.fromError).toHaveBeenCalled();
  });
});
