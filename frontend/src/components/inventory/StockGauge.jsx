import { percent } from '@/utils/format';
import { stockStatus } from '@/utils/status';
import { STOCK_STATUS } from '@/constants/options';
import './StockGauge.css';

const TONE = {
  [STOCK_STATUS.OUT]: 'var(--color-danger)',
  [STOCK_STATUS.LOW]: 'var(--color-warning)',
  [STOCK_STATUS.IN]: 'var(--color-success)',
};

/**
 * Stock level against the minimum.
 *
 * The bar is scaled to four times the minimum, which is the point past which
 * "more stock" stops being useful information at a glance.
 */
export function StockGauge({ part }) {
  const minimum = Number(part?.min_stock ?? 0);
  const ceiling = Math.max(minimum * 4, 1);
  const status = stockStatus(part);

  return (
    <div className="gauge">
      <div className="gauge__track">
        <span
          className="gauge__fill"
          style={{ width: `${percent(part?.quantity, ceiling)}%`, background: TONE[status] }}
        />
        {minimum > 0 ? (
          <span className="gauge__minimum" style={{ left: `${percent(minimum, ceiling)}%` }} aria-hidden="true" />
        ) : null}
      </div>
      <div className="gauge__legend">
        <span>0</span>
        <span>Minimum {minimum}</span>
        <span>{ceiling}</span>
      </div>
    </div>
  );
}
