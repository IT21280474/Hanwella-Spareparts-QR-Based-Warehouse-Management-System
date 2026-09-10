import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  History,
  Pencil,
  Plus,
  Printer,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { usePartMovementsQuery, usePartQuery, useDeletePart } from '@/hooks/queries/useParts';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePermission } from '@/hooks/usePermission';
import { useCartStore } from '@/store/cartStore';
import { toast } from '@/store/toastStore';
import { PERMISSIONS } from '@/constants/permissions';
import { MOVEMENT_TYPE_LABEL, PART_STATUS, PART_STATUS_LABEL } from '@/constants/options';
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
  Th,
  Tr,
} from '@/components/ui';
import { AdjustStockModal } from '@/components/inventory/AdjustStockModal';
import { StockGauge } from '@/components/inventory/StockGauge';
import { formatDate, formatDateTime, money, number, percent, signed } from '@/utils/format';
import { deltaTone, stockQuantityTone, stockStatusLabel, stockStatusTone } from '@/utils/status';
import './PartDetailPage.css';

/** Movement rows shown inline; the full history lives on /movements. */
const HISTORY_LIMIT = 12;

/**
 * One spare part: identity, stock position, commercials and its movement trail.
 *
 * The QR block is the anchor — this is the screen a scan lands on, so the code
 * and the on-hand figure sit above everything else a user might need.
 */
