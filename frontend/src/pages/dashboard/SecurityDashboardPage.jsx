import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { dashboardApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Card, CardBody, CardHeader, EmptyState, PageHeader, StatGrid, StatTile } from '@/components/ui';
import { formatDate, formatTime, money, number, relativeDays } from '@/utils/format';
import './DashboardPage.css';
import '@/components/dashboard/ActivityFeed.css';

/**
 * The gate checkpoint's own overview.
 *
 * SECURITY never sees inventory, reports, or the warehouse dashboard — this
 * page only ever queries paid orders, so it stays true to that scope rather
 * than being a cut-down copy of `DashboardPage`.
 */
export default function SecurityDashboardPage() {
  useDocumentTitle('Dispatch gate');

  // Orders are paid at the sales counter, on another screen — this one has no
  // mutation of its own to learn from, so it polls, and re-checks whenever the
  // gate terminal comes back into focus.
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.securityDashboard(),
    queryFn: () => dashboardApi.security(),
    staleTime: 0,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const kpis = data?.kpis;

  const tiles = [
    {
      label: 'Ready for dispatch',
      value: number(kpis?.ready_for_dispatch),
      sub: 'paid orders waiting at the gate',
      chip: kpis?.ready_for_dispatch ? 'Action' : 'Clear',
      chipTone: kpis?.ready_for_dispatch ? 'warning' : 'success',
      tone: kpis?.ready_for_dispatch ? 'warning' : 'ink',
    },
    {
      label: 'Dispatched today',
      value: number(kpis?.dispatched_today),
      sub: 'released so far today',
      chip: 'Today',
    },
    {
      label: 'Dispatched all-time',
      value: number(kpis?.dispatched_total),
      sub: 'total orders released',
      chip: 'Lifetime',
    },
  ];

  return (
    <div className="dashboard">
      <PageHeader
        title="Dispatch gate"
        description={`${formatDate(new Date())} · goods only leave once an order is fully paid`}
      />

      <StatGrid min={200}>
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} loading={isLoading} />
        ))}
      </StatGrid>

      <div className="dashboard__row dashboard__row--split">
        <Card>
          <CardHeader
            title="Ready for dispatch"
            subtitle="Oldest paid order first"
            actions={
              <Link to="/orders" className="dashboard__link">
                All orders
              </Link>
            }
          />
          <CardBody>
            <DispatchQueue orders={data?.ready_orders} loading={isLoading} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recently dispatched" subtitle="Most recent releases first" />
          <CardBody>
            <DispatchHistory orders={data?.recent_dispatches} loading={isLoading} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function DispatchQueue({ orders = [], loading }) {
  if (loading) return <ListSkeleton />;

  if (orders.length === 0) {
    return (
      <EmptyState
        compact
        icon={ShieldCheck}
        title="Nothing waiting"
        description="Every fully paid order has already been released."
      />
    );
  }

  return (
    <ul className="activity">
      {orders.map((order) => (
        <li key={order.id}>
          <Link to={`/orders/${order.id}`} className="activity__row">
            <span className="activity__mark is-open" aria-hidden="true">
              {order.items_count ?? order.items?.length ?? 0}x
            </span>
            <span className="activity__body">
              <span className="activity__text">
                {order.order_no} · {money(order.total)} · {order.customer_name || 'Walk-in customer'}
              </span>
              <span className="activity__meta">
                Paid {relativeDays(order.stock_deducted_at || order.ordered_at)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DispatchHistory({ orders = [], loading }) {
  if (loading) return <ListSkeleton />;

  if (orders.length === 0) {
    return (
      <EmptyState compact title="Nothing dispatched yet" description="Released orders show up here." />
    );
  }

  return (
    <ul className="activity">
      {orders.map((order) => (
        <li key={order.id}>
          <Link to={`/orders/${order.id}`} className="activity__row">
            <span className="activity__mark is-paid" aria-hidden="true">
              {order.items_count ?? order.items?.length ?? 0}x
            </span>
            <span className="activity__body">
              <span className="activity__text">
                {order.order_no} · {money(order.total)} · {order.customer_name || 'Walk-in customer'}
              </span>
              <span className="activity__meta">
                {order.dispatched_by?.name || 'Security'} · {relativeDays(order.dispatched_at)}{' '}
                {formatTime(order.dispatched_at)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton() {
  return (
    <div className="dashboard__skeleton" style={{ height: 150 }} aria-hidden="true">
      <span className="dashboard__skeleton-bar" />
    </div>
  );
}
