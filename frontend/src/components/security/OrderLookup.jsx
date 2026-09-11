import { useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Ban, Camera, Info, ScanLine, Search } from 'lucide-react';
import { useOrderLookup } from '@/hooks/queries/useSecurity';
import { Button } from '@/components/ui';
import { toApiError } from '@/utils/errors';
import { formatDateTime } from '@/utils/format';
import { ScanOrderModal } from './ScanOrderModal';
import './OrderLookup.css';

const OUTCOME_ICON = { warning: AlertTriangle, danger: Ban, info: Info };

/**
 * The gate's primary control: type or scan an order number and the server
 * decides whether it may leave.
 *
 * A handheld barcode scanner "types" the number and presses Enter, so the
 * input keeps focus and submits on Enter; a phone or tablet can instead point
 * its camera at the QR code printed on the customer's bill. Either way the
 * number goes to the server — nothing is matched against rows already on
 * screen.
 */
export function OrderLookup({ autoFocus = true, size = 'lg' }) {
  const [value, setValue] = useState('');
  const [outcome, setOutcome] = useState(null);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef(null);
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const navigate = useNavigate();
  const lookup = useOrderLookup();

  const refocus = () => {
    // Leave the number selected so the next scan or keystroke replaces it.
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const run = (raw) => {
    const orderNo = String(raw ?? '')
      .trim()
      .toUpperCase();

    if (!orderNo) {
      setOutcome({
        tone: 'warning',
        title: 'Enter an order number',
        body: 'Type it from the customer’s bill, or scan the QR code printed on it.',
      });
      inputRef.current?.focus();
      return;
    }

    setValue(orderNo);
    setOutcome(null);

    lookup.mutate(orderNo, {
      onSuccess: ({ order, eligible, reason }) => {
        if (eligible) {
          navigate(`/security/orders/${order.id}`);
          return;
        }

        const released = order.dispatch;
        setOutcome({
          tone: 'info',
          title: reason || 'This order has already been dispatched.',
          body: released
            ? `${order.order_no} left the yard on ${formatDateTime(released.dispatched_at)}, released by ${released.dispatched_by?.name ?? 'Security'} (${released.dispatch_no}). Do not release goods for it again.`
            : `${order.order_no} has already left the yard. Do not release goods for it again.`,
          link: { to: `/security/orders/${order.id}`, label: 'View dispatch record' },
        });
        refocus();
      },
      onError: (error) => {
        const apiError = toApiError(error);

        if (apiError.isNotFound) {
          setOutcome({ tone: 'warning', title: 'Order not found', body: apiError.message });
        } else if (apiError.isConflict) {
          setOutcome({
            tone: 'danger',
            title: 'Not cleared to leave the yard',
            body: `${apiError.message} Send the customer back to the cashier.`,
          });
        } else if (apiError.isValidation) {
          setOutcome({ tone: 'warning', title: 'Check the number', body: apiError.fieldError('order_no') || apiError.message });
        } else {
          setOutcome({ tone: 'danger', title: 'Lookup failed', body: apiError.message });
        }
        refocus();
      },
    });
  };

  const onSubmit = (event) => {
    event.preventDefault();
    run(value);
  };

  const OutcomeIcon = outcome ? OUTCOME_ICON[outcome.tone] || Info : null;

  return (
    <>
      <form className={`lookup lookup--${size}`} onSubmit={onSubmit} noValidate role="search">
        <label className="lookup__label" htmlFor={inputId}>
          Order number
        </label>

        <div className="lookup__row">
          <div className="lookup__field">
            <ScanLine className="lookup__glyph" size={size === 'lg' ? 22 : 18} strokeWidth={1.7} aria-hidden="true" />
            <input
              ref={inputRef}
              id={inputId}
              className="lookup__input mono"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (outcome) setOutcome(null);
              }}
              placeholder="SO-2026-0123"
              autoFocus={autoFocus}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              maxLength={40}
              aria-describedby={hintId}
              aria-invalid={outcome && outcome.tone !== 'info' ? true : undefined}
            />
          </div>

          <div className="lookup__actions">
            <Button type="submit" size="lg" icon={Search} loading={lookup.isPending} className="lookup__submit">
              Verify
            </Button>
            <Button type="button" size="lg" variant="secondary" icon={Camera} onClick={() => setScanning(true)}>
              Scan bill
            </Button>
          </div>
        </div>

        <p className="lookup__hint" id={hintId}>
          Type or scan the order number on the customer’s bill, then press Enter. The server checks payment before
          anything is shown.
        </p>

        {outcome ? (
          <div className={`lookup__outcome lookup__outcome--${outcome.tone}`} role="alert">
            <OutcomeIcon className="lookup__outcome-icon" size={18} strokeWidth={2} aria-hidden="true" />
            <div className="lookup__outcome-text">
              <p className="lookup__outcome-title">{outcome.title}</p>
              <p className="lookup__outcome-body">{outcome.body}</p>
              {outcome.link ? (
                <Link to={outcome.link.to} className="lookup__outcome-link">
                  {outcome.link.label}
                  <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </form>

      <ScanOrderModal
        open={scanning}
        onClose={() => setScanning(false)}
        onDetected={(code) => {
          setScanning(false);
          run(code);
        }}
      />
    </>
  );
}
