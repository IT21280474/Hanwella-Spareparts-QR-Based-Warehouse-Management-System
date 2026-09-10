import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { qrApi, settingsApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { toast } from '@/store/toastStore';
import { Button, Card, ErrorState, QrImage, Spinner } from '@/components/ui';
import { PrintLayout } from '@/layouts';
import { COMPANY_FALLBACK } from '@/constants';
import { QR_LAYOUTS } from '@/constants/options';
import { formatDate, pluralize } from '@/utils/format';
import './QrSheetPage.css';

const layoutOf = (value) => QR_LAYOUTS.find((layout) => layout.value === value) ?? QR_LAYOUTS[0];

/**
 * The printable label sheet.
 *
 * Labels are laid out on A4-width paper with `break-inside: avoid` on every
 * cell, so a run that spans several sheets never splits a label across a page
 * boundary. Printing is reported back to the API for the print-count audit
 * trail — a bin label that has been reprinted five times is usually a bin label
 * that keeps falling off.
 */
export default function QrSheetPage() {
  useDocumentTitle('Label sheet');
  const [searchParams] = useSearchParams();

  const params = useMemo(
    () => ({
      from: Math.max(1, Number(searchParams.get('from')) || 1),
      count: Math.max(1, Number(searchParams.get('count')) || 40),
      layout: searchParams.get('layout') || QR_LAYOUTS[0].value,
    }),
    [searchParams],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.qr.labels(params),
    queryFn: () => qrApi.labels(params),
  });

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: () => settingsApi.get(),
    staleTime: 10 * 60_000,
  });

  const markPrinted = useMutation({
    mutationFn: (codes) => qrApi.markPrinted(codes),
    onError: () =>
      // Failing to record the print run must not stop the print itself.
      toast.warning('Print not logged', 'The sheet printed, but the print count could not be recorded.'),
  });

  const labels = data?.labels ?? [];
  const layout = layoutOf(params.layout);
  const company = settings?.company ?? COMPANY_FALLBACK;
  const sheets = Math.ceil(labels.length / layout.perSheet) || 1;

  const print = () => {
    if (labels.length > 0) markPrinted.mutate(labels.map((label) => label.code));
    window.print();
  };

  if (isError) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="qr-sheet__loading" role="status">
        <Spinner size={20} tone="var(--color-muted-2)" />
        <span>Building the sheet…</span>
      </div>
    );
  }

  const range = labels.length ? `${labels[0].code} – ${labels[labels.length - 1].code}` : '—';

  return (
    <div className="qr-sheet">
      <div className="qr-sheet__bar" data-noprint>
        <Link to={`/qr-labels?from=${params.from}&count=${params.count}&layout=${params.layout}`} className="qr-sheet__back">
          <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
          Change the run
        </Link>

        <p className="qr-sheet__summary">
          {pluralize(labels.length, 'label')} · {pluralize(sheets, 'sheet')} · {layout.label}
        </p>

        <Button icon={Printer} onClick={print}>
          Print
        </Button>
      </div>

      <PrintLayout>
        <div className="sheet">
          <header className="sheet__head">
            <p className="sheet__title">{company.name} · QR inventory labels</p>
            <p className="sheet__range mono">{range}</p>
            <p className="sheet__date">{formatDate(new Date())}</p>
          </header>

          <div className="sheet__grid" style={{ gridTemplateColumns: `repeat(${layout.columns}, 1fr)` }}>
            {labels.map((label) => (
              <div key={label.code} className="sheet__label" data-break-avoid>
                <QrImage code={label.code} size={48} bordered={false} />
                <div className="sheet__label-text">
                  <p className="sheet__label-code mono">{label.code}</p>
                  <p className="sheet__label-pn mono">{label.part_number || '—'}</p>
                  <p className="sheet__label-name">{label.part_name || 'Unassigned identity'}</p>
                  {label.bin ? <p className="sheet__label-bin mono">{label.bin}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PrintLayout>
    </div>
  );
}
