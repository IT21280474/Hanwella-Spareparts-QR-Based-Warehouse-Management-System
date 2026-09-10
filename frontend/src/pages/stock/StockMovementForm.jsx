import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Check, Minus, Plus } from 'lucide-react';
import { usePartQuery } from '@/hooks/queries/useParts';
import { useStockIn, useStockOut } from '@/hooks/queries/useStock';
import { useWarehousesQuery, toSelectOptions } from '@/hooks/queries/useReference';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { toast } from '@/store/toastStore';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  IconButton,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';
import { PartPicker } from '@/components/parts/PartPicker';
import { StockGauge } from '@/components/inventory/StockGauge';
import { money, number } from '@/utils/format';
import { toApiError } from '@/utils/errors';
import { stockStatusLabel, stockStatusTone } from '@/utils/status';
import './StockMovementForm.css';

/**
 * Goods received and goods issued.
 *
 * Both directions are the same transaction with the sign reversed, so they are
 * one component: the copy, the tone and the availability rule differ, nothing
 * else. The projected balance is always shown before the write, because a
 * committed movement is never edited afterwards — only compensated.
 */
export function StockMovementForm({ direction }) {
  const isIn = direction === 'in';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useDocumentTitle(isIn ? 'Stock in' : 'Stock out');

  const [part, setPart] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [warehouseId, setWarehouseId] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(null);

  const warehouses = useWarehousesQuery();

  // Deep link from a part page: /stock/in?part=42 arrives with the part chosen.
  // Applied once — clearing the picker afterwards must not re-select it.
  const prefillId = searchParams.get('part');
  const [prefilled, setPrefilled] = useState(false);
  const prefill = usePartQuery(prefillId && !prefilled ? prefillId : null);

  useEffect(() => {
    if (!prefill.data || prefilled) return;
    setPart(prefill.data);
    setPrefilled(true);
  }, [prefill.data, prefilled]);

  const stockIn = useStockIn();
  const stockOut = useStockOut();
  const mutation = isIn ? stockIn : stockOut;

  const magnitude = Number(quantity) || 0;
  const onHand = Number(part?.quantity ?? 0);
  const projected = isIn ? onHand + magnitude : onHand - magnitude;
  const short = !isIn && part && magnitude > onHand;

  const quantityError = !part
    ? ''
    : magnitude <= 0
      ? 'Enter a quantity above 0'
      : short
        ? `Only ${number(onHand)} units are on hand`
        : '';

  const canSubmit = !!part && magnitude > 0 && !short;

  const reset = () => {
    setPart(null);
    setQuantity('1');
    setReference('');
    setNote('');
  };

  const submit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    const payload = {
      part_id: part.id,
      quantity: magnitude,
      warehouse_id: warehouseId ? Number(warehouseId) : null,
      reference_no: reference.trim() || null,
      note: note.trim() || null,
    };

    mutation.mutate(payload, {
      onSuccess: ({ message }) => {
        toast.success(
          isIn ? 'Stock received' : 'Stock issued',
          message || `${part.name} · ${isIn ? '+' : '−'}${magnitude}`,
        );
        setSubmitted({
          part,
          quantity: magnitude,
          balance: projected,
          reference: payload.reference_no,
        });
        reset();
      },
      onError: (error) => {
        const apiError = toApiError(error);
        toast.error(
          apiError.isConflict ? 'Stock position changed' : isIn ? 'Receipt rejected' : 'Issue rejected',
          apiError.message,
        );
      },
    });
  };

  return (
    <div className="stock-form">
      <PageHeader
        title={isIn ? 'Stock in' : 'Stock out'}
        description={
          isIn
            ? 'Record goods received against a spare part. The balance updates and a movement is written in the same transaction.'
            : 'Issue units out of the warehouse. Anything sold over the counter should go through a sale instead, so the bill and the movement stay linked.'
        }
        actions={
          <Link to="/movements">
            <Button variant="secondary" icon={ArrowLeftRight}>
              View ledger
            </Button>
          </Link>
        }
      />

      {submitted ? (
        <Card className="stock-form__receipt">
          <div className="stock-form__receipt-body">
            <span className="stock-form__receipt-mark" aria-hidden="true">
              <Check size={16} strokeWidth={3} />
            </span>
            <div>
              <p className="stock-form__receipt-title">
                {isIn ? 'Received' : 'Issued'} {number(submitted.quantity)} × {submitted.part.name}
              </p>
              <p className="stock-form__receipt-meta">
                New balance {number(submitted.balance)} units
                {submitted.reference ? ` · reference ${submitted.reference}` : ''}
              </p>
            </div>
            <div className="stock-form__receipt-actions">
              <Link to={`/inventory/${submitted.part.id}`}>
                <Button variant="secondary" size="sm">
                  Open part
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={() => setSubmitted(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <form onSubmit={submit} className="stock-form__layout">
        <div className="stock-form__main">
          <Card>
            <CardHeader
              title="Which part"
              subtitle="Search by name or part number, or scan the QR label into the box"
            />
            <CardBody>
              <PartPicker
                value={part}
                onSelect={setPart}
                onClear={() => setPart(null)}
                autoFocus
                label="Spare part"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={isIn ? 'Receipt details' : 'Issue details'}
              subtitle={isIn ? 'Quantity and where it came from' : 'Quantity and where it is going'}
            />
            <CardBody className="stock-form__fields">
              <Field label="Quantity" required error={quantityError} className="stock-form__quantity-field">
                {(field) => (
                  <div className="stock-form__stepper">
                    <IconButton
                      icon={Minus}
                      label="Decrease quantity"
                      onClick={() => setQuantity(String(Math.max(1, magnitude - 1)))}
                      disabled={magnitude <= 1}
                    />
                    <Input
                      {...field}
                      value={quantity}
                      inputMode="numeric"
                      className="stock-form__quantity"
                      onChange={(event) => setQuantity(event.target.value.replace(/[^0-9]/g, ''))}
                    />
                    <IconButton
                      icon={Plus}
                      label="Increase quantity"
                      onClick={() => setQuantity(String(magnitude + 1))}
                    />
                  </div>
                )}
              </Field>

              <Field label="Warehouse" hint="Leave blank for the default warehouse">
                {(field) => (
                  <Select
                    {...field}
                    value={warehouseId}
                    onChange={(event) => setWarehouseId(event.target.value)}
                    options={toSelectOptions(warehouses.data?.rows ?? [])}
                    placeholder="Default warehouse"
                  />
                )}
              </Field>

              <Field
                label="Reference"
                hint={isIn ? 'Supplier invoice or GRN number' : 'Issue note or job number'}
                className="stock-form__span"
              >
                {(field) => (
                  <Input
                    {...field}
                    value={reference}
                    mono
                    maxLength={60}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder={isIn ? 'INV-4471' : 'JOB-2210'}
                  />
                )}
              </Field>

              <Field label="Note" hint="Optional. Stored on the movement record." className="stock-form__span">
                {(field) => (
                  <Textarea
                    {...field}
                    value={note}
                    rows={2}
                    maxLength={500}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={
                      isIn
                        ? 'Two cartons short-shipped, balance to follow…'
                        : 'Issued to the workshop for job 2210…'
                    }
                  />
                )}
              </Field>
            </CardBody>
          </Card>
        </div>

        <aside className="stock-form__aside">
          <Card>
            <CardHeader title="Effect on stock" subtitle="Applied when you submit" />
            <CardBody>
              {part ? (
                <>
                  <div className="stock-form__preview">
                    <div className="stock-form__cell">
                      <span className="stock-form__cell-label">On hand</span>
                      <span className="stock-form__cell-value num">{number(onHand)}</span>
                    </div>
                    <span className="stock-form__arrow" data-direction={direction} aria-hidden="true">
                      {isIn ? '+' : '−'}
                      {number(magnitude)}
                    </span>
                    <div className="stock-form__cell">
                      <span className="stock-form__cell-label">After</span>
                      <span
                        className="stock-form__cell-value num"
                        data-tone={short ? 'danger' : projected <= Number(part.min_stock ?? 0) ? 'warning' : 'ok'}
                      >
                        {number(Math.max(0, projected))}
                      </span>
                    </div>
                  </div>

                  <StockGauge part={{ ...part, quantity: Math.max(0, projected) }} />

                  <div className="stock-form__facts">
                    <div className="stock-form__fact">
                      <span>Status after</span>
                      <Badge tone={stockStatusTone({ ...part, quantity: Math.max(0, projected) })} dot>
                        {stockStatusLabel({ ...part, quantity: Math.max(0, projected) })}
                      </Badge>
                    </div>
                    <div className="stock-form__fact">
                      <span>Value moved</span>
                      <strong className="num">{money(magnitude * Number(part.selling_price ?? 0))}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <p className="stock-form__hint">
                  Choose a spare part and the projected balance appears here before anything is written.
                </p>
              )}
            </CardBody>
          </Card>

          <div className="stock-form__submit">
            <Button
              type="submit"
              size="lg"
              fullWidth
              variant={isIn ? 'primary' : 'danger'}
              loading={mutation.isPending}
              disabled={!canSubmit}
            >
              {isIn ? 'Record receipt' : 'Issue stock'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => navigate('/movements')}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </aside>
      </form>
    </div>
  );
}
