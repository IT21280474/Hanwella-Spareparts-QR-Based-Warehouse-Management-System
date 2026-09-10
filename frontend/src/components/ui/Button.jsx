import { forwardRef } from 'react';
import { Spinner } from './Spinner';
import './Button.css';

/**
 * The one button.
 *
 * `variant` chooses the visual weight, `size` the control height. A button in
 * `loading` state stays mounted at the same width and is disabled, so a form
 * cannot be submitted twice by an impatient double click.
 */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    type = 'button',
    loading = false,
    disabled = false,
    icon: Icon = null,
    iconAfter: IconAfter = null,
    fullWidth = false,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? 'btn--block' : '',
    loading ? 'is-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : Icon ? <Icon size={15} strokeWidth={1.8} aria-hidden="true" /> : null}
      {children ? <span className="btn__label">{children}</span> : null}
      {!loading && IconAfter ? <IconAfter size={15} strokeWidth={1.8} aria-hidden="true" /> : null}
    </button>
  );
});
