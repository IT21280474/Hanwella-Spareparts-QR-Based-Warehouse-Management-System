import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageCheck, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useYardStockQuery, YARD_REFRESH_MS } from '@/hooks/queries/useSecurity';
import { useTableParams } from '@/hooks/useTableParams';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { DISPATCH_STATUS_LABEL } from '@/constants/options';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  SkeletonRows,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { formatDate, formatDateTime, formatTime, money, number } from '@/utils/format';
import { yardLabel, yardTone } from '@/utils/status';
import './YardStockPage.css';

/**
 * Every order currently cleared to leave the yard: fully paid, not
 * cancelled, not yet dispatched. The list is the server's — it is derived
 * from payment data on every request and re-polled, so an order appears here
 * as soon as Finance records its final payment and drops off the moment
 * Security dispatches it.
 *
 * The bill printed for a customer carries the order number as its document
 * number, so one column serves as both order and bill number.
 */
export default function YardStockPage() {
  useDocumentTitle('Yard stock');
  const navigate = useNavigate();

  const { params, page, search, setParams, setPage, clear, hasFilters } = useTableParams();

  const [term, setTerm] = useState(search);
  const debouncedTerm = useDebounce(term);

  useEffect(() => {
    if (debouncedTerm !== search) setParams({ search: debouncedTerm });
  }, [debouncedTerm, search, setParams]);

  const query = {
    search: params.search || '',
    from: params.from || '',
    to: params.to || '',
    page,
    per_page: params.per_page,
  };

  const { data, isLoading, isFetching, isError, error, refetch, dataUpdatedAt } = useYardStockQuery(query);
  const rows = data?.rows ?? [];
  const meta = data?.meta;

  const resetAll = () => {
    setTerm('');
    clear();
  };

  const verify = (order) => navigate(`/security/orders/${order.id}`);

  return (
    <div className="yard">
      <PageHeader
        title="Yard stock"
        description={
          meta
            ? `${number(meta.total)} fully paid ${meta.total === 1 ? 'order' : 'orders'} ready for dispatch · updated ${formatTime(dataUpdatedAt)}, refreshes every ${YARD_REFRESH_MS / 1000}s`
            : 'Fully paid orders waiting to leave the yard'
        }
        actions={<IconButton icon={RefreshCw} label="Refresh now" onClick={() => refetch()} />}
      />

      <Card>
        <div className="yard__toolbar">
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="Search order / bill no, customer or phone"
            label="Search yard stock"
            size="md"
            autoFocus
          />

          <div className="yard__dates" role="group" aria-label="Fully paid between">
            <span className="yard__dates-label">Paid</span>
            <Input
              size="sm"
              type="date"
              value={params.from || ''}
              max={params.to || undefined}
              onChange={(event) => setParams({ from: event.target.value })}
              aria-label="Paid from date"
            />
            <span className="yard__dash" aria-hidden="true">
              –
            </span>
            <Input
              size="sm"
              type="date"
              value={params.to || ''}
              min={params.from || undefined}
              onChange={(event) => setParams({ to: event.target.value })}
              aria-label="Paid to date"
            />
          </div>

          {hasFilters ? (
            <Button variant="secondary" size="sm" icon={X} onClick={resetAll}>
              Clear
            </Button>
          ) : null}
        </div>

        {isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <>
            <TableWrap minWidth={1090}>
              <thead>
                <tr>
                  <Th width={132}>Order / bill no</Th>
                  <Th>Customer</Th>
                  <Th width={100}>Ordered</Th>
                  <Th width={128}>Fully paid</Th>
                  <Th align="right" width={56}>
                    Items
                  </Th>
                  <Th align="right" width={52}>
                    Qty
                  </Th>
                  <Th align="right" width={108}>
                    Order total
                  </Th>
                  <Th align="right" width={108}>
                    Paid
                  </Th>
                  {/* Payment, yard and dispatch status stacked in one cell: in
                      yard stock they are the same for every row by definition,
                      and three columns of them pushed Verify off a laptop screen. */}
                  <Th width={176}>Payment · yard · dispatch</Th>
                  <Th align="right" width={96}>
                    Actions
                  </Th>
                </tr>
              </thead>

              {isLoading ? (
                <SkeletonRows rows={8} columns={10} />
              ) : (
                <tbody className={isFetching ? 'is-refreshing' : ''}>
                  {rows.map((order) => (
                    <Tr key={order.id}>
                      <Td nowrap>
                        <button type="button" className="yard__no mono" onClick={() => verify(order)}>
                          {order.order_no}
                        </button>
                      </Td>

                      <Td>
                        <span className="yard__customer">{order.customer_name}</span>
                        {order.customer_phone ? <span className="yard__phone mono">{order.customer_phone}</span> : null}
                      </Td>

                      <Td nowrap className="yard__when">
                        {formatDate(order.ordered_at)}
                      </Td>

                      <Td nowrap className="yard__when">
                        {formatDateTime(order.paid_at)}
                      </Td>

                      <Td align="right" nowrap className="num">
                        {number(order.items_count)}
                      </Td>

                      <Td align="right" nowrap className="num yard__qty">
                        {number(order.total_quantity)}
                      </Td>

                      <Td align="right" nowrap className="num yard__total">
                        {money(order.total)}
                      </Td>

                      <Td align="right" nowrap className="num">
                        {money(order.paid_amount)}
                      </Td>

                      <Td>
                        <span className="yard__statuses">
                          <Badge tone="success" dot>
                            FULLY PAID
                          </Badge>
                          <Badge tone={yardTone(order.yard_status)} dot>
                            {yardLabel(order.yard_status).toUpperCase()}
                          </Badge>
                          <Badge tone="neutral" size="sm">
                            {DISPATCH_STATUS_LABEL[order.dispatch_status] ?? order.dispatch_status}
                          </Badge>
                        </span>
                      </Td>

                      <Td align="right">
                        <Button size="sm" icon={ShieldCheck} onClick={() => verify(order)}>
                          Verify
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              )}
            </TableWrap>

            {!isLoading && rows.length === 0 ? (
              <EmptyState
                icon={PackageCheck}
                title={hasFilters ? 'No yard orders match' : 'The yard is clear'}
                description={
                  hasFilters
                    ? 'Nothing fully paid matched the current search and dates.'
                    : 'Every fully paid order has been dispatched. New ones appear here the moment their final payment is recorded.'
                }
                actions={hasFilters ? <Button onClick={resetAll}>Clear filters</Button> : null}
              />
            ) : null}

            <Pagination meta={meta} onPage={setPage} unit="orders" />
          </>
        )}
      </Card>

      <p className="yard__footnote">
        Only orders the server confirms as fully paid — total received equal to the order total, not cancelled and
        not yet dispatched — are listed. Partially paid, unpaid and cancelled orders never appear here.
      </p>
    </div>
  );
}
