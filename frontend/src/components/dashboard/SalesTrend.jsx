import { formatDate, money, relativeDays } from '@/utils/format';
import { EmptyState } from '@/components/ui';
import './SalesTrend.css';

const MAX_BAR = 140;
const MIN_BAR = 3;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Fourteen-day sales bar trend.
 *
 * Bars are sized against the tallest day so the shape of the fortnight reads
 * at a glance; today is picked out in the link green.
 */
export function SalesTrend({ days = [] }) {
  if (days.length === 0) {
    return <EmptyState compact title="No sales recorded yet" description="Finalised orders appear here." />;
  }

  const peak = Math.max(1, ...days.map((day) => Number(day.total) || 0));

  return (
    <div className="trend">
      <div className="trend__bars">
        {days.map((day) => {
          const total = Number(day.total) || 0;
          const isToday = relativeDays(day.date) === 'Today';
          const height = Math.max(MIN_BAR, Math.round((total / peak) * MAX_BAR));

          return (
            <div key={day.date} className="trend__column">
              <div
                className={['trend__bar', isToday ? 'is-today' : ''].filter(Boolean).join(' ')}
                style={{ height }}
                title={`${formatDate(day.date)} · ${money(total)} · ${day.orders} orders`}
              />
              <span className="trend__label">
                {isToday ? 'Today' : DAY_LABELS[new Date(day.date).getDay()]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
