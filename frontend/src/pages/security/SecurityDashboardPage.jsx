import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, History, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import { useSecurityDashboardQuery, useYardStockQuery, YARD_REFRESH_MS } from '@/hooks/queries/useSecurity';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Skeleton,
  StatGrid,
  StatTile,
} from '@/components/ui';
import { OrderLookup } from '@/components/security';
import { formatDateTime, formatTime, money, number, pluralize, relativeDateTime } from '@/utils/format';
import './SecurityDashboardPage.css';

const NEXT_IN_LINE = 5;

/**
 * The gate's home screen.
 *
 * Everything on it is derived by the server from live payment data and
 * re-polled every few seconds, so an order Finance settles on another
 * terminal appears here without anyone reloading.
 */
export default function SecurityDashboardPage() {
  useDocumentTitle('Gate dashboard');
  const navigate = useNavigate();

  const summary = useSecurityDashboardQuery();
  const queue = useYardStockQuery({ per_page: NEXT_IN_LINE });

  const kpis = summary.data?.kpis;
  const recent = summary.data?.recent_dispatches ?? [];
  const nextOrders = queue.data?.rows ?? [];
  const loading = summary.isLoading;

  const refresh = () => {
    summary.refetch();
    queue.refetch();
  };

  const tiles = [
    {
      label: 'Ready for dispatch',
      value: number(kpis?.ready_for_dispatch ?? 0),
      sub: kpis ? `${money(kpis.ready_value)} fully paid, in the yard` : '',
      tone: 'ink',
    },
    {
      label: 'Dispatched today',
      value: number(kpis?.dispatched_today ?? 0),
      sub: 'Released through the gate since midnight',
    },
    {
      label: 'Total items in yard',
      value: number(kpis?.units_in_yard ?? 0),
      sub: 'Units across ready-for-dispatch orders',
    },
    {
      label: 'Pending yard orders',
      value: number(kpis?.pending_from_earlier ?? 0),
      sub: kpis?.oldest_paid_at
        ? `Paid before today · oldest waiting since ${formatDateTime(kpis.oldest_paid_at)}`
        : 'Paid before today and still waiting',
      tone: kpis?.pending_from_earlier > 0 ? 'warning' : 'ink',
    },
  ];

  return (
    <div className="gate">
      <PageHeader
        title="Gate dashboard"
        description={
          summary.dataUpdatedAt
            ? `Fully paid orders waiting to leave the yard · updated ${formatTime(summary.dataUpdatedAt)}, refreshes every ${YARD_REFRESH_MS / 1000}s`
            : 'Fully paid orders waiting to leave the yard'
        }
        actions={
          <>
            <IconButton icon={RefreshCw} label="Refresh now" onClick={refresh} />
            <Link to="/security/yard-stock">
              <Button variant="secondary" icon={Truck}>
                Yard stock
              </Button>
            </Link>
          </>
        }
      />

      {summary.isError ? (
        <Card>
          <ErrorState error={summary.error} onRetry={summary.refetch} compact />
        </Card>
      ) : (
        <StatGrid min={200}>
          {tiles.map((tile) => (
            <StatTile key={tile.label} {...tile} loading={loading} />
          ))}
        </StatGrid>
      )}

      <Card className="gate__lookup">
        <OrderLookup />
      </Card>

      <div className="gate__row">
        <Card>
          <CardHeader
            title="Next in line"
            subtitle="Longest-waiting fully paid orders first"
            actions={
              <Link to="/security/yard-stock" className="gate__link">
                All yard stock <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
              </Link>
            }
          />

          {queue.isError ? (
            <ErrorState error={queue.error} onRetry={queue.refetch} compact />
          ) : queue.isLoading ? (
            <div className="gate__list">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="gate__item">
                  <Skeleton width="60%" height={14} />
                </div>
              ))}
            </div>
          ) : nextOrders.length === 0 ? (
            <EmptyState
              compact
              icon={PackageCheck}
              title="The yard is clear"
              description="Orders appear here the moment their final payment is recorded."
            />
          ) : (
            <ul className="gate__list">
              {nextOrders.map((order) => (
                <li key={order.id}>
                  <button type="button" className="gate__item" onClick={() => navigate(`/security/orders/${order.id}`)}>
                    <span className="gate__item-main">
                      <span className="gate__item-no mono">{order.order_no}</span>
                      <span className="gate__item-meta">
                        {order.customer_name} · {pluralize(order.total_quantity ?? 0, 'unit')} ·{' '}
                        {money(order.total)}
                      </span>
                    </span>
                    <span className="gate__item-side">
                      <span className="gate__item-when">Paid {relativeDateTime(order.paid_at)}</span>
                      <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent dispatches"
            subtitle="The last orders released at the gate"
            actions={
              <Link to="/security/dispatch-history" className="gate__link">
                Dispatch history <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
              </Link>
            }
          />

          {loading ? (
            <div className="gate__list">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="gate__item">
                  <Skeleton width="60%" height={14} />
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              compact
              icon={History}
              title="Nothing dispatched yet"
              description="Every order released at the gate is recorded here."
            />
          ) : (
            <ul className="gate__list">
              {recent.map((dispatch) => (
                <li key={dispatch.id}>
                  <button
                    type="button"
                    className="gate__item"
                    onClick={() => navigate(`/security/orders/${dispatch.order_id}`)}
                  >
                    <span className="gate__item-main">
                      <span className="gate__item-no mono">{dispatch.order_no}</span>
                      <span className="gate__item-meta">
                        {dispatch.customer_name} · {pluralize(dispatch.total_quantity, 'unit')} · by{' '}
                        {dispatch.dispatched_by?.name}
                      </span>
                    </span>
                    <span className="gate__item-side">
                      <span className="gate__item-when">{formatDateTime(dispatch.dispatched_at)}</span>
                      <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
