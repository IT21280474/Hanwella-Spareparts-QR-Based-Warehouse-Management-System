import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApiError } from '@/utils/errors';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('shows a network-specific heading and offers a retry', () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new ApiError({ code: 'network', message: 'Cannot reach the server. Check your connection and try again.' })} onRetry={onRetry} />);

    expect(screen.getByText('Cannot reach the server')).toBeInTheDocument();
    expect(screen.getByText('Cannot reach the server. Check your connection and try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('never offers a retry for a 403, even when onRetry is given', () => {
    render(<ErrorState error={new ApiError({ status: 403, message: 'You do not have permission to do that.' })} onRetry={vi.fn()} />);

    expect(screen.getByText('You do not have access to this')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('never offers a retry for a 404', () => {
    render(<ErrorState error={new ApiError({ status: 404, message: 'The requested record could not be found.' })} onRetry={vi.fn()} />);

    expect(screen.getByText('Not found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('lets a custom title override the default heading', () => {
    render(<ErrorState error={new ApiError({ status: 500, message: 'boom' })} title="Could not load the dashboard" />);
    expect(screen.getByText('Could not load the dashboard')).toBeInTheDocument();
  });

  it('omits the retry action when no onRetry handler is passed', () => {
    render(<ErrorState error={new ApiError({ status: 500, message: 'boom' })} />);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders a title and description', () => {
    render(<EmptyState title="No stock movements yet." description="Movements appear here once stock changes." />);
    expect(screen.getByText('No stock movements yet.')).toBeInTheDocument();
    expect(screen.getByText('Movements appear here once stock changes.')).toBeInTheDocument();
  });

  it('renders the actions slot when provided', () => {
    render(<EmptyState title="No suppliers found." actions={<button type="button">Add supplier</button>} />);
    expect(screen.getByRole('button', { name: 'Add supplier' })).toBeInTheDocument();
  });

  it('omits the actions slot when none is provided', () => {
    render(<EmptyState title="No QR scan history." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
