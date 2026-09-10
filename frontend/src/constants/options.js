/** Enumerations shared between forms, filters and table renderers. */

export const STOCK_STATUS = {
  IN: 'in',
  LOW: 'low',
  OUT: 'out',
};

export const STOCK_STATUS_LABEL = {
  [STOCK_STATUS.IN]: 'In stock',
  [STOCK_STATUS.LOW]: 'Low stock',
  [STOCK_STATUS.OUT]: 'Out of stock',
};

/** Filter tabs above the inventory table. */
export const STOCK_STATUS_TABS = [
  { value: 'All', label: 'All' },
  { value: STOCK_STATUS.IN, label: 'In stock' },
  { value: STOCK_STATUS.LOW, label: 'Low' },
  { value: STOCK_STATUS.OUT, label: 'Out' },
];

export const PAYMENT_STATUS = {
  PAID: 'PAID',
  PENDING: 'PENDING',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  CANCELLED: 'CANCELLED',
};

export const PAYMENT_STATUS_LABEL = {
  [PAYMENT_STATUS.PAID]: 'Paid',
  [PAYMENT_STATUS.PENDING]: 'Pending',
  [PAYMENT_STATUS.PARTIALLY_PAID]: 'Partially paid',
  [PAYMENT_STATUS.CANCELLED]: 'Cancelled',
};

/** Payment states a cashier may select while finalising a sale. */
export const CHECKOUT_PAYMENT_STATUSES = [
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.PENDING,
  PAYMENT_STATUS.PARTIALLY_PAID,
];

export const PAYMENT_MODE = {
  CASH: 'CASH',
  CARD: 'CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CREDIT: 'CREDIT',
};

export const PAYMENT_MODE_LABEL = {
  [PAYMENT_MODE.CASH]: 'Cash',
  [PAYMENT_MODE.CARD]: 'Card',
  [PAYMENT_MODE.BANK_TRANSFER]: 'Bank transfer',
  [PAYMENT_MODE.CREDIT]: 'Credit',
};

export const MOVEMENT_TYPE = {
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  ADJUSTMENT: 'ADJUSTMENT',
  TRANSFER: 'TRANSFER',
  RETURN: 'RETURN',
  SALE: 'SALE',
};

export const MOVEMENT_TYPE_LABEL = {
  [MOVEMENT_TYPE.STOCK_IN]: 'Stock received',
  [MOVEMENT_TYPE.STOCK_OUT]: 'Stock issued',
  [MOVEMENT_TYPE.ADJUSTMENT]: 'Manual adjustment',
  [MOVEMENT_TYPE.TRANSFER]: 'Transfer',
  [MOVEMENT_TYPE.RETURN]: 'Return',
  [MOVEMENT_TYPE.SALE]: 'Sale',
};

/** Adjustment reasons, preserved verbatim from the reference. */
export const ADJUSTMENT_TYPE = {
  STOCK_RECEIVED: 'STOCK_RECEIVED',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
  SALE_CORRECTION: 'SALE_CORRECTION',
  DAMAGE_WRITE_OFF: 'DAMAGE_WRITE_OFF',
};

export const ADJUSTMENT_TYPE_LABEL = {
  [ADJUSTMENT_TYPE.STOCK_RECEIVED]: 'Stock received',
  [ADJUSTMENT_TYPE.MANUAL_ADJUSTMENT]: 'Manual adjustment',
  [ADJUSTMENT_TYPE.SALE_CORRECTION]: 'Sale correction',
  [ADJUSTMENT_TYPE.DAMAGE_WRITE_OFF]: 'Damage / write-off',
};

/** Adjustment reasons that subtract rather than add. */
export const NEGATIVE_ADJUSTMENT_TYPES = [
  ADJUSTMENT_TYPE.SALE_CORRECTION,
  ADJUSTMENT_TYPE.DAMAGE_WRITE_OFF,
];

export const PART_STATUS = {
  ACTIVE: 'ACTIVE',
  DISCONTINUED: 'DISCONTINUED',
};

export const PART_STATUS_LABEL = {
  [PART_STATUS.ACTIVE]: 'Active',
  [PART_STATUS.DISCONTINUED]: 'Discontinued',
};

/** QR label sheet layouts offered by the API (`config/wms.php`). */
export const QR_LAYOUTS = [
  { value: 'A4_4x10', label: 'A4 · 4 × 10 (40 labels)', columns: 4, perSheet: 40 },
  { value: 'A4_3x8', label: 'A4 · 3 × 8 (24 labels)', columns: 3, perSheet: 24 },
  { value: 'A4_5x13', label: 'A4 · 5 × 13 (65 labels)', columns: 5, perSheet: 65 },
];

export const QR_BATCH_WARNING_THRESHOLD = 80;
export const QR_MAX_BATCH = 200;

/** Helper for <Select> — turns a value→label map into option objects. */
export const toOptions = (map) =>
  Object.entries(map).map(([value, label]) => ({ value, label }));
