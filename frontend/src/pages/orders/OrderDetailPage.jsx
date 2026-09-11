import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Check, Clock, Package, Printer, ReceiptText, ShieldCheck, Truck } from 'lucide-react';
import { useCancelOrder, useDispatchOrder, useOrderQuery, useUpdateOrderPayment } from '@/hooks/queries/useOrders';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePermission } from '@/hooks/usePermission';
import { toast } from '@/store/toastStore';
import { PERMISSIONS } from '@/constants/permissions';
import { PAYMENT_MODE_LABEL, PAYMENT_STATUS } from '@/constants/options';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  QrImage,
  Skeleton,
  SkeletonRows,
  TableWrap,
  Td,
  Textarea,
  Th,
  Tr,
} from '@/components/ui';
import { formatDateTime, money, number, pluralize } from '@/utils/format';
import { paymentLabel, paymentTone } from '@/utils/status';
import './OrderDetailPage.css';

/**
 * Where an order sits in its life. Derived from the record rather than stored,
 * so the timeline can never drift from the payment state it describes.
 */
function timelineFor(order) {
  if (!order) return [];

  const cancelled = order.payment_status === PAYMENT_STATUS.CANCELLED;
  const settled = order.payment_status === PAYMENT_STATUS.PAID;
  const partial = order.payment_status === PAYMENT_STATUS.PARTIALLY_PAID;
  const stockOut = Boolean(order.stock_deducted_at);
  const dispatched = Boolean(order.dispatched_at);

  return [
    { label: 'Order placed', detail: formatDateTime(order.ordered_at), state: 'done', icon: ReceiptText },
    {
      label: cancelled ? 'Payment voided' : settled ? 'Payment received' : partial ? 'Part payment received' : 'Payment pending',
      detail: cancelled
        ? 'No amount is collectable'
        : settled
          ? `${money(order.paid_amount)} · ${PAYMENT_MODE_LABEL[order.payment_mode] || order.payment_mode}`
          : `${money(order.outstanding)} outstanding`,
      state: cancelled ? 'undone' : settled ? 'done' : 'current',
      icon: settled ? Check : Clock,
    },
    {
      // Stock only leaves once the order is fully paid — a pending order's
      // units are still sitting on the shelf, not reserved or moved.
      label: stockOut ? 'Stock deducted' : 'Stock not yet deducted',
      detail: stockOut
        ? `${pluralize(order.items?.length ?? 0, 'line item')} moved out`
        : 'Waiting on full payment',
      state: cancelled && !stockOut ? 'todo' : stockOut ? 'done' : 'todo',
      icon: Package,
    },
    {
      label: dispatched ? 'Dispatched' : cancelled ? 'Order cancelled' : 'Awaiting dispatch',
      detail: dispatched
        ? `Verified by ${order.dispatched_by?.name || 'security'} · ${formatDateTime(order.dispatched_at)}`
        : cancelled
          ? stockOut
            ? 'Units returned to stock'
            : 'No stock was ever taken'
          : settled
            ? 'Ready for security to verify and release'
            : 'Needs full payment first',
      state: dispatched ? 'done' : cancelled ? 'undone' : 'todo',
      icon: cancelled ? Ban : dispatched ? ShieldCheck : Truck,
    },
    {
      label: 'Bill issued',
      detail: cancelled ? 'Order cancelled' : 'Ready to print',
      state: cancelled ? 'undone' : 'done',
      icon: Printer,
    },
  ];
}

/**
 * One counter sale in full.
 *
 * Payment state and cancellation are the only things editable here — the lines
 * themselves are a snapshot taken at the moment of sale, so a later price
 * change never rewrites what a customer was charged.
 */
