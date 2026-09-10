import { Skeleton } from './Skeleton';
import './StatTile.css';

/**
 * Dashboard KPI tile: label, value, sub-label and a tinted trend chip.
 * `tone` colours the value when the number itself is the warning.
 */
export function StatTile({ label, value, sub, chip, chipTone = 'neutral', tone = 'ink', loading = false }) {
  return (
    <article className="stat">
      <p className="stat__label">{label}</p>

      <div className="stat__row">
        {loading ? (
          <Skeleton width={72} height={22} />
        ) : (
          <p className={`stat__value stat__value--${tone}`}>{value}</p>
        )}
        {chip && !loading ? <span className={`stat__chip stat__chip--${chipTone}`}>{chip}</span> : null}
      </div>

      {loading ? <Skeleton width="60%" height={11} /> : sub ? <p className="stat__sub">{sub}</p> : null}
    </article>
  );
}

/** Responsive KPI row — intrinsic, so it reflows without breakpoints. */
export function StatGrid({ min = 168, children }) {
  return (
    <div className="stat-grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}>
      {children}
    </div>
  );
}
