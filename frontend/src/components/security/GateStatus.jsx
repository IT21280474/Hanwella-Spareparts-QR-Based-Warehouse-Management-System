import { BadgeCheck, CircleAlert, PackageCheck, Truck } from 'lucide-react';
import { YARD_STATUS } from '@/constants/options';
import './GateStatus.css';

/**
 * The two answers a gate officer needs at a glance, sized to be read from
 * arm's length: is it paid, and may it leave. Both come straight from the
 * server's verdict on the order — nothing here is inferred on the client.
 */
export function GateStatus({ order }) {
  const paid = !!order?.is_fully_paid;
  const yard = order?.yard_status;

  const payment = paid
    ? { tone: 'success', icon: BadgeCheck, value: 'FULLY PAID' }
    : { tone: 'danger', icon: CircleAlert, value: 'NOT FULLY PAID' };

  const release =
    yard === YARD_STATUS.READY
      ? { tone: 'success', icon: PackageCheck, value: 'READY FOR DISPATCH' }
      : yard === YARD_STATUS.DISPATCHED
        ? { tone: 'info', icon: Truck, value: 'DISPATCHED' }
        : { tone: 'danger', icon: CircleAlert, value: 'NOT IN YARD' };

  return (
    <div className="gate-status">
      <Indicator label="Payment" {...payment} />
      <Indicator label="Yard status" {...release} />
    </div>
  );
}

function Indicator({ label, tone, icon: Icon, value }) {
  return (
    <div className={`gate-status__tile gate-status__tile--${tone}`}>
      <Icon className="gate-status__icon" size={28} strokeWidth={1.9} aria-hidden="true" />
      <div>
        <p className="gate-status__label">{label}</p>
        <p className="gate-status__value">{value}</p>
      </div>
    </div>
  );
}