export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();

  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const { data: order, isLoading, isError, error, refetch } = useOrderQuery(id);
  const updatePayment = useUpdateOrderPayment(id);
  const cancelOrder = useCancelOrder(id);
  const dispatchOrder = useDispatchOrder(id);

  useDocumentTitle(order ? `Order ${order.order_no}` : 'Order');

  if (isError) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }

  const cancelled = order?.payment_status === PAYMENT_STATUS.CANCELLED;
  const dispatched = Boolean(order?.dispatched_at);

  const setPaymentStatus = (status) => {
    updatePayment.mutate(
      {
        payment_status: status,
        paid_amount: status === PAYMENT_STATUS.PAID ? Number(order.total) : 0,
      },
      {
        onSuccess: ({ message }) => toast.success('Payment updated', message || paymentLabel(status)),
        onError: (updateError) => toast.fromError(updateError, 'Could not update the payment'),
      },
    );
  };

  const onDispatch = () => {
    dispatchOrder.mutate(undefined, {
      onSuccess: ({ message }) => toast.success('Order dispatched', message || 'Goods released.'),
      onError: (dispatchError) => toast.fromError(dispatchError, 'Could not dispatch this order'),
    });
  };

  const onCancel = () => {
    cancelOrder.mutate(
      { reason: cancelReason.trim() || null },
      {
        onSuccess: ({ message }) => {
          toast.success('Order cancelled', message || 'Units have been returned to stock.');
          setCancelling(false);
          setCancelReason('');
        },
        onError: (cancelError) => {
          setCancelling(false);
          toast.fromError(cancelError, 'Could not cancel this order');
        },
      },
    );
  };

  return (
    <div className="order">
      <div className="order__back">
        <Link to="/orders" className="order__back-link">
          <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
          All orders
        </Link>
      </div>

      <Card>
        <div className="order__head">
          <div className="order__head-text">
            {isLoading ? (
              <>
                <Skeleton width={180} height={20} />
                <Skeleton width={240} height={12} />
              </>
            ) : (
              <>
                <div className="order__title-row">
                  <h1 className="order__no mono">{order.order_no}</h1>
                  <Badge tone={paymentTone(order.payment_status)} dot>
                    {paymentLabel(order.payment_status)}
                  </Badge>
                  {dispatched ? (
                    <Badge tone="info" dot>
                      Dispatched
                    </Badge>
                  ) : order.ready_for_dispatch ? (
                    <Badge tone="warning" dot>
                      Ready for dispatch
                    </Badge>
                  ) : null}
                </div>
                <p className="order__meta">
                  {formatDateTime(order.ordered_at)} · {order.customer_name || 'Walk-in customer'}
                  {order.customer_phone ? ` · ${order.customer_phone}` : ''}
                  {order.cashier?.name ? ` · served by ${order.cashier.name}` : ''}
                </p>
              </>
            )}
          </div>

          {!isLoading ? (
            <div className="order__actions">
              <Link to={`/orders/${id}/bill`}>
                <Button variant="secondary" icon={Printer}>
                  Print bill
                </Button>
              </Link>

              {can(PERMISSIONS.DISPATCH_ORDERS) && order.ready_for_dispatch ? (
                <Button icon={Truck} loading={dispatchOrder.isPending} onClick={onDispatch}>
                  Dispatch
                </Button>
              ) : null}

              {can(PERMISSIONS.CREATE_STOCK_OUT) && !cancelled && !dispatched ? (
                <>
                  {order.payment_status !== PAYMENT_STATUS.PAID ? (
                    <Button
                      icon={Check}
                      loading={updatePayment.isPending}
                      onClick={() => setPaymentStatus(PAYMENT_STATUS.PAID)}
                    >
                      Mark paid
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      icon={Clock}
                      loading={updatePayment.isPending}
                      onClick={() => setPaymentStatus(PAYMENT_STATUS.PENDING)}
                    >
                      Mark pending
                    </Button>
                  )}

                  <Button variant="danger" icon={Ban} onClick={() => setCancelling(true)}>
                    Cancel order
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="order__layout">
        <div className="order__main">
          <Card>
            <CardHeader
              title="Line items"
              subtitle="Prices as charged at the time of sale"
            />

            <TableWrap minWidth={720}>
              <thead>
                <tr>
                  <Th width={46}>QR</Th>
                  <Th>Spare part</Th>
                  <Th align="right" width={110}>
                    Unit price
                  </Th>
                  <Th align="right" width={72}>
                    Qty
                  </Th>
                  <Th align="right" width={120}>
                    Line total
                  </Th>
                </tr>
              </thead>

              {isLoading ? (
                <SkeletonRows rows={4} columns={5} />
              ) : (
                <tbody>
                  {(order.items ?? []).map((item) => (
                    <Tr key={item.id}>
                      <Td>
                        <QrImage code={item.qr_code} size={28} />
                      </Td>
                      <Td>
                        {item.part_id ? (
                          <button
                            type="button"
                            className="table__primary"
                            onClick={() => navigate(`/inventory/${item.part_id}`)}
                          >
                            <span className="table__primary-name">{item.part_name}</span>
                            <span className="table__primary-meta">
                              <span>{item.part_number}</span>
                              {item.part_quantity_now !== null && item.part_quantity_now !== undefined ? (
                                <>
                                  <span className="sep">|</span>
                                  <span>{number(item.part_quantity_now)} on hand now</span>
                                </>
                              ) : null}
                            </span>
                          </button>
                        ) : (
                          <span className="order__gone">{item.part_name} · part since removed</span>
                        )}
                      </Td>
                      <Td align="right" nowrap className="num">
                        {money(item.unit_price)}
                      </Td>
                      <Td align="right" nowrap className="num">
                        {number(item.quantity)}
                      </Td>
                      <Td align="right" nowrap className="num order__line-total">
                        {money(item.line_total)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              )}
            </TableWrap>
          </Card>

          <Card>
            <CardHeader title="Progress" subtitle="Where this order stands" />
            <CardBody>
              {isLoading ? (
                <Skeleton height={120} />
              ) : (
                <ol className="order__timeline">
                  {timelineFor(order).map((step) => {
                    const Icon = step.icon;
                    return (
                      <li key={step.label} className="order__step" data-state={step.state}>
                        <span className="order__step-mark" aria-hidden="true">
                          <Icon size={13} strokeWidth={2} />
                        </span>
                        <div className="order__step-text">
                          <p className="order__step-label">{step.label}</p>
                          <p className="order__step-detail">{step.detail}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="order__aside">
          <Card>
            <CardHeader title="Settlement" subtitle="What was charged and what was received" />
            <CardBody>
              <dl className="order__totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd className="num">{isLoading ? '—' : money(order.subtotal)}</dd>
                </div>
                <div>
                  <dt>Discount</dt>
                  <dd className="num">{isLoading ? '—' : order.discount ? `− ${money(order.discount)}` : money(0)}</dd>
                </div>
                <div className="order__totals-grand">
                  <dt>Total</dt>
                  <dd className="num">{isLoading ? '—' : money(order.total)}</dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd className="num">{isLoading ? '—' : money(order.paid_amount)}</dd>
                </div>
                {!isLoading && Number(order.outstanding) > 0 ? (
                  <div className="order__totals-outstanding">
                    <dt>Outstanding</dt>
                    <dd className="num">{money(order.outstanding)}</dd>
                  </div>
                ) : null}
              </dl>

              {!isLoading ? (
                <p className="order__mode">
                  Paid by {PAYMENT_MODE_LABEL[order.payment_mode] || order.payment_mode}
                </p>
              ) : null}
            </CardBody>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        onConfirm={onCancel}
        loading={cancelOrder.isPending}
        title="Cancel this order?"
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
      >
        <p className="order__confirm">
          Every unit on <strong className="mono">{order?.order_no}</strong> is returned to stock as a compensating
          movement. The order stays on record as cancelled — nothing is deleted.
        </p>
        <Textarea
          value={cancelReason}
          rows={2}
          maxLength={300}
          placeholder="Reason (optional) — customer changed their mind, wrong part issued…"
          aria-label="Cancellation reason"
          onChange={(event) => setCancelReason(event.target.value)}
        />
      </ConfirmDialog>
    </div>
  );
}
