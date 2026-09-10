import './Badge.css';

/**
 * Status pill. `tone` selects one of the fixed status colour pairs; `dot` adds
 * the leading marker used in table status cells.
 */
export function Badge({ tone = 'neutral', dot = false, size = 'md', className = '', children }) {
  return (
    <span className={['badge', `badge--${tone}`, `badge--${size}`, className].filter(Boolean).join(' ')}>
      {dot ? <span className="badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
