import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { stockApi } from '@/services/api';
import { useInvalidateParts } from '@/hooks/queries/useParts';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import {
  ADJUSTMENT_TYPE,
  ADJUSTMENT_TYPE_LABEL,
  NEGATIVE_ADJUSTMENT_TYPES,
  toOptions,
} from '@/constants/options';
import { toast } from '@/store/toastStore';
import { toApiError } from '@/utils/errors';
import './AdjustStockModal.css';

const LARGE_ADJUSTMENT = 50;

/**
 * Controlled stock correction.
 *
 * Quantity is never overwritten: the user states a delta and a reason, and the
 * server records before, delta and after as an adjustment plus a movement. The
 * projected result is shown before the change is committed.
 */
export function AdjustStockModal({ open, part, onClose, onAdjusted }) {
  const [type, setType] = useState(ADJUSTMENT_TYPE.STOCK_RECEIVED);
  const [quantity, setQuantity] = useState('10');
  const [note, setNote] = useState('');
  const invalidateParts = useInvalidateParts();

  useEffect(() => {
    if (open) {
      setType(ADJUSTMENT_TYPE.STOCK_RECEIVED);
      setQuantity('10');
      setNote('');
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: (payload) => stockApi.adjust(payload),
    onSuccess: ({ message }) => {
      invalidateParts(part?.id);
      toast.success('Stock updated', message || `${part?.qr_code} adjusted`);
      onAdjusted?.();
      onClose();
    },
    onError: (error) => toast.fromError(error, 'Adjustment rejected'),
  });

  if (!part) return null;

  const magnitude = Math.abs(Number(quantity) || 0);
  const negative = NEGATIVE_ADJUSTMENT_TYPES.includes(type);
  const delta = negative ? -magnitude : magnitude;
  const projected = Math.max(0, Number(part.quantity ?? 0) + delta);
  const wouldGoNegative = negative && Number(part.quantity ?? 0) - magnitude < 0;
  const apiError = mutation.isError ? toApiError(mutation.error) : null;

  const submit = (event) => {
    event.preventDefault();
    if (magnitude <= 0 || wouldGoNegative) return;
    mutation.mutate({
      part_id: part.id,
      adjustment_type: type,
      quantity: magnitude,
      note: note.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust stock"
      description={`${part.name} · ${part.qr_code || part.part_number}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={mutation.isPending}
            disabled={magnitude <= 0 || wouldGoNegative}
          >
            Apply adjustment
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="adjust">
        <Field label="Reason">
          {(field) => (
            <Select
              {...field}
              value={type}
              onChange={(event) => setType(event.target.value)}
              options={toOptions(ADJUSTMENT_TYPE_LABEL)}
              data-autofocus
            />
          )}
        </Field>

        <Field
          label="Quantity"
          required
          error={
            magnitude <= 0
              ? 'Enter a quantity above 0'
              : wouldGoNegative
                ? `Only ${part.quantity} units are on hand`
                : ''
          }
        >
          {(field) => (
            <Input
              {...field}
              value={quantity}
              inputMode="numeric"
              onChange={(event) => setQuantity(event.target.value.replace(/[^0-9]/g, ''))}
            />
          )}
        </Field>

        <div className="adjust__preview">
          <div className="adjust__cell">
            <span className="adjust__cell-label">On hand</span>
            <span className="adjust__cell-value num">{part.quantity}</span>
          </div>
          <span className="adjust__arrow" aria-hidden="true">
            {negative ? '−' : '+'}
            {magnitude}
          </span>
          <div className="adjust__cell">
            <span className="adjust__cell-label">After</span>
            <span
              className="adjust__cell-value num"
              style={{
                color:
                  negative && projected <= Number(part.min_stock ?? 0)
                    ? 'var(--color-warning)'
                    : 'var(--color-success)',
              }}
            >
              {projected}
            </span>
          </div>
        </div>

        {magnitude >= LARGE_ADJUSTMENT ? (
          <p className="adjust__warning">
            This is a large adjustment ({magnitude} units). It is recorded against your account in the audit log.
          </p>
        ) : null}

        <Field label="Note" hint="Optional. Appears on the movement record.">
          {(field) => (
            <Textarea
              {...field}
              value={note}
              rows={2}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Cycle count, damaged in transit, supplier short-shipped…"
            />
          )}
        </Field>

        {apiError ? (
          <p className="adjust__error" role="alert">
            {apiError.message}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
