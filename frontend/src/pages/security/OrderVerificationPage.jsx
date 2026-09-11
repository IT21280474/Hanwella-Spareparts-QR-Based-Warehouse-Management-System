import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Phone, ScanLine, Truck, User } from 'lucide-react';
import { useDispatchOrder, useYardOrderQuery } from '@/hooks/queries/useSecurity';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { YARD_STATUS } from '@/constants/options';
import { toast } from '@/store/toastStore';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
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
import { GateStatus } from '@/components/security';
import { toApiError } from '@/utils/errors';
import { formatDate, formatDateTime, moneyExact, number, pluralize } from '@/utils/format';
import { paymentLabel, paymentTone } from '@/utils/status';
import './OrderVerificationPage.css';

/**
 * Verify one order against the goods, then release it.
 *
 * Everything shown is the server's view of the order; the Dispatch button is
 * only offered when the server says the order is ready, and the dispatch
 * request itself carries nothing but an optional note — the server re-checks
 * payment, cancellation and prior dispatch before recording anything.
 */
export default function OrderVerificationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();

  const [confirming, setConfirming] = useState(false);
  const [notes, setNotes] = useState('');

  const { data: order, isLoading, isError, error, refetch } = useYardOrderQuery(id);
  const dispatch = useDispatchOrder(id);

  useDocumentTitle(order ? `Verify ${order.order_no}` : 'Verify order');

  if (isError) {
    const apiError = toApiError(error);
    return (
      <div className="verify">
        <BackLink />
        <Card>
          {apiError.isNotFound ? (
            <EmptyState
              icon={ScanLine}
              title="This order is not in the yard"
              description="Only fully paid orders — or ones already dispatched — can be opened here. Search the order number from the gate dashboard for the reason."
              actions={
                <Link to="/security/dashboard">
                  <Button>Back to the gate</Button>
                </Link>
              }
            />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </Card>
      </div>
    );
  }

  const ready = order?.yard_status === YARD_STATUS.READY;
  const dispatched = order?.yard_status === YARD_STATUS.DISPATCHED;
  const canDispatch = ready && can(PERMISSIONS.DISPATCH_ORDERS);
  const items = order?.items ?? [];
  const totalQuantity = order?.total_quantity ?? items.reduce((sum, item) => sum + item.quantity, 0);

  const onConfirm = () => {
    dispatch.mutate(
      { notes: notes.trim() },
      {
        onSuccess: ({ dispatch: record, message }) => {
          setConfirming(false);
          setNotes('');
          toast.success('Order dispatched', message || `${order.order_no} released · ${record?.dispatch_no ?? ''}`);
        },
        onError: (dispatchError) => {
          setConfirming(false);
          toast.fromError(dispatchError, 'Dispatch refused');
        },
      },
    );
  };

  return (
    <div className="verify">
      <BackLink />

      <Card className="verify__head">
        {isLoading ? (
          <div className="verify__head-loading">
            <Skeleton width={220} height={26} />
            <Skeleton width={320} height={12} />
            <Skeleton height={76} />
          </div>
        ) : (
          <>
            <div className="verify__title-row">
              <div>
                <p className="verify__eyebrow">Order / bill no</p>
                <h1 className="verify__no mono">{order.order_no}</h1>
                <p className="verify__meta">
                  Ordered {formatDateTime(order.ordered_at)}
                  {order.paid_at ? ` · fully paid ${formatDateTime(order.paid_at)}` : ''}
                </p>
              </div>

              {canDispatch ? (
                <Button size="lg" icon={Truck} className="verify__dispatch" onClick={() => setConfirming(true)}>
                  Dispatch order
                </Button>
              ) : null}
            </div>

            <GateStatus order={order} />

            {dispatched && order.dispatch ? (
              <div className="verify__released" role="status">
                <Truck size={18} strokeWidth={1.9} aria-hidden="true" />
                <div>
                  <p className="verify__released-title">
                    Released at the gate — {order.dispatch.dispatch_no}. Do not release goods for this order again.
                  </p>
                  <p className="verify__released-body">
                    Dispatched {formatDateTime(order.dispatch.dispatched_at)} by {order.dispatch.dispatched_by?.name}
                    {order.dispatch.notes ? ` · “${order.dispatch.notes}”` : ''}
                  </p>
                </div>
              </div>
            ) : null}

            {ready && !can(PERMISSIONS.DISPATCH_ORDERS) ? (
              <p className="verify__readonly">Your account can view the yard but cannot record a dispatch.</p>
            ) : null}
          </>
        )}
      </Card>

      <div className="verify__layout">
        <Card className="verify__items">
          <CardHeader
            title={dispatched ? 'Items released' : 'Items to release'}
            subtitle={
              isLoading
                ? 'Loading the order lines…'
                : dispatched
                  ? `${pluralize(items.length, 'line')} · ${pluralize(totalQuantity, 'unit')} — as recorded at dispatch`
                  : `${pluralize(items.length, 'line')} · ${pluralize(totalQuantity, 'unit')} — check each against the goods before dispatch`
            }
          />

          {/* No min-width: on a phone the part number folds under the name and
              the QR column drops, so Quantity never scrolls out of sight. */}
          <TableWrap minWidth={0}>
            <thead>
              <tr>
                <Th width={44}>#</Th>
                <Th>Product</Th>
                <Th width={150} className="verify__wide">
                  Part no / SKU
                </Th>
                <Th width={60} className="verify__wide">
                  QR
                </Th>
                <Th align="right" width={96}>
                  Quantity
                </Th>
              </tr>
            </thead>

            {isLoading ? (
              <SkeletonRows rows={3} columns={5} />
            ) : (
              <tbody>
                {items.map((item, index) => (
                  <Tr key={item.id}>
                    <Td className="verify__line-no num">{index + 1}</Td>
                    <Td>
                      <span className="verify__part">{item.part_name}</span>
                      <span className="verify__codes mono">
                        <span className="verify__narrow">{item.part_number}</span>
                        {item.qr_code ? <span>{item.qr_code}</span> : null}
                      </span>
                    </Td>
                    <Td nowrap className="mono verify__part-no verify__wide">
                      {item.part_number}
                    </Td>
                    <Td className="verify__wide">{item.qr_code ? <QrImage code={item.qr_code} size={30} /> : null}</Td>
                    <Td align="right" nowrap>
                      <span className="verify__qty num">{number(item.quantity)}</span>
                      <span className="verify__unit">{item.unit || 'pcs'}</span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            )}

            {!isLoading && items.length > 0 ? (
              <tfoot>
                <tr className="verify__foot">
                  <td colSpan={2} className="verify__narrow-cell">{dispatched ? 'Total released' : 'Total to release'}</td>
                  <td colSpan={4} className="verify__wide-cell">{dispatched ? 'Total released' : 'Total to release'}</td>
                  <td className="num">{number(totalQuantity)}</td>
                </tr>
              </tfoot>
            ) : null}
          </TableWrap>
        </Card>

        <aside className="verify__aside">
          <Card>
            <CardHeader title="Customer" />
            <CardBody>
              {isLoading ? (
                <Skeleton height={44} />
              ) : (
                <div className="verify__customer">
                  <p className="verify__customer-name">
                    <User size={16} strokeWidth={1.8} aria-hidden="true" />
                    {order.customer_name}
                  </p>
                  <p className="verify__customer-phone mono">
                    <Phone size={15} strokeWidth={1.8} aria-hidden="true" />
                    {order.customer_phone || 'No phone on record'}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payment" subtitle="As recorded by Finance — read-only here" />
            <CardBody>
              {isLoading ? (
                <Skeleton height={110} />
              ) : (
                <dl className="verify__money">
                  <div>
                    <dt>Grand total</dt>
                    <dd className="num">{moneyExact(order.total)}</dd>
                  </div>
                  <div>
                    <dt>Total paid</dt>
                    <dd className="num">{moneyExact(order.paid_amount)}</dd>
                  </div>
                  <div className={`verify__balance ${order.balance > 0 ? 'is-owing' : 'is-clear'}`}>
                    <dt>Balance</dt>
                    <dd className="num">{moneyExact(order.balance)}</dd>
                  </div>
                  <div>
                    <dt>Payment status</dt>
                    <dd>
                      <Badge tone={order.is_fully_paid ? 'success' : paymentTone(order.payment_status)} dot>
                        {order.is_fully_paid ? 'FULLY PAID' : paymentLabel(order.payment_status)}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              )}
            </CardBody>
          </Card>

          {!isLoading && canDispatch ? (
            <Card className="verify__cta">
              <CardBody>
                <p className="verify__cta-text">
                  <ClipboardCheck size={16} strokeWidth={1.9} aria-hidden="true" />
                  Goods checked against every line?
                </p>
                <Button size="lg" fullWidth icon={Truck} onClick={() => setConfirming(true)}>
                  Dispatch order
                </Button>
              </CardBody>
            </Card>
          ) : null}

          {!isLoading && dispatched ? (
            <Button variant="secondary" size="lg" fullWidth icon={ScanLine} onClick={() => navigate('/security/dashboard')}>
              Verify the next order
            </Button>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => (dispatch.isPending ? null : setConfirming(false))}
        onConfirm={onConfirm}
        loading={dispatch.isPending}
        tone="primary"
        title={`Dispatch order ${order?.order_no ?? ''}?`}
        description={`Are you sure you want to dispatch Order ${order?.order_no ?? ''}? This is recorded against your name and cannot be undone.`}
        confirmLabel="Confirm dispatch"
        cancelLabel="Cancel"
      >
        {order ? (
          <>
            <dl className="verify__confirm">
              <div>
                <dt>Customer</dt>
                <dd>{order.customer_name}</dd>
              </div>
              <div>
                <dt>Number of items</dt>
                <dd className="num">{number(items.length)}</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd className="num">{pluralize(totalQuantity, 'unit')}</dd>
              </div>
              <div>
                <dt>Order total</dt>
                <dd className="num">{moneyExact(order.total)}</dd>
              </div>
              <div>
                <dt>Ordered</dt>
                <dd>{formatDate(order.ordered_at)}</dd>
              </div>
            </dl>
            {/* Focus lands here, not on Confirm: a handheld scanner's trailing
                Enter must never be what releases the goods. */}
            <Textarea
              value={notes}
              rows={2}
              maxLength={255}
              placeholder="Note (optional) — vehicle number, collected by…"
              aria-label="Dispatch note"
              data-autofocus
              onChange={(event) => setNotes(event.target.value)}
            />
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function BackLink() {
  return (
    <div className="verify__back">
      <Link to="/security/dashboard" className="verify__back-link">
        <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
        Gate dashboard
      </Link>
    </div>
  );
}
