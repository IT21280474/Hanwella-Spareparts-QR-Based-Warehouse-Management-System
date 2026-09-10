import './Tabs.css';

/**
 * Underlined filter tabs with optional counts — used above every operational
 * list (inventory status, order payment state, movement type, reports).
 */
export function Tabs({ tabs, value, onChange, label = 'Filter', className = '' }) {
  return (
    <div className={['tabs', className].filter(Boolean).join(' ')} role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={['tabs__tab', active ? 'is-active' : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {tab.count !== undefined && tab.count !== null ? (
              <span className="tabs__count">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Pill segmented control: the active option is a raised white chip on a grey
 * track. Used for status filters and the checkout payment state.
 */
export function SegmentedControl({ options, value, onChange, label, size = 'md', className = '' }) {
  return (
    <div
      className={['segmented', `segmented--${size}`, className].filter(Boolean).join(' ')}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={['segmented__option', active ? 'is-active' : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(option.value)}
          >
            <span className="segmented__label">
              {option.label}
              {option.count !== undefined ? <span className="segmented__count"> {option.count}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
