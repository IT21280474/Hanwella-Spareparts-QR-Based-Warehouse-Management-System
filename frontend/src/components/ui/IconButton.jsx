import { forwardRef } from 'react';
import './IconButton.css';

/**
 * A square icon-only control. `label` is required — it becomes both the
 * tooltip and the accessible name, so the button is never a mystery glyph to a
 * screen reader.
 */
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'outline', size = 29, type = 'button', className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      title={label}
      aria-label={label}
      className={['icon-btn', `icon-btn--${variant}`, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon size={Math.round(size * 0.52)} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
});
