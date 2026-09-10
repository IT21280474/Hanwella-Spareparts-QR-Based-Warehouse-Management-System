import './Spinner.css';

/** Inline activity indicator. Decorative — the surrounding control owns the label. */
export function Spinner({ size = 16, tone = 'currentColor', className = '' }) {
  return (
    <span
      className={['spinner', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, borderColor: 'transparent', borderTopColor: tone, borderRightColor: tone }}
      aria-hidden="true"
    />
  );
}
