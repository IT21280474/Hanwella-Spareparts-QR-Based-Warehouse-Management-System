import { forwardRef } from 'react';
import './Input.css';

export const Input = forwardRef(function Input(
  { size = 'md', invalid = false, mono = false, prefix = null, className = '', ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      className={[
        'input',
        `input--${size}`,
        invalid ? 'is-invalid' : '',
        mono ? 'mono' : '',
        prefix ? 'input--with-prefix' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );

  if (!prefix) return input;

  return (
    <span className="input-wrap">
      <span className="input-wrap__prefix" aria-hidden="true">
        {prefix}
      </span>
      {input}
    </span>
  );
});

export const Textarea = forwardRef(function Textarea(
  { invalid = false, rows = 3, className = '', ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={['input', 'input--area', invalid ? 'is-invalid' : '', className]
        .filter(Boolean)
        .join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export const Select = forwardRef(function Select(
  { size = 'md', invalid = false, options = [], placeholder, className = '', children, ...rest },
  ref,
) {
  return (
    <span className={`select-wrap select-wrap--${size}`}>
      <select
        ref={ref}
        className={['input', 'select', `input--${size}`, invalid ? 'is-invalid' : '', className]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <svg
        className="select-wrap__chevron"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
});
