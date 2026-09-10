import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui';
import { formatTime, money, pluralize, relativeDays } from '@/utils/format';
import { paymentLabel } from '@/utils/status';
import { PAYMENT_STATUS } from '@/constants/options';
import './ActivityFeed.css';

/** Recent counter activity: one row per finalised order. */
export function ActivityFeed({ orders = [] }) {
  if (orders.length === 0) {
    return (
      <EmptyState compact title="No orders yet today" description="Counter sales show up here as they are finalised." />
    );
  }

  return (
    <ul className="activity">
      {orders.map((order) => {
        const settled = order.payment_status === PAYMENT_STATUS.PAID;
        return (
          <li key={order.id}>
            <Link to={`/orders/${order.id}`} className="activity__row">
              <span className={['activity__mark', settled ? 'is-paid' : 'is-open'].join(' ')} aria-hidden="true">
                {order.items_count ?? order.items?.length ?? 0}x
              </span>
              <span className="activity__body">
                <span className="activity__text">
                  {order.order_no} · {money(order.total)} · {order.customer_name}
                </span>
                <span className="activity__meta">
                  {order.cashier?.name || 'Counter'} · {relativeDays(order.ordered_at)}{' '}
                  {formatTime(order.ordered_at)} · {paymentLabel(order.payment_status)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Low and out-of-stock watchlist. */
export function Watchlist({ parts = [] }) {
  if (parts.length === 0) {
    return (
      <EmptyState
        compact
        title="Every part is above its minimum"
        description="Parts drop into this list when stock reaches the minimum level."
      />
    );
  }

  return (
    <ul className="activity">
      {parts.map((part) => (
        <li key={part.id}>
          <Link to={`/inventory/${part.id}`} className="activity__row">
            <span className="activity__body">
              <span className="activity__text">{part.name}</span>
              <span className="activity__meta mono">{part.qr_code || part.part_number}</span>
            </span>
            <span className={['activity__stock', part.quantity > 0 ? 'is-low' : 'is-out'].join(' ')}>
              {part.quantity > 0 ? pluralize(part.quantity, 'left', 'left') : 'None on hand'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
