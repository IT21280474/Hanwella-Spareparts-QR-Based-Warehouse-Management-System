import { Search, X } from 'lucide-react';
import './SearchInput.css';

/**
 * Search box with a leading glyph and a clear affordance.
 *
 * Debouncing is the caller's job — it owns the query that reaches the API.
 */
export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Search',
  label = 'Search',
  size = 'sm',
  className = '',
  ...rest
}) {
  return (
    <div className={['search', `search--${size}`, className].filter(Boolean).join(' ')}>
      <Search className="search__icon" size={15} strokeWidth={1.8} aria-hidden="true" />
      <input
        type="search"
        className="search__input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        {...rest}
      />
      {value ? (
        <button
          type="button"
          className="search__clear"
          onClick={() => (onClear ? onClear() : onChange(''))}
          aria-label="Clear search"
        >
          <X size={13} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
