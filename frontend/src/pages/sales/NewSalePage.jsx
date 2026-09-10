import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ScanLine, ShoppingCart, Trash2 } from 'lucide-react';
import { useCreateOrder } from '@/hooks/queries/useOrders';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cartTotals, useCartStore } from '@/store/cartStore';
import { useScanStore } from '@/store/scanStore';
import { toast } from '@/store/toastStore';
import {
  CHECKOUT_PAYMENT_STATUSES,
  PAYMENT_MODE_LABEL,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABEL,
  toOptions,
} from '@/constants/options';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  QrImage,
  SegmentedControl,
  Select,
} from '@/components/ui';
import { PartPicker } from '@/components/parts/PartPicker';
import { money, number, pluralize } from '@/utils/format';
import { toApiError } from '@/utils/errors';
import './NewSalePage.css';

/**
 * Counter sale.
 *
 * The basket is a draft held in the browser; the server re-resolves every price
 * and every stock position when the order is submitted, and either commits the
 * whole sale or none of it. So a line that looks affordable here can still be
 * rejected — that rejection is reported against the part it came from rather
 * than as a generic failure.
 */
export default function NewSalePage() {
  useDocumentTitle('New sale');
  const navigate = useNavigate();

  const cart = useCartStore();
  const totals = cartTotals(cart);
  const recent = useScanStore((state) => state.recent);

  const [confirmingClear, setConfirmingClear] = useState(false);
  const createOrder = useCreateOrder();

  const partiallyPaid = cart.paymentStatus === PAYMENT_STATUS.PARTIALLY_PAID;
  const [paidAmount, setPaidAmount] = useState('');

  const paid =
    cart.paymentStatus === PAYMENT_STATUS.PAID
      ? totals.total
      : partiallyPaid
        ? Math.min(Number(paidAmount) || 0, totals.total)
        : 0;

  const outstanding = totals.total - paid;

  const addPart = (part) => {
    if (cart.add(part)) toast.success('Added to order', `${part.name} × 1`);
    else toast.error('Out of stock', `${part.name} has no units on hand.`);
  };

  const checkout = () => {
    if (totals.lineCount === 0) return;

    const payload = {
      customer_name: cart.customerName.trim() || 'Walk-in customer',
      customer_phone: cart.customerPhone.trim() || null,
      discount: totals.discount,
      payment_status: cart.paymentStatus,
      payment_mode: cart.paymentMode,
      paid_amount: paid,
      items: cart.lines.map((line) => ({ part_id: line.partId, quantity: line.quantity })),
    };

    createOrder.mutate(payload, {
      onSuccess: ({ order, message }) => {
        toast.success('Sale completed', message || order.order_no);
        cart.clear();
        navigate(`/sales/${order.id}/complete`);
      },
      onError: (error) => {
        const apiError = toApiError(error);
        toast.error(
          apiError.isConflict ? 'Stock moved while you were selling' : 'Sale not completed',
          apiError.message,
        );
      },
    });
  };

  return (
    <div className="sale">
      <PageHeader
        title="New sale"
        description="Scan or search parts, confirm the quantities, and settle. Stock is deducted the moment the sale is committed."
        actions={
          <>
            <Link to="/scan">
              <Button variant="secondary" icon={ScanLine}>
                Scan a part
              </Button>
            </Link>
            {totals.lineCount > 0 ? (
              <Button variant="secondary" icon={Trash2} onClick={() => setConfirmingClear(true)}>
                Clear order
              </Button>
            ) : null}
          </>
        }
      />

      <div className="sale__layout">
        <div className="sale__main">
          <Card>
            <CardHeader title="Add a part" subtitle="Search by name or part number, or scan a QR label" />
            <CardBody>
              <PartPicker onSelect={addPart} autoFocus label="Find a spare part" />

              {recent.length > 0 ? (
                <div className="sale__recent">
                  <p className="eyebrow">Recent scans</p>
                  <div className="sale__recent-strip">
                    {recent.map((part) => (
                      <button key={part.id} type="button" className="sale__chip" onClick={() => addPart(part)}>
                        <QrImage code={part.qr_code} size={22} />
                        <span className="sale__chip-name">{part.name}</span>
                        <Plus size={13} strokeWidth={2} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Order lines"
              subtitle={
                totals.lineCount
                  ? `${pluralize(totals.lineCount, 'line item')} · ${number(totals.units)} units`
                  : 'Nothing added yet'
              }
            />

            {totals.lineCount === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="The order is empty"
                description="Add parts with the search above, or scan the QR labels on the bins. The basket survives a page reload, so a half-built sale is never lost."
                actions={
                  <Link to="/scan">
                    <Button icon={ScanLine}>Scan a part</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="sale__lines">
                {cart.lines.map((line) => {
                  const remaining = line.available - line.quantity;
                  return (
                    <li key={line.partId} className="sale__line">
                      <QrImage code={line.qrCode} size={34} />

                      <div className="sale__line-text">
                        <p className="sale__line-name">{line.name}</p>
                        <p className="sale__line-meta">
                          <span className="mono">{line.partNumber}</span>
                          <span className="sale__sep" aria-hidden="true">
                            |
                          </span>
                          <span>{money(line.unitPrice)} each</span>
                        </p>
                      </div>

                      <div className="sale__line-stepper">
                        <IconButton
                          icon={Minus}
                          label={`Reduce ${line.name}`}
                          onClick={() => cart.decrement(line.partId)}
                        />
                        <Input
                          size="sm"
                          value={line.quantity}
                          inputMode="numeric"
                          className="sale__line-qty"
                          aria-label={`Quantity of ${line.name}`}
                          onChange={(event) => cart.setQuantity(line.partId, event.target.value.replace(/[^0-9]/g, ''))}
                        />
                        <IconButton
                          icon={Plus}
                          label={`Add another ${line.name}`}
                          onClick={() => cart.increment(line.partId)}
                          disabled={line.quantity >= line.available}
                        />
                      </div>

                      <div className="sale__line-right">
                        <span className="sale__line-total num">{money(line.unitPrice * line.quantity)}</span>
                        <span className="sale__line-left" data-low={remaining <= 0 ? 'true' : undefined}>
                          {remaining <= 0 ? 'None left after sale' : `${number(remaining)} left after sale`}
                        </span>
                      </div>

                      <IconButton
                        icon={Trash2}
                        label={`Remove ${line.name}`}
                        variant="danger"
                        onClick={() => cart.remove(line.partId)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Customer" subtitle="Optional — a walk-in sale needs no details" />
            <CardBody className="sale__customer">
              <Field label="Name">
                {(field) => (
                  <Input
                    {...field}
                    value={cart.customerName}
                    maxLength={120}
                    placeholder="Walk-in customer"
                    onChange={(event) => cart.setCustomerName(event.target.value)}
                  />
                )}
              </Field>

              <Field label="Phone">
                {(field) => (
                  <Input
                    {...field}
                    value={cart.customerPhone}
                    maxLength={20}
                    inputMode="tel"
                    placeholder="07X XXX XXXX"
                    onChange={(event) => cart.setCustomerPhone(event.target.value)}
                  />
                )}
              </Field>
            </CardBody>
          </Card>
        </div>

        <aside className="sale__aside">
          <Card>
            <CardHeader title="Settlement" subtitle="How this sale is being paid" />
            <CardBody className="sale__settle">
              <Field label="Discount">
                {(field) => (
                  <Input
                    {...field}
                    value={cart.discount}
                    inputMode="numeric"
                    prefix="Rs"
                    placeholder="0"
                    onChange={(event) => cart.setDiscount(event.target.value)}
                  />
                )}
              </Field>

              {/* A radiogroup names itself through aria-label, so it is not
                  wrapped in <Field> — that would emit a <label for> pointing
                  at an element that does not exist. */}
              <div className="sale__segment">
                <span className="sale__segment-label">Payment status</span>
                <SegmentedControl
                  options={CHECKOUT_PAYMENT_STATUSES.map((status) => ({
                    value: status,
                    label: PAYMENT_STATUS_LABEL[status],
                  }))}
                  value={cart.paymentStatus}
                  onChange={cart.setPaymentStatus}
                  label="Payment status"
                  size="sm"
                />
              </div>

              {partiallyPaid ? (
                <Field label="Amount received" hint={`Balance ${money(Math.max(0, outstanding))} remains outstanding`}>
                  {(field) => (
                    <Input
                      {...field}
                      value={paidAmount}
                      inputMode="numeric"
                      prefix="Rs"
                      onChange={(event) => setPaidAmount(event.target.value.replace(/[^0-9]/g, ''))}
                    />
                  )}
                </Field>
              ) : null}

              <Field label="Payment mode">
                {(field) => (
                  <Select
                    {...field}
                    value={cart.paymentMode}
                    onChange={(event) => cart.setPaymentMode(event.target.value)}
                    options={toOptions(PAYMENT_MODE_LABEL)}
                  />
                )}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Total" subtitle={`${number(totals.units)} units`} />
            <CardBody>
              <dl className="sale__totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd className="num">{money(totals.subtotal)}</dd>
                </div>
                <div>
                  <dt>Discount</dt>
                  <dd className="num">{totals.discount ? `− ${money(totals.discount)}` : money(0)}</dd>
                </div>
                <div className="sale__totals-grand">
                  <dt>Total</dt>
                  <dd className="num">{money(totals.total)}</dd>
                </div>
                {outstanding > 0 ? (
                  <div className="sale__totals-outstanding">
                    <dt>Outstanding</dt>
                    <dd className="num">{money(outstanding)}</dd>
                  </div>
                ) : null}
              </dl>

              <Button
                size="lg"
                fullWidth
                className="sale__checkout"
                loading={createOrder.isPending}
                disabled={totals.lineCount === 0}
                onClick={checkout}
              >
                Complete sale · {money(totals.total)}
              </Button>

              <p className="sale__note">
                Stock is deducted and the bill is issued in one transaction. Nothing is written until this succeeds.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmingClear}
        onClose={() => setConfirmingClear(false)}
        onConfirm={() => {
          cart.clear();
          setConfirmingClear(false);
          toast.info('Order cleared', 'The basket is empty.');
        }}
        title="Clear this order?"
        confirmLabel="Clear order"
      >
        <p className="sale__confirm">
          {pluralize(totals.lineCount, 'line item')} will be removed from the basket. No stock has moved, so nothing
          else is affected.
        </p>
      </ConfirmDialog>
    </div>
  );
}
