import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui';
import { percent, pluralize } from '@/utils/format';
import './TopParts.css';

/** Top five parts by units sold, with proportional bars. */
export function TopParts({ parts = [] }) {
  if (parts.length === 0) {
    return <EmptyState compact title="No units sold yet" description="Ranking appears after the first sale." />;
  }

  const peak = Math.max(1, ...parts.map((part) => Number(part.units) || 0));

  return (
    <ol className="top-parts">
      {parts.map((part, index) => (
        <li key={part.part_id ?? index} className="top-parts__row">
          <span className="top-parts__rank mono">{String(index + 1).padStart(2, '0')}</span>
          <span className="top-parts__body">
            <Link to={`/inventory/${part.part_id}`} className="top-parts__name">
              {part.name}
            </Link>
            <span className="top-parts__track" aria-hidden="true">
              <span className="top-parts__fill" style={{ width: `${percent(part.units, peak)}%` }} />
            </span>
          </span>
          <span className="top-parts__units num">{pluralize(part.units, 'unit')}</span>
        </li>
      ))}
    </ol>
  );
}
