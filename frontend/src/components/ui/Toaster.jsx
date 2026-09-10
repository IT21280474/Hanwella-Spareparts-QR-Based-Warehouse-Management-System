import { createPortal } from 'react-dom';
import { Check, Info, TriangleAlert, X } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';
import './Toaster.css';

const ICON = {
  ok: Check,
  err: X,
  warn: TriangleAlert,
  info: Info,
};

/**
 * Bottom-right notification stack.
 *
 * `role="status"` on a polite live region: a warehouse user is looking at the
 * scanner, not at the corner of the screen, so confirmations are announced
 * without stealing focus.
 */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toaster" role="status" aria-live="polite" data-noprint>
      {toasts.map((item) => {
        const Icon = ICON[item.kind] || Check;
        return (
          <div key={item.id} className={`toast toast--${item.kind}`}>
            <span className="toast__mark" aria-hidden="true">
              <Icon size={12} strokeWidth={3} />
            </span>
            <div className="toast__content">
              <p className="toast__title">{item.title}</p>
              {item.body ? <p className="toast__body">{item.body}</p> : null}
            </div>
            <button
              type="button"
              className="toast__close"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
            >
              <X size={13} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
