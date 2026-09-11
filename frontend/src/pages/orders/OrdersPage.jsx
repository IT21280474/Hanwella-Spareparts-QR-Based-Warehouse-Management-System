import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ChevronRight, Printer, ReceiptText, ShoppingCart, Truck, X } from 'lucide-react';
import { useInvalidateOrders, useOrdersQuery } from '@/hooks/queries/useOrders';
import { ordersApi } from '@/services/api';
import { toast } from '@/store/toastStore';
import { useTableParams } from '@/hooks/useTableParams';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { PAYMENT_MODE_LABEL, PAYMENT_STATUS, PAYMENT_STATUS_LABEL } from '@/constants/options';
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
  SortableTh,
  TableWrap,
  Tabs,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { formatDateTime, money, number, pluralize } from '@/utils/format';
import { paymentLabel, paymentTone } from '@/utils/status';
import './OrdersPage.css';

const STATUS_TABS = [
  { value: 'All', label: 'All' },
  ...Object.values(PAYMENT_STATUS).map((status) => ({ value: status, label: PAYMENT_STATUS_LABEL[status] })),
];

/**
 * Counter sales, newest first.
 *
 * The outstanding column is the reason this screen exists — a shift ends by
 * looking at what is still unsettled, so it is never hidden behind a filter.
 */
