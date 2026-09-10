import { STOCK_STATUS, STOCK_STATUS_LABEL, PAYMENT_STATUS, PAYMENT_STATUS_LABEL } from '@/constants/options';

/**
 * Derive the stock status of a part from its on-hand quantity and minimum
 * level. The same rule runs server-side; this copy exists so a row can be
 * styled without a second round trip.
 */
export function stockStatus(part) {
  const quantity = Number(part?.quantity ?? 0);
  const minimum = Number(part?.min_stock ?? 0);
  if (quantity <= 0) return STOCK_STATUS.OUT;
  if (quantity <= minimum) return STOCK_STATUS.LOW;
  return STOCK_STATUS.IN;
}

export function stockStatusLabel(part) {
  return STOCK_STATUS_LABEL[stockStatus(part)];
}

/** Badge tone name consumed by <Badge tone="...">. */
export function stockStatusTone(part) {
  const status = stockStatus(part);
  if (status === STOCK_STATUS.OUT) return 'danger';
  if (status === STOCK_STATUS.LOW) return 'warning';
  return 'success';
}

/** Quantity text colour: neutral when healthy, amber low, red out. */
export function stockQuantityTone(part) {
  const status = stockStatus(part);
  if (status === STOCK_STATUS.OUT) return 'var(--color-danger)';
  if (status === STOCK_STATUS.LOW) return 'var(--color-warning)';
  return 'var(--color-ink)';
}

/** `None on hand` / `24 left` */
export function stockLabel(part) {
  const quantity = Number(part?.quantity ?? 0);
  return quantity <= 0 ? 'None on hand' : `${quantity.toLocaleString('en-US')} left`;
}

export function paymentTone(status) {
  switch (status) {
    case PAYMENT_STATUS.PAID:
      return 'success';
    case PAYMENT_STATUS.PENDING:
      return 'warning';
    case PAYMENT_STATUS.PARTIALLY_PAID:
      return 'info';
    case PAYMENT_STATUS.CANCELLED:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function paymentLabel(status) {
  return PAYMENT_STATUS_LABEL[status] ?? status ?? '—';
}

/** Movement deltas: additions read green, removals red. */
export function deltaTone(delta) {
  return Number(delta) > 0 ? 'success' : 'danger';
}
