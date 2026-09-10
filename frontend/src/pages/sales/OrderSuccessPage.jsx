import { Link, useParams } from 'react-router-dom';
import { Check, Printer, ReceiptText, ShoppingCart } from 'lucide-react';
import { useOrderQuery } from '@/hooks/queries/useOrders';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PAYMENT_MODE_LABEL } from '@/constants/options';
import { Badge, Button, Card, ErrorState, Skeleton } from '@/components/ui';
import { formatDateTime, money, number, pluralize } from '@/utils/format';
import { paymentLabel, paymentTone } from '@/utils/status';
import './OrderSuccessPage.css';

/**
 * Confirmation after a sale is committed.
 *
 * Deliberately a landing screen rather than a toast: the counter needs an
 * unambiguous "this went through", the bill within one click, and a fast route
 * back into the next sale.
 */
export default function OrderSuccessPage() {
  const { id } = useParams();
  useDocumentTitle('Sale completed');

  const { data: order, isLoading, isError, error, refetch } = useOrderQuery(id);

  if (isError) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }

  return (
    <div className="success">
      <Card className="success__card">
        <div className="success__body">
          <span className="success__mark" aria-hidden="true">
            <Check size={26} strokeWidth={3} />
          </span>

          <h1 className="success__title">Sale completed</h1>

          {isLoading ? (
            <Skeleton width={220} height={14} />
          ) : (
            <p className="success__subtitle">
              Order <span className="mono">{order.order_no}</span> · {formatDateTime(order.ordered_at)}
            </p>
          )}

          <div className="success__figure">
            {isLoading ? <Skeleton width={160} height={34} /> : <p className="success__total num">{money(order.total)}</p>}
            {!isLoading ? (
              <div className="success__chips">
                <Badge tone={paymentTone(order.payment_status)} dot>
                  {paymentLabel(order.payment_status)}
                </Badge>
                <Badge tone="neutral">{PAYMENT_MODE_LABEL[order.payment_mode] || order.payment_mode}</Badge>
              </div>
            ) : null}
          </div>

          {!isLoading ? (
            <dl className="success__facts">
              <div>
                <dt>Customer</dt>
                <dd>{order.customer_name || 'Walk-in customer'}</dd>
              </div>
              <div>
                <dt>Items</dt>
                <dd>{pluralize(order.items?.length ?? 0, 'line item')}</dd>
              </div>
              <div>
                <dt>Units</dt>
                <dd className="num">
                  {number((order.items ?? []).reduce((sum, item) => sum + Number(item.quantity || 0), 0))}
                </dd>
              </div>
              {Number(order.outstanding) > 0 ? (
                <div className="success__facts-warn">
                  <dt>Outstanding</dt>
                  <dd className="num">{money(order.outstanding)}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <p className="success__note">
            Stock has been deducted and a movement recorded against every part on this order.
          </p>

          <div className="success__actions">
            <Link to={`/orders/${id}/bill`}>
              <Button size="lg" icon={Printer}>
                Print the bill
              </Button>
            </Link>
            <Link to="/sales/new">
              <Button size="lg" variant="secondary" icon={ShoppingCart}>
                Start another sale
              </Button>
            </Link>
            <Link to={`/orders/${id}`}>
              <Button size="lg" variant="ghost" icon={ReceiptText}>
                Order details
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