export default function PartDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const addToCart = useCartStore((state) => state.add);

  const [adjusting, setAdjusting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: part, isLoading, isError, error, refetch } = usePartQuery(id);
  const movements = usePartMovementsQuery(id, { per_page: HISTORY_LIMIT });
  const deletePart = useDeletePart();

  useDocumentTitle(part?.name || 'Spare part');

  if (isError) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }

  const onAddToCart = () => {
    if (addToCart(part)) toast.success('Added to order', `${part.name} × 1`);
    else toast.error('Out of stock', 'There are no units on hand to sell.');
  };

  const onDelete = () => {
    deletePart.mutate(part.id, {
      onSuccess: (message) => {
        toast.success('Spare part removed', message || part.name);
        navigate('/inventory', { replace: true });
      },
      onError: (deleteError) => {
        setConfirmingDelete(false);
        toast.fromError(deleteError, 'Could not remove this part');
      },
    });
  };

  const margin =
    part && Number(part.selling_price) > 0
      ? percent(Number(part.selling_price) - Number(part.cost_price), part.selling_price)
      : 0;

  return (
    <div className="part">
      <div className="part__back">
        <Link to="/inventory" className="part__back-link">
          <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
          All spare parts
        </Link>
      </div>

      <Card className="part__identity">
        <div className="part__identity-body">
          {isLoading ? (
            <Skeleton width={96} height={96} radius="var(--radius-md)" />
          ) : part.image_url ? (
            <img src={part.image_url} alt="" className="part__photo" />
          ) : null}

          <div className="part__qr">
            {isLoading ? (
              <Skeleton width={96} height={96} radius="var(--radius-md)" />
            ) : (
              <QrImage code={part.qr_code} size={96} />
            )}
            <p className="part__qr-code mono">{isLoading ? '…' : part.qr_code || 'Not issued'}</p>
          </div>

          <div className="part__identity-text">
            {isLoading ? (
              <>
                <Skeleton width={260} height={20} />
                <Skeleton width={180} height={12} />
              </>
            ) : (
              <>
                <div className="part__title-row">
                  <h1 className="part__name">{part.name}</h1>
                  <Badge tone={stockStatusTone(part)} dot>
                    {stockStatusLabel(part)}
                  </Badge>
                  {part.status === PART_STATUS.DISCONTINUED ? (
                    <Badge tone="neutral">{PART_STATUS_LABEL[PART_STATUS.DISCONTINUED]}</Badge>
                  ) : null}
                </div>

                <p className="part__meta">
                  <span className="mono">{part.part_number}</span>
                  <span className="part__dot" aria-hidden="true" />
                  <span className="mono">{part.sku}</span>
                  <span className="part__dot" aria-hidden="true" />
                  <span>{part.category?.name || 'Uncategorised'}</span>
                </p>

                {part.description ? <p className="part__description">{part.description}</p> : null}

                {part.vehicle_make || part.vehicle_model ? (
                  <p className="part__fitment">
                    Fits {[part.vehicle_make, part.vehicle_model].filter(Boolean).join(' ')}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {!isLoading ? (
            <div className="part__actions">
              {can(PERMISSIONS.CREATE_STOCK_OUT) ? (
                <Button icon={ShoppingCart} onClick={onAddToCart} disabled={Number(part.quantity) <= 0}>
                  Add to order
                </Button>
              ) : null}
              {can(PERMISSIONS.UPDATE_INVENTORY) ? (
                <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setAdjusting(true)}>
                  Adjust stock
                </Button>
              ) : null}
              {can(PERMISSIONS.UPDATE_INVENTORY) ? (
                <Link to={`/inventory/${part.id}/edit`}>
                  <Button variant="secondary" icon={Pencil}>
                    Edit
                  </Button>
                </Link>
              ) : null}
              {can(PERMISSIONS.PRINT_LABELS) && part.qr_code ? (
                <Link to={`/qr-labels?code=${encodeURIComponent(part.qr_code)}`}>
                  <Button variant="secondary" icon={Printer}>
                    Print QR
                  </Button>
                </Link>
              ) : null}
              {can(PERMISSIONS.DELETE_INVENTORY) ? (
                <Button variant="danger" icon={Trash2} onClick={() => setConfirmingDelete(true)}>
                  Delete
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="part__grid">
        <Card>
          <CardHeader title="Stock position" subtitle="On hand across every bin" />
          <CardBody>
            {isLoading ? (
              <Skeleton height={80} />
            ) : (
              <>
                <div className="part__stock">
                  <p className="part__stock-value num" style={{ color: stockQuantityTone(part) }}>
                    {number(part.quantity)}
                  </p>
                  <span className="part__stock-unit">{part.unit || 'units'}</span>
                  <span className="part__stock-min">minimum {number(part.min_stock)}</span>
                </div>
                <StockGauge part={part} />
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Commercials" subtitle="Per unit, and at current stock" />
          <CardBody>
            <dl className="part__facts">
              <Fact label="Selling price" value={isLoading ? null : money(part.selling_price)} strong />
              <Fact label="Cost price" value={isLoading ? null : money(part.cost_price)} />
              <Fact label="Margin" value={isLoading ? null : `${margin}%`} />
              <Fact
                label="Stock value"
                value={isLoading ? null : money(part.stock_value ?? part.quantity * part.selling_price)}
              />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Storage & supply" subtitle="Where it sits and who supplies it" />
          <CardBody>
            <dl className="part__facts">
              <Fact label="Bin" value={isLoading ? null : part.bin || '—'} mono />
              <Fact label="Supplier" value={isLoading ? null : part.supplier?.name || '—'} />
              <Fact label="Sold · last 90 days" value={isLoading ? null : `${number(part.sold_90d ?? 0)} units`} />
              <Fact label="Added" value={isLoading ? null : formatDate(part.created_at)} />
              <Fact label="Last updated" value={isLoading ? null : formatDate(part.updated_at)} />
            </dl>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Stock movement"
          subtitle={`Last ${HISTORY_LIMIT} entries for this part`}
          actions={
            can(PERMISSIONS.VIEW_TRANSACTIONS) ? (
              <Link to={`/movements?part=${id}`} className="part__link">
                Full history
              </Link>
            ) : null
          }
        />

        {movements.isError ? (
          <ErrorState error={movements.error} onRetry={movements.refetch} compact />
        ) : (
          <>
            <TableWrap minWidth={720}>
              <thead>
                <tr>
                  <Th width={150}>When</Th>
                  <Th>Type</Th>
                  <Th align="right" width={90}>
                    Change
                  </Th>
                  <Th align="right" width={120}>
                    Balance
                  </Th>
                  <Th>Reference</Th>
                  <Th width={140}>By</Th>
                </tr>
              </thead>

              {movements.isLoading ? (
                <SkeletonRows rows={5} columns={6} />
              ) : (
                <tbody>
                  {(movements.data?.rows ?? []).map((movement) => (
                    <Tr key={movement.id}>
                      <Td nowrap className="part__when">
                        {formatDateTime(movement.created_at)}
                      </Td>
                      <Td>{MOVEMENT_TYPE_LABEL[movement.type] || movement.type}</Td>
                      <Td align="right" nowrap>
                        <Badge tone={deltaTone(movement.quantity)} size="sm">
                          {signed(movement.quantity)}
                        </Badge>
                      </Td>
                      <Td align="right" nowrap className="num part__balance">
                        {number(movement.quantity_before)} → {number(movement.quantity_after)}
                      </Td>
                      <Td className="part__reference">
                        {movement.reference_no ? <span className="mono">{movement.reference_no}</span> : null}
                        {movement.reason ? <span className="part__reason">{movement.reason}</span> : null}
                        {!movement.reference_no && !movement.reason ? '—' : null}
                      </Td>
                      <Td nowrap className="part__when">
                        {movement.user?.name || 'System'}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              )}
            </TableWrap>

            {!movements.isLoading && (movements.data?.rows ?? []).length === 0 ? (
              <EmptyState
                icon={History}
                compact
                title="No movement recorded yet"
                description="Stock received, issued or adjusted against this part will appear here."
                actions={
                  can(PERMISSIONS.CREATE_STOCK_IN) ? (
                    <Link to={`/stock/in?part=${id}`}>
                      <Button size="sm" icon={Plus}>
                        Receive stock
                      </Button>
                    </Link>
                  ) : null
                }
              />
            ) : null}
          </>
        )}
      </Card>

      <AdjustStockModal open={adjusting} part={part} onClose={() => setAdjusting(false)} />

      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={onDelete}
        loading={deletePart.isPending}
        title="Delete this spare part?"
        confirmLabel="Delete part"
      >
        <p className="part__confirm">
          <strong>{part?.name}</strong> ({part?.qr_code || part?.part_number}) will be removed from the catalogue. Its
          movement history is retained for audit, and the QR identity is never reissued.
        </p>
      </ConfirmDialog>
    </div>
  );
}

/** One label/value pair in a fact list; renders a placeholder while loading. */
function Fact({ label, value, strong = false, mono = false }) {
  return (
    <div className="part__fact">
      <dt className="part__fact-label">{label}</dt>
      <dd className={['part__fact-value', strong ? 'is-strong' : '', mono ? 'mono' : ''].filter(Boolean).join(' ')}>
        {value === null ? <Skeleton width={70} height={12} /> : value}
      </dd>
    </div>
  );
}
