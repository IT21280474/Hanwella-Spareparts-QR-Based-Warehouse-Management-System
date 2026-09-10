import { useId } from 'react';
import './Field.css';

/**
 * Label + control + message wrapper.
 *
 * Wires the generated id, `aria-describedby` and `aria-invalid` for whatever
 * control is passed as a child, so every form field is announced correctly
 * without each page repeating the plumbing.
 */
export function Field({ label, hint, error, required = false, htmlFor, children, className = '' }) {
  const generatedId = useId();
  const id = htmlFor || generatedId;
  const messageId = `${id}-message`;

  return (
    <div className={['field', error ? 'field--invalid' : '', className].filter(Boolean).join(' ')}>
      {label ? (
        <label className="field__label" htmlFor={id}>
          {label}
          {required ? (
            <span className="field__required" aria-hidden="true">
              {' *'}
            </span>
          ) : null}
        </label>
      ) : null}

      {typeof children === 'function'
        ? children({
            id,
            invalid: !!error,
            'aria-describedby': error || hint ? messageId : undefined,
          })
        : children}

      {error ? (
        <p className="field__error" id={messageId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={messageId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
