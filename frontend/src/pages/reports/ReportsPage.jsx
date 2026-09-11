import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChartColumnIncreasing, Download } from 'lucide-react';
import { REPORT_TYPES, reportsApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import { useTableParams } from '@/hooks/useTableParams';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  SkeletonRows,
  StatGrid,
  StatTile,
  TableWrap,
  Tabs,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { formatDate, formatDateTime, money, number } from '@/utils/format';
import { paymentLabel, paymentTone } from '@/utils/status';
import './ReportsPage.css';

/**
 * Column definitions per report.
 *
 * Held here rather than sent by the API: the server owns the numbers, the
 * client owns how they are laid out. That keeps a report from silently
 * changing shape when an endpoint adds a field.
 *
 * `format` names how a cell is rendered; `align` follows the type — money and
 * counts right, text left.
 */
const REPORT_VIEWS = {
  [REPORT_TYPES.SALES]: {
    label: 'Sales',
    description: 'Counter sales over the selected period',
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'orders', label: 'Orders', format: 'number', align: 'right', width: 90 },
      { key: 'units', label: 'Units', format: 'number', align: 'right', width: 90 },
      { key: 'discount', label: 'Discount', format: 'money', align: 'right', width: 120 },
      { key: 'total', label: 'Booked value', format: 'money', align: 'right', width: 140 },
    ],
    footnote: 'Cancelled orders are excluded. Booked value is after discount and before any outstanding balance.',
  },

  [REPORT_TYPES.INVENTORY]: {
    label: 'Inventory',
    description: 'Stock position and its value by category',
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'parts', label: 'Parts', format: 'number', align: 'right', width: 90 },
      { key: 'units', label: 'Units on hand', format: 'number', align: 'right', width: 120 },
      { key: 'stock_value', label: 'Retail value', format: 'money', align: 'right', width: 140 },
      { key: 'cost_value', label: 'Cost value', format: 'money', align: 'right', width: 140 },
    ],
    footnote: 'Valued at the prices held against each part today, not at the price when the stock was received.',
  },

  [REPORT_TYPES.PAYMENTS]: {
    label: 'Payments',
    description: 'What has been settled and what is still owed',
    columns: [
      { key: 'payment_status', label: 'Status', format: 'payment' },
      { key: 'orders', label: 'Orders', format: 'number', align: 'right', width: 90 },
      { key: 'total', label: 'Billed', format: 'money', align: 'right', width: 130 },
      { key: 'paid', label: 'Received', format: 'money', align: 'right', width: 130 },
      { key: 'outstanding', label: 'Outstanding', format: 'money', align: 'right', width: 140 },
    ],
    footnote: 'Outstanding is billed less received. A cancelled order carries no outstanding balance.',
  },

  [REPORT_TYPES.LOW_STOCK]: {
    label: 'Low stock',
    description: 'Parts at or below their minimum level',
    columns: [
      { key: 'name', label: 'Spare part' },
      { key: 'part_number', label: 'Part number', format: 'mono', width: 150 },
      { key: 'quantity', label: 'On hand', format: 'number', align: 'right', width: 100 },
      { key: 'min_stock', label: 'Minimum', format: 'number', align: 'right', width: 100 },
      { key: 'sold_90d', label: 'Sold · 90d', format: 'number', align: 'right', width: 110 },
    ],
    footnote: 'Ordered by how far below minimum each part sits, so the most urgent restock is first.',
  },

  [REPORT_TYPES.OUT_OF_STOCK]: {
    label: 'Out of stock',
    description: 'Parts at zero — a counter sale of these fails until restocked',
    columns: [
      { key: 'name', label: 'Spare part' },
      { key: 'part_number', label: 'Part number', format: 'mono', width: 150 },
      { key: 'min_stock', label: 'Minimum', format: 'number', align: 'right', width: 100 },
      { key: 'sold_90d', label: 'Sold · 90d', format: 'number', align: 'right', width: 110 },
    ],
    footnote: 'Zero units on hand right now. Ordered by name.',
  },

  [REPORT_TYPES.STOCK_IN]: {
    label: 'Stock in',
    description: 'Goods received, by part',
    columns: [
      { key: 'name', label: 'Spare part' },
      { key: 'part_number', label: 'Part number', format: 'mono', width: 150 },
      { key: 'movements', label: 'Receipts', format: 'number', align: 'right', width: 100 },
      { key: 'units', label: 'Units received', format: 'number', align: 'right', width: 130 },
    ],
    footnote: 'Manual goods receipts only — stock returned from a cancelled order is excluded.',
  },

  [REPORT_TYPES.STOCK_OUT]: {
    label: 'Stock out',
    description: 'Goods issued manually, by part',
    columns: [
      { key: 'name', label: 'Spare part' },
      { key: 'part_number', label: 'Part number', format: 'mono', width: 150 },
      { key: 'movements', label: 'Issues', format: 'number', align: 'right', width: 100 },
      { key: 'units', label: 'Units issued', format: 'number', align: 'right', width: 120 },
    ],
    footnote: 'Manual stock-outs only — counter sales are excluded (see the Sales report for those).',
  },

  [REPORT_TYPES.USER_ACTIVITY]: {
    label: 'User activity',
    description: 'Audit-logged actions per account',
    columns: [
      { key: 'name', label: 'Person' },
      { key: 'role', label: 'Role', width: 140 },
      { key: 'actions', label: 'Actions', format: 'number', align: 'right', width: 100 },
      { key: 'last_active', label: 'Last active', format: 'datetime', width: 160 },
    ],
    footnote: 'Counts every audit-logged action (logins, part/stock/order/user/settings changes) attributed to that account.',
  },
};

