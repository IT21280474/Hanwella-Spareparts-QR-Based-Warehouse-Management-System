import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, QrCode, ScanLine } from 'lucide-react';
import { dashboardApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  PageHeader,
  StatGrid,
  StatTile,
} from '@/components/ui';
import { ActivityFeed, PaymentSplit, SalesTrend, TopParts, Watchlist } from '@/components/dashboard';
import { formatDate, money, number, pluralize, shortMoney } from '@/utils/format';
import './DashboardPage.css';

/**
 * Warehouse overview.
 *
 * Every number comes from one `/dashboard` call so the tiles, the trend and
 * the alert bell can never disagree with each other.
 */
export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { can } = usePermission();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: () => dashboardApi.summary(),
  });

  const kpis = data?.kpis;

  const tiles = [
    {
      label: 'Spare parts',
      value: number(kpis?.parts),
      sub: 'QR identities issued',
      chip: kpis?.parts_added_this_month ? `+${kpis.parts_added_this_month} this month` : 'Catalogue',
      chipTone: kpis?.parts_added_this_month ? 'success' : 'neutral',
    },
    {
      label: 'Units on hand',
      value: number(kpis?.units_on_hand),
      sub: `${shortMoney(kpis?.stock_value)} at retail`,
      chip: 'Live',
    },
    {
      label: 'Low stock',
      value: number(kpis?.low_stock),
      sub: 'at or below minimum',
      chip: kpis?.low_stock ? 'Action' : 'Clear',
      chipTone: kpis?.low_stock ? 'warning' : 'success',
      tone: kpis?.low_stock ? 'warning' : 'ink',
    },
    {
      label: 'Out of stock',
      value: number(kpis?.out_of_stock),
      sub: 'blocking counter sales',
      chip: kpis?.out_of_stock ? 'Urgent' : 'Clear',
      chipTone: kpis?.out_of_stock ? 'danger' : 'success',
      tone: kpis?.out_of_stock ? 'danger' : 'ink',
    },
    {
      label: "Today's orders",
      value: number(kpis?.orders_today),
      sub: 'across the counter',
      chip: 'Today',
    },
    {
      label: "Today's sales",
      value: shortMoney(kpis?.sales_today),
      sub: 'finalised orders',
      chip: 'Counter',
    },
    {
      label: 'Pending payments',
      value: shortMoney(kpis?.pending_payments),
      sub: `${pluralize(kpis?.pending_orders ?? 0, 'order')} unsettled`,
      chip: kpis?.pending_orders ? 'Follow up' : 'Settled',
      chipTone: kpis?.pending_orders ? 'info' : 'success',
    },
  ];

  if (isError) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }

  return (
    <div className="dashboard">
      <PageHeader
        title="Warehouse overview"
        description={`${formatDate(new Date())} · live inventory and counter position`}
        actions={
          <>
            {can(PERMISSIONS.PRINT_LABELS) ? (
              <Link to="/qr-labels">
                <Button variant="secondary" icon={QrCode}>
                  Generate QR labels
                </Button>
              </Link>
            ) : null}
            {can(PERMISSIONS.SCAN_QR) ? (
              <Link to="/scan">
                <Button variant="secondary" icon={ScanLine}>
                  Scan a part
                </Button>
              </Link>
            ) : null}
            {can(PERMISSIONS.CREATE_INVENTORY) ? (
              <Link to="/inventory/new">
                <Button icon={Plus}>Add spare part</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <StatGrid>
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} loading={isLoading} />
        ))}
      </StatGrid>

      <div className="dashboard__row dashboard__row--split">
        <Card>
          <CardHeader
            title="Sales · last 14 days"
            subtitle={
              data
                ? `${money(data.sales_trend?.reduce((sum, day) => sum + Number(day.total || 0), 0))} · ${data.sales_trend?.reduce((sum, day) => sum + Number(day.orders || 0), 0)} orders`
                : 'Loading'
            }
          />
          <CardBody>{isLoading ? <TrendSkeleton /> : <SalesTrend days={data?.sales_trend} />}</CardBody>
        </Card>

        <Card>
          <CardHeader title="Payment split" subtitle="Booked value by payment state" />
          <CardBody>{isLoading ? <TrendSkeleton short /> : <PaymentSplit groups={data?.payment_split} />}</CardBody>
        </Card>
      </div>

      <div className="dashboard__row dashboard__row--thirds">
        <Card>
          <CardHeader title="Top moving parts" subtitle="By units sold" />
          <CardBody>{isLoading ? <TrendSkeleton short /> : <TopParts parts={data?.top_parts} />}</CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Needs restocking"
            subtitle="At or below minimum"
            actions={
              <Link to="/inventory?status=low" className="dashboard__link">
                View all
              </Link>
            }
          />
          <CardBody>{isLoading ? <TrendSkeleton short /> : <Watchlist parts={data?.watchlist} />}</CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent orders"
            subtitle="Counter activity"
            actions={
              <Link to="/orders" className="dashboard__link">
                All orders
              </Link>
            }
          />
          <CardBody>{isLoading ? <TrendSkeleton short /> : <ActivityFeed orders={data?.recent_orders} />}</CardBody>
        </Card>
      </div>
    </div>
  );
}

function TrendSkeleton({ short = false }) {
  return (
    <div className="dashboard__skeleton" style={{ height: short ? 150 : 190 }} aria-hidden="true">
      <span className="dashboard__skeleton-bar" />
    </div>
  );
}
