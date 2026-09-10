import { AlertTriangle, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import { Button } from './Button';
import { toApiError } from '@/utils/errors';
import './ErrorState.css';

/**
 * Failure panel for a region that could not load.
 *
 * The user never gets a blank page: the cause is named, and where a retry can
 * help, it is offered.
 */
export function ErrorState({ error, onRetry, compact = false, title }) {
  const apiError = toApiError(error);

  const Icon = apiError.isNetwork ? WifiOff : apiError.isForbidden ? ShieldAlert : AlertTriangle;

  const heading =
    title ||
    (apiError.isNetwork
      ? 'Cannot reach the server'
      : apiError.isForbidden
        ? 'You do not have access to this'
        : apiError.isNotFound
          ? 'Not found'
          : 'Could not load this');

  // Retrying a 403 or a 404 just repeats the same answer.
  const retryable = onRetry && !apiError.isForbidden && !apiError.isNotFound;

  return (
    <div className={['error-state', compact ? 'error-state--compact' : ''].filter(Boolean).join(' ')} role="alert">
      <div className="error-state__icon" aria-hidden="true">
        <Icon size={compact ? 18 : 22} strokeWidth={1.7} />
      </div>
      <p className="error-state__title">{heading}</p>
      <p className="error-state__message">{apiError.message}</p>
      {retryable ? (
        <div className="error-state__actions">
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