const TABS = Object.entries(REPORT_VIEWS).map(([value, view]) => ({ value, label: view.label }));

/** Render one cell according to its column definition. */
function cell(row, column) {
  const value = row[column.key];

  switch (column.format) {
    case 'money':
      return money(value);
    case 'number':
      return number(value);
    case 'date':
      return formatDate(value);
    case 'datetime':
      return value ? formatDateTime(value) : '—';
    case 'mono':
      return <span className="mono">{value || '—'}</span>;
    case 'payment':
      return (
        <Badge tone={paymentTone(value)} dot>
          {paymentLabel(value)}
        </Badge>
      );
    default:
      return value ?? '—';
  }
}

/**
 * Reports.
 *
 * Four views over the same period selector. Everything is aggregated by the
 * server — the browser never pulls raw rows to total them, so a report over a
 * year of sales costs the same as one over a week.
 */
export default function ReportsPage() {
  useDocumentTitle('Reports');
  const { can } = usePermission();
  const { params, setParams } = useTableParams();

  const [type, setType] = useState(REPORT_TYPES.SALES);
  const view = REPORT_VIEWS[type];

  const range = { from: params.from || '', to: params.to || '' };

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.reports(type, range),
    queryFn: () => reportsApi.get(type, range),
  });

  const report = data?.report;
  const rows = report?.rows ?? [];

  return (
    <div className="reports">
      <PageHeader
        title="Reports"
        description={view.description}
        actions={
          can(PERMISSIONS.EXPORT_REPORTS) ? (
            <a href={reportsApi.exportUrl(type, range)} download>
              <Button variant="secondary" icon={Download}>
                Export CSV
              </Button>
            </a>
          ) : null
        }
      />

      <Card>
        <Tabs tabs={TABS} value={type} onChange={setType} label="Report" className="reports__tabs" />

        <div className="reports__toolbar">
          <span className="reports__period">Period</span>
          <Input
            size="sm"
            type="date"
            value={range.from}
            onChange={(event) => setParams({ from: event.target.value })}
            aria-label="From date"
          />
          <span className="reports__dash" aria-hidden="true">
            –
          </span>
          <Input
            size="sm"
            type="date"
            value={range.to}
            onChange={(event) => setParams({ to: event.target.value })}
            aria-label="To date"
          />
          {range.from || range.to ? (
            <Button variant="ghost" size="sm" onClick={() => setParams({ from: '', to: '' })}>
              All time
            </Button>
          ) : (
            <span className="reports__all">Showing all time</span>
          )}
        </div>
      </Card>

      {isError ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : (
        <>
          <StatGrid>
            {(report?.kpis ?? Array.from({ length: 4 }).map(() => ({}))).map((kpi, index) => (
              <StatTile
                key={kpi.label || index}
                label={kpi.label}
                value={kpi.value}
                sub={kpi.sub}
                chip={kpi.chip}
                chipTone={kpi.chip_tone}
                tone={kpi.tone}
                loading={isLoading}
              />
            ))}
          </StatGrid>

          <Card>
            <TableWrap minWidth={860}>
              <thead>
                <tr>
                  {view.columns.map((column) => (
                    <Th key={column.key} align={column.align || 'left'} width={column.width}>
                      {column.label}
                    </Th>
                  ))}
                </tr>
              </thead>

              {isLoading ? (
                <SkeletonRows rows={8} columns={view.columns.length} />
              ) : (
                <tbody className={isFetching ? 'is-refreshing' : ''}>
                  {rows.map((row, index) => (
                    <Tr key={row.id ?? row.key ?? index}>
                      {view.columns.map((column) => (
                        <Td
                          key={column.key}
                          align={column.align || 'left'}
                          nowrap={column.align === 'right'}
                          className={column.align === 'right' ? 'num' : ''}
                        >
                          {cell(row, column)}
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </tbody>
              )}
            </TableWrap>

            {!isLoading && rows.length === 0 ? (
              <EmptyState
                icon={ChartColumnIncreasing}
                title="Nothing to report for this period"
                description="No activity fell inside the selected dates. Widen the range, or clear it to see all time."
                actions={
                  range.from || range.to ? (
                    <Button onClick={() => setParams({ from: '', to: '' })}>Show all time</Button>
                  ) : null
                }
              />
            ) : null}
          </Card>

          <p className="reports__footnote">{report?.footnote || view.footnote}</p>
        </>
      )}
    </div>
  );
}
