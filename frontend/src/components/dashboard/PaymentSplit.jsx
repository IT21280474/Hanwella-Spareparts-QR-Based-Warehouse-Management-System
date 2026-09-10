import { money, percent } from '@/utils/format';
import { PAYMENT_STATUS_LABEL } from '@/constants/options';
import './PaymentSplit.css';

const TONE = {
  PAID: 'var(--color-success)',
  PENDING: 'var(--color-warning)',
  PARTIALLY_PAID: 'var(--color-info)',
  CANCELLED: 'var(--color-danger)',
};

/** Stacked bar showing how booked value splits across payment states. */
export function PaymentSplit({ groups = [] }) {
  const gross = groups.reduce((sum, group) => sum + (Number(group.amount) || 0), 0);

  return (
    <div className="pay-split">
      <div className="pay-split__bar" role="img" aria-label="Payment status split">
        {groups.map((group) => {
          const share = percent(group.amount, gross);
          if (share === 0) return null;
          return (
            <span
              key={group.status}
              className="pay-split__segment"
              style={{ width: `${share}%`, background: TONE[group.status] }}
              title={`${PAYMENT_STATUS_LABEL[group.status]} · ${money(group.amount)}`}
            />
          );
        })}
      </div>

      <ul className="pay-split__legend">
        {groups.map((group) => (
          <li key={group.status} className="pay-split__item">
            <span className="pay-split__dot" style={{ background: TONE[group.status] }} aria-hidden="true" />
            <span className="pay-split__label">{PAYMENT_STATUS_LABEL[group.status]}</span>
            <span className="pay-split__count">{group.orders}</span>
            <span className="pay-split__amount num">{money(group.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
