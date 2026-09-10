import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Printer, TriangleAlert } from 'lucide-react';
import { qrApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  Field,
  Input,
  PageHeader,
  QrImage,
  Select,
  Skeleton,
  StatGrid,
  StatTile,
} from '@/components/ui';
import { QR_BATCH_WARNING_THRESHOLD, QR_LAYOUTS, QR_MAX_BATCH } from '@/constants/options';
import { number, pluralize } from '@/utils/format';
import './QrGeneratePage.css';

/** Labels shown as a sample before the full sheet is built. */
const PREVIEW_COUNT = 8;

const layoutOf = (value) => QR_LAYOUTS.find((layout) => layout.value === value) ?? QR_LAYOUTS[0];

/**
 * Set up a QR label print run.
 *
 * The sequence is owned by the server — this screen asks for a range and gets
 * back the identities that actually exist in it, so a print run can never
 * invent a code or duplicate one already fixed to a bin.
 */
export default function QrGeneratePage() {
  useDocumentTitle('Generate QR labels');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [from, setFrom] = useState(searchParams.get('from') || '1');
  const [count, setCount] = useState(searchParams.get('count') || '40');
  const [layout, setLayout] = useState(searchParams.get('layout') || QR_LAYOUTS[0].value);
  const [confirming, setConfirming] = useState(false);

  const start = Math.max(1, Number(from) || 1);
  const requested = Math.min(Math.max(0, Number(count) || 0), QR_MAX_BATCH);
  const chosenLayout = layoutOf(layout);
  const sheets = requested > 0 ? Math.ceil(requested / chosenLayout.perSheet) : 0;

  const params = useMemo(
    () => ({ from: start, count: requested, layout }),
    [start, requested, layout],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.qr.labels(params),
    queryFn: () => qrApi.labels(params),
    enabled: requested > 0,
  });

  const labels = data?.labels ?? [];
  const assigned = labels.filter((label) => label.assigned).length;
  const unassigned = labels.length - assigned;

  const countError =
    Number(count) > QR_MAX_BATCH
      ? `A single run is capped at ${QR_MAX_BATCH} labels`
      : requested <= 0
        ? 'Enter how many labels to print'
        : '';

  const openSheet = () => {
    setConfirming(false);
    navigate(`/qr-labels/sheet?from=${start}&count=${requested}&layout=${layout}`);
  };

  const onPrint = () => {
    if (requested > QR_BATCH_WARNING_THRESHOLD) setConfirming(true);
    else openSheet();
  };

  return (
    <div className="qr-gen">
      <PageHeader
        title="Generate QR labels"
        description="One identity covers a whole part type across every bin, so a label is printed once and reprinted only if it is damaged."
        actions={
          <Link to="/inventory">
            <Button variant="secondary" icon={FileText}>
              Inventory
            </Button>
          </Link>
        }
      />

      <div className="qr-gen__layout">
        <div className="qr-gen__main">
          <Card>
            <CardHeader title="Print run" subtitle="Which identities, and on what sheet" />
            <CardBody className="qr-gen__fields">
              <Field label="Start at" hint="Sequence number, not the part id">
                {(field) => (
                  <Input
                    {...field}
                    value={from}
                    inputMode="numeric"
                    prefix="SJL-"
                    onChange={(event) => setFrom(event.target.value.replace(/[^0-9]/g, ''))}
                  />
                )}
              </Field>

              <Field label="How many" required error={countError}>
                {(field) => (
                  <Input
                    {...field}
                    value={count}
                    inputMode="numeric"
                    onChange={(event) => setCount(event.target.value.replace(/[^0-9]/g, ''))}
                  />
                )}
              </Field>

              <Field label="Sheet layout">
                {(field) => (
                  <Select
                    {...field}
                    value={layout}
                    onChange={(event) => setLayout(event.target.value)}
                    options={QR_LAYOUTS}
                  />
                )}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Preview"
              subtitle={
                requested > 0
                  ? `First ${Math.min(PREVIEW_COUNT, requested)} of ${pluralize(requested, 'label')}`
                  : 'Set a count to see the labels'
              }
            />
            <CardBody>
              {requested <= 0 ? (
                <p className="qr-gen__hint">Enter how many labels to print and the first few appear here.</p>
              ) : isError ? (
                <ErrorState error={error} onRetry={refetch} compact />
              ) : isLoading ? (
                <div className="qr-gen__preview">
                  {Array.from({ length: PREVIEW_COUNT }).map((_, index) => (
                    <Skeleton key={index} height={58} radius="var(--radius-xs)" />
                  ))}
                </div>
              ) : (
                <div className="qr-gen__preview">
                  {labels.slice(0, PREVIEW_COUNT).map((label) => (
                    <div key={label.code} className="qr-gen__label" data-assigned={label.assigned ? 'true' : 'false'}>
                      <QrImage code={label.code} size={44} bordered={false} />
                      <div className="qr-gen__label-text">
                        <p className="qr-gen__label-code mono">{label.code}</p>
                        <p className="qr-gen__label-pn mono">{label.part_number || 'Unassigned'}</p>
                        <p className="qr-gen__label-name">{label.part_name || 'No part holds this identity yet'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="qr-gen__aside">
          <StatGrid min={130}>
            <StatTile
              label="Labels"
              value={number(requested)}
              sub={`${chosenLayout.perSheet} per sheet`}
              loading={false}
            />
            <StatTile label="Sheets" value={number(sheets)} sub="A4 pages" />
          </StatGrid>

          <Card>
            <CardHeader title="This run" subtitle="Resolved against the sequence" />
            <CardBody>
              <dl className="qr-gen__facts">
                <div>
                  <dt>Range</dt>
                  <dd className="mono">
                    {labels.length > 0
                      ? `${labels[0].code} – ${labels[labels.length - 1].code}`
                      : `SJL-${String(start).padStart(5, '0')} …`}
                  </dd>
                </div>
                <div>
                  <dt>Assigned</dt>
                  <dd>
                    <Badge tone="success" size="sm">
                      {number(assigned)}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt>Unassigned</dt>
                  <dd>
                    <Badge tone={unassigned ? 'warning' : 'neutral'} size="sm">
                      {number(unassigned)}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt>Layout</dt>
                  <dd>{chosenLayout.label}</dd>
                </div>
              </dl>

              {unassigned > 0 ? (
                <p className="qr-gen__warning">
                  <TriangleAlert size={14} strokeWidth={1.9} aria-hidden="true" />
                  {pluralize(unassigned, 'label')} in this range is not yet held by a spare part. Printing them is fine
                  — they become valid the moment a part claims the identity.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Button size="lg" fullWidth icon={Printer} disabled={requested <= 0 || isLoading} onClick={onPrint}>
            Build the sheet
          </Button>
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={openSheet}
        tone="primary"
        title={`Print ${requested} labels?`}
        confirmLabel="Build the sheet"
      >
        <p className="qr-gen__confirm">
          That is {pluralize(sheets, 'A4 sheet')}. Large runs are worth checking twice — a mis-set start number wastes
          the whole batch.
        </p>
      </ConfirmDialog>
    </div>
  );
}