export default function OrdersPage() {
  useDocumentTitle('Orders');
  const navigate = useNavigate();
  const { can } = usePermission();

  const { params, page, sort, direction, search, setParams, setPage, toggleSort, clear, hasFilters } = useTableParams({
    sort: 'ordered_at',
    direction: 'desc',
  });

  const [term, setTerm] = useState(search);
  const debouncedTerm = useDebounce(term);

  useEffect(() => {
    if (debouncedTerm !== search) setParams({ search: debouncedTerm });
  }, [debouncedTerm, search, setParams]);

  const query = {
    search: params.search || '',
    payment_status: params.payment_status || '',
    from: params.from || '',
    to: params.to || '',
    sort,
    direction,
    page,
    per_page: params.per_page,
  };

  const { data, isLoading, isFetching, isError, error, refetch } = useOrdersQuery(query);
  const rows = data?.rows ?? [];
  const meta = data?.meta;

  const invalidateOrders = useInvalidateOrders();
  const dispatchOrder = useMutation({
    mutationFn: (orderId) => ordersApi.dispatch(orderId),
    onSuccess: (result, orderId) => {
      invalidateOrders(orderId);
      toast.success('Order dispatched', result.message || 'Goods released.');
    },
    onError: (dispatchError) => toast.fromError(dispatchError, 'Could not dispatch this order'),
  });

  const counts = meta?.status_counts;
  const tabs = STATUS_TABS.map((tab) => ({
    ...tab,
    count: counts ? (tab.value === 'All' ? counts.all : counts[tab.value]) : undefined,
  }));

  const resetAll = () => {
    setTerm('');
    clear();
  };

  return (
    <div className="orders">
      <PageHeader
        title="Orders"
        description={
          meta
            ? `${number(meta.total)} orders · ${money(meta.booked_value ?? 0)} booked · ${money(meta.outstanding ?? 0)} outstanding`
            : 'Every counter sale, with what is still owed on it'
        }
        actions={
          can(PERMISSIONS.CREATE_STOCK_OUT) ? (
            <Link to="/sales/new">
              <Button icon={ShoppingCart}>New sale</Button>
            </Link>
          ) : null
        }
      />

      <Card>
        <Tabs
          tabs={tabs}
          value={params.payment_status || 'All'}
          onChange={(value) => setParams({ payment_status: value })}
          label="Payment status"
          className="orders__tabs"
        />

        <div className="orders__toolbar">
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="Search order no, customer or phone"
            label="Search orders"
          />

          <div className="orders__dates">
            <Input
              size="sm"
              type="date"
              value={params.from || ''}
              onChange={(event) => setParams({ from: event.target.value })}
              aria-label="From date"
            />
            <span className="orders__dash" aria-hidden="true">
              –
            </span>
            <Input
              size="sm"
              type="date"
              value={params.to || ''}
              onChange={(event) => setParams({ to: event.target.value })}
              aria-label="To date"
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
            <TableWrap minWidth={1000}>
              <thead>
                <tr>
                  <SortableTh column="ordered_at" sort={sort} direction={direction} onSort={toggleSort} width={150}>
                    When
                  </SortableTh>
                  <Th width={120}>Order</Th>
                  <Th>Customer</Th>
                  <Th align="right" width={80}>
                    Items
                  </Th>
                  <SortableTh column="total" sort={sort} direction={direction} onSort={toggleSort} align="right" width={110}>
                    Total
                  </SortableTh>
                  <Th align="right" width={110}>
                    Outstanding
                  </Th>
                  <Th width={130}>Payment</Th>
                  <Th align="right" width={92}>
                    Actions
                  </Th>
                </tr>
              </thead>

              {isLoading ? (
                <SkeletonRows rows={10} columns={8} />
              ) : (
                <tbody className={isFetching ? 'is-refreshing' : ''}>
                  {rows.map((order) => (
                    <Tr key={order.id}>
                      <Td nowrap className="orders__when">
                        {formatDateTime(order.ordered_at)}
                      </Td>

                      <Td nowrap>
                        <button
                          type="button"
                          className="orders__no mono"
                          onClick={() => navigate(`/orders/${order.id}`)}
                        >
                          {order.order_no}
                        </button>
                      </Td>

                      <Td>
                        <span className="orders__customer">{order.customer_name || 'Walk-in customer'}</span>
                        {order.customer_phone ? (
                          <span className="orders__phone mono">{order.customer_phone}</span>
                        ) : null}
                      </Td>

                      <Td align="right" nowrap className="orders__items">
                        {number(order.items_count ?? order.items?.length ?? 0)}
                      </Td>

                      <Td align="right" nowrap className="num orders__total">
                        {money(order.total)}
                      </Td>

                      <Td align="right" nowrap className="num">
                        {Number(order.outstanding) > 0 ? (
                          <span className="orders__outstanding">{money(order.outstanding)}</span>
                        ) : (
                          <span className="orders__settled">Settled</span>
                        )}
                      </Td>

                      <Td nowrap>
                        <Badge tone={paymentTone(order.payment_status)} dot>
                          {paymentLabel(order.payment_status)}
                        </Badge>
                        <span className="orders__mode">
                          {PAYMENT_MODE_LABEL[order.payment_mode] || order.payment_mode}
                        </span>
                      </Td>

                      <Td>
                        <div className="table__row-actions">
                          {can(PERMISSIONS.DISPATCH_ORDERS) && order.ready_for_dispatch ? (
                            <IconButton
                              icon={Truck}
                              label={`Dispatch ${order.order_no}`}
                              onClick={() => dispatchOrder.mutate(order.id)}
                              disabled={dispatchOrder.isPending}
                            />
                          ) : null}
                          <IconButton
                            icon={Printer}
                            label={`Print bill for ${order.order_no}`}
                            onClick={() => navigate(`/orders/${order.id}/bill`)}
                          />
                          <IconButton
                            icon={ChevronRight}
                            label={`Open ${order.order_no}`}
                            onClick={() => navigate(`/orders/${order.id}`)}
                          />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              )}
            </TableWrap>

            {!isLoading && rows.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No orders in this view"
                description="Nothing matched the current payment status, date range and search."
                actions={
                  <>
                    {hasFilters ? <Button onClick={resetAll}>Clear filters</Button> : null}
                    {can(PERMISSIONS.CREATE_STOCK_OUT) ? (
                      <Link to="/sales/new">
                        <Button variant="secondary" icon={ShoppingCart}>
                          Start a sale
                        </Button>
                      </Link>
                    ) : null}
                  </>
                }
              />
            ) : null}

            <Pagination meta={meta} onPage={setPage} unit="orders" />
          </>
        )}
      </Card>

      {meta?.total ? (
        <p className="orders__footnote">
          {pluralize(meta.total, 'order')} in this view. Cancelling an order returns its units to stock as compensating
          movements — an order is never silently deleted.
        </p>
      ) : null}
    </div>
  );
}
