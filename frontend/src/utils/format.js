import { CURRENCY } from '@/constants';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** `Rs 12,450` — rounded, grouped, with the configured currency symbol. */
export function money(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${CURRENCY} 0`;
  return `${CURRENCY} ${Math.round(value).toLocaleString('en-US')}`;
}

/**
 * `Rs 250,000.00` — to the cent. For figures someone acts on at the yard gate,
 * where rounding a Rs 0.40 balance down to "Rs 0" would misstate it.
 */
export function moneyExact(amount) {
  const value = Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  return `${CURRENCY} ${safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact form for KPI tiles: 1.24M / 86K / 940. */
export function shortNumber(amount) {
  const value = Number(amount) || 0;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

/** Compact money for KPI tiles: `Rs 1.24M`. */
export function shortMoney(amount) {
  return `${CURRENCY} ${shortNumber(amount)}`;
}

/** Thousands-separated integer. */
export function number(value) {
  return (Number(value) || 0).toLocaleString('en-US');
}

/** `07 Sep 2026` */
export function formatDate(value) {
  const date = toDate(value);
  if (!date) return '—';
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** `07 Sep 2026 · 15:40` */
export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  return `${formatDate(date)} · ${formatTime(date)}`;
}

/** `15:40` */
export function formatTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Whole days between `value` and now, never negative. */
export function daysSince(value) {
  const date = toDate(value);
  if (!date) return null;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = startOfDay(new Date()) - startOfDay(date);
  return Math.max(0, Math.round(diff / 86_400_000));
}

/** `Today` / `Yesterday` / `12d ago` */
export function relativeDays(value) {
  const days = daysSince(value);
  if (days === null) return '—';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

/** `Today 15:12` — used in user activity lists. */
export function relativeDateTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  const days = daysSince(date);
  return days <= 1 ? `${relativeDays(date)} ${formatTime(date)}` : relativeDays(date);
}

/** `1 line item` / `3 line items` */
export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** `+3` / `−2` — signed quantity delta using a true minus sign. */
export function signed(value) {
  const n = Number(value) || 0;
  if (n > 0) return `+${n.toLocaleString('en-US')}`;
  if (n < 0) return `−${Math.abs(n).toLocaleString('en-US')}`;
  return '0';
}

/** Percentage of `part` within `whole`, clamped to 0–100. */
export function percent(part, whole) {
  const total = Number(whole) || 0;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(part) || 0) / total * 100)));
}

/** Initials for an avatar tile: "Sadeeka Perera" -> "SP". */
export function initialsOf(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}
