import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { settingsApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import { useOrderQuery } from '@/hooks/queries/useOrders';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button, Card, ErrorState, QrImage, Spinner } from '@/components/ui';
import { PrintLayout } from '@/layouts';
import { COMPANY_FALLBACK } from '@/constants';
import { PAYMENT_MODE_LABEL, PAYMENT_STATUS } from '@/constants/options';
import { formatDate, formatTime, money, number } from '@/utils/format';
import { paymentLabel } from '@/utils/status';
import './BillPage.css';

/**
 * The customer bill.
 *
 * A physical document, not a screen: `PrintLayout` renders A4-width paper that
 * the print stylesheet promotes to the page itself, and every control on the
 * page carries `data-noprint`. Saving a PDF is the browser's print dialog —
 * generating one in the browser would only produce a second, divergent layout.
 */
export default function BillPage() {
  const { id } = useParams();
  const { data: order, isLoading, isError, error, refetch } = useOrderQuery(id);
  const { data: settings } = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: () => settingsApi.get(),
    staleTime: 10 * 60_000,
  });

  useDocumentTitle(order ? `Bill ${order.order_no}` : 'Bill');

  const company = settings?.company ?? COMPANY_FALLBACK;

  if (isError) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="bill__loading" role="status">
        <Spinner size={20} tone="var(--color-muted-2)" />
        <span>Preparing the bill…</span>
      </div>
    );
  }

  const cancelled = order.payment_status === PAYMENT_STATUS.CANCELLED;
  const units = (order.items ?? []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <div className="bill">
      <div className="bill__bar" data-noprint>
        <Link to={`/orders/${id}`} className="bill__back">
          <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
          Back to order
        </Link>
        <Button icon={Printer} onClick={() => window.print()}>
          Print bill
        </Button>
      </div>

      <PrintLayout>
        <article className="paper">
          <header className="paper__head">
            <div className="paper__company">
              <h1 className="paper__company-name">{company.name}</h1>
              {company.address ? <p className="paper__company-line">{company.address}</p> : null}
              {company.contact ? <p className="paper__company-line">{company.contact}</p> : null}
              {company.registration_no ? (
                <p className="paper__company-line">Reg. {company.registration_no}</p>
              ) : null}
            </div>

            <div className="paper__doc">
              <p className="paper__doc-kind">{cancelled ? 'Cancelled bill' : 'Sales bill'}</p>
              <p className="paper__doc-no mono">{order.order_no}</p>
              <p className="paper__doc-date">
                {formatDate(order.ordered_at)} · {formatTime(order.ordered_at)}
              </p>
            </div>
          </header>

          {cancelled ? <p className="paper__void">This order was cancelled and is not payable.</p> : null}

          <section className="paper__parties">
            <div>
              <p className="paper__label">Billed to</p>
              <p className="paper__value">{order.customer_name || 'Walk-in customer'}</p>
              {order.customer_phone ? <p className="paper__sub mono">{order.customer_phone}</p> : null}
            </div>
            <div>
              <p className="paper__label">Served by</p>
              <p className="paper__value">{order.cashier?.name || '—'}</p>
              <p className="paper__sub">
                {paymentLabel(order.payment_status)} · {PAYMENT_MODE_LABEL[order.payment_mode] || order.payment_mode}
              </p>
            </div>
          </section>

          <table className="paper__table">
            <thead>
              <tr>
                <th className="is-left" style={{ width: 34 }}>
                  #
                </th>
                <th className="is-left">Spare part</th>
                <th className="is-right" style={{ width: 96 }}>
                  Unit price
                </th>
                <th className="is-right" style={{ width: 52 }}>
                  Qty
                </th>
                <th className="is-right" style={{ width: 104 }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {(order.items ?? []).map((item, index) => (
                <tr key={item.id} data-break-avoid>
                  <td className="is-left paper__index">{index + 1}</td>
                  <td className="is-left">
                    <span className="paper__part">{item.part_name}</span>
                    <span className="paper__part-meta mono">
                      {item.part_number}
                      {item.qr_code ? ` · ${item.qr_code}` : ''}
                    </span>
                  </td>
                  <td className="is-right mono">{money(item.unit_price)}</td>
                  <td className="is-right mono">{number(item.quantity)}</td>
                  <td className="is-right mono paper__amount">{money(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="paper__foot">
            <div className="paper__qr">
              <QrImage code={order.order_no} size={68} bordered={false} />
              <p className="paper__qr-note">Scan to reference this bill</p>
            </div>

            <dl className="paper__totals">
              <div>
                <dt>Subtotal ({number(units)} units)</dt>
                <dd className="mono">{money(order.subtotal)}</dd>
              </div>
              {Number(order.discount) > 0 ? (
                <div>
                  <dt>Discount</dt>
                  <dd className="mono">− {money(order.discount)}</dd>
                </div>
              ) : null}
              <div className="paper__totals-grand">
                <dt>Total</dt>
                <dd className="mono">{money(order.total)}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd className="mono">{money(order.paid_amount)}</dd>
              </div>
              {Number(order.outstanding) > 0 ? (
                <div className="paper__totals-due">
                  <dt>Balance due</dt>
                  <dd className="mono">{money(order.outstanding)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <footer className="paper__note">
            <p>
              Goods once sold are exchangeable within 7 days against this bill, in original condition and packaging.
              Electrical parts are non-returnable.
            </p>
            <p className="paper__thanks">Thank you for your business.</p>
          </footer>
        </article>
      </PrintLayout>
    </div>
  );
}
