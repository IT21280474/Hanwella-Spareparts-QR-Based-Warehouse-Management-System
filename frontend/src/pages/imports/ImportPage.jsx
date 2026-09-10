import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Check,
  Download,
  FileSpreadsheet,
  ImagePlus,
  Package,
  RotateCcw,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { importsApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { toast } from '@/store/toastStore';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  StatGrid,
  StatTile,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { number, pluralize } from '@/utils/format';
import { toApiError } from '@/utils/errors';
import './ImportPage.css';

const STEPS = ['Upload', 'Validate', 'Preview', 'Resolve', 'Confirm', 'Complete'];

const ACCEPT = '.xlsx,.xls,.csv';
const MAX_BYTES = 10 * 1024 * 1024;
const PHOTO_ZIP_MAX_BYTES = 25 * 1024 * 1024;

const OUTCOME_TONE = {
  new: 'success',
  update: 'info',
  duplicate: 'neutral',
  error: 'danger',
};

/**
 * Bulk catalogue upload.
 *
 * Nothing is written when a file is uploaded — the server validates it and
 * returns a batch describing what *would* happen. The catalogue changes only
 * when the run is confirmed, so a spreadsheet with 200 rows and one bad price
 * can be fixed and re-uploaded without leaving half an import behind.
 */
export default function ImportPage() {
  useDocumentTitle('Excel bulk upload');

  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [batch, setBatch] = useState(null);
  const [completed, setCompleted] = useState(null);
  const [dragging, setDragging] = useState(false);

  const photoInputRef = useRef(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoResult, setPhotoResult] = useState(null);
  const [photoDragging, setPhotoDragging] = useState(false);

  const upload = useMutation({
    mutationFn: (chosen) => importsApi.upload(chosen, setProgress),
    onSuccess: ({ batch: result, message }) => {
      setBatch(result);
      toast.success('File validated', message || `${result.valid_rows} of ${result.total_rows} rows are ready`);
    },
    onError: (error) => {
      setFile(null);
      toast.fromError(error, 'Upload failed');
    },
  });

  const confirm = useMutation({
    mutationFn: (batchId) => importsApi.confirm(batchId),
    onSuccess: ({ batch: result, message }) => {
      setCompleted(result);
      setBatch(null);
      toast.success('Import complete', message || `${result.created_count} added, ${result.updated_count} updated`);
    },
    onError: (error) => toast.fromError(error, 'Import could not be committed'),
  });

  const rejected = batch?.rejected_count ?? 0;
  const step = completed ? 5 : batch ? (rejected > 0 ? 3 : 4) : upload.isPending ? 1 : 0;

  const accept = (chosen) => {
    if (!chosen) return;

    if (chosen.size > MAX_BYTES) {
      toast.error('File too large', 'Split the sheet into runs of 10 MB or less.');
      return;
    }

    setFile(chosen);
    setProgress(0);
    setCompleted(null);
    upload.mutate(chosen);
  };

  const restart = () => {
    setFile(null);
    setBatch(null);
    setCompleted(null);
    setProgress(0);
    upload.reset();
    confirm.reset();
    if (inputRef.current) inputRef.current.value = '';
  };

  const uploadError = upload.isError ? toApiError(upload.error) : null;

  const uploadPhotos = useMutation({
    mutationFn: (chosen) => importsApi.uploadPhotos(chosen),
    onSuccess: ({ result, message }) => {
      setPhotoResult(result);
      toast.success('Photos processed', message);
    },
    onError: (error) => {
      setPhotoFile(null);
      toast.fromError(error, 'Photo upload failed');
    },
  });

  const acceptPhotoZip = (chosen) => {
    if (!chosen) return;

    if (!chosen.name.toLowerCase().endsWith('.zip')) {
      toast.error('Not a .zip file', 'Zip your photos together and upload that file.');
      return;
    }
    if (chosen.size > PHOTO_ZIP_MAX_BYTES) {
      toast.error('File too large', 'Keep the archive under 25 MB — split into a few runs if needed.');
      return;
    }

    setPhotoFile(chosen);
    setPhotoResult(null);
    uploadPhotos.mutate(chosen);
  };

  const restartPhotos = () => {
    setPhotoFile(null);
    setPhotoResult(null);
    uploadPhotos.reset();
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  return (
    <div className="import">
      <PageHeader
        title="Excel bulk upload"
        description="Add or update many spare parts at once. The file is checked before anything is written, and the whole run commits together."
        actions={
          <a href={importsApi.templateUrl()} download>
            <Button variant="secondary" icon={Download}>
              Download template
            </Button>
          </a>
        }
      />

      <Card>
        <ol className="import__steps">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className="import__step"
              data-state={index < step ? 'done' : index === step ? 'current' : 'todo'}
            >
              <span className="import__step-mark" aria-hidden="true">
                {index < step ? <Check size={11} strokeWidth={3} /> : index + 1}
              </span>
              <span className="import__step-label">{label}</span>
            </li>
          ))}
        </ol>
      </Card>

      {completed ? (
        <Card>
          <CardHeader title="Import complete" subtitle={completed.filename} />
          <CardBody>
            <StatGrid min={150}>
              <StatTile label="Parts added" value={number(completed.created_count)} sub="new records" chip="New" chipTone="success" />
              <StatTile label="Parts updated" value={number(completed.updated_count)} sub="existing records" chip="Changed" chipTone="info" />
              <StatTile label="Duplicates skipped" value={number(completed.duplicate_count)} sub="already identical" />
              <StatTile
                label="Rows rejected"
                value={number(completed.rejected_count)}
                sub="not imported"
                tone={completed.rejected_count ? 'danger' : 'ink'}
                chip={completed.rejected_count ? 'Review' : 'Clean'}
                chipTone={completed.rejected_count ? 'danger' : 'success'}
              />
            </StatGrid>

            <div className="import__done-actions">
              <Link to="/inventory">
                <Button icon={Package}>Open the inventory</Button>
              </Link>
              {completed.rejected_count > 0 ? (
                <a href={importsApi.errorReportUrl(completed.id)} download>
                  <Button variant="secondary" icon={Download}>
                    Download the rejected rows
                  </Button>
                </a>
              ) : null}
              <Button variant="ghost" icon={RotateCcw} onClick={restart}>
                Upload another file
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : !batch ? (
        <Card>
          <CardHeader title="Choose a file" subtitle="Excel or CSV, up to 10 MB, using the template columns" />
          <CardBody>
            <div
              className="import__drop"
              data-dragging={dragging ? 'true' : undefined}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                accept(event.dataTransfer.files?.[0]);
              }}
            >
              <span className="import__drop-icon" aria-hidden="true">
                <FileSpreadsheet size={24} strokeWidth={1.5} />
              </span>

              <p className="import__drop-title">
                {upload.isPending ? `Uploading ${file?.name}…` : 'Drop the spreadsheet here'}
              </p>
              <p className="import__drop-sub">
                {upload.isPending
                  ? 'The file is validated on the server — nothing is written yet.'
                  : 'or choose it from your computer. Columns must match the template.'}
              </p>

              {upload.isPending ? (
                <div className="import__progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <span className="import__progress-fill" style={{ width: `${progress}%` }} />
                </div>
              ) : (
                <Button icon={Upload} onClick={() => inputRef.current?.click()}>
                  Choose a file
                </Button>
              )}

              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="import__input"
                onChange={(event) => accept(event.target.files?.[0])}
              />
            </div>

            {uploadError ? (
              <p className="import__error" role="alert">
                {uploadError.message}
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="What this file will do"
              subtitle={`${batch.filename} · ${pluralize(batch.total_rows, 'row')} read`}
              actions={
                <Button variant="ghost" size="sm" icon={RotateCcw} onClick={restart}>
                  Start over
                </Button>
              }
            />
            <CardBody>
              <StatGrid min={150}>
                <StatTile label="Rows read" value={number(batch.total_rows)} sub="in the file" />
                <StatTile
                  label="Ready to import"
                  value={number(batch.valid_rows)}
                  sub="pass validation"
                  chip="Valid"
                  chipTone="success"
                />
                <StatTile label="Duplicates" value={number(batch.duplicate_count)} sub="already identical" />
                <StatTile
                  label="Rejected"
                  value={number(batch.rejected_count)}
                  sub="will not be imported"
                  tone={rejected ? 'danger' : 'ink'}
                  chip={rejected ? 'Fix' : 'Clean'}
                  chipTone={rejected ? 'danger' : 'success'}
                />
              </StatGrid>
            </CardBody>
          </Card>

          {rejected > 0 ? (
            <Card>
              <CardHeader
                title="Rows that will be skipped"
                subtitle="Grouped by what went wrong"
                actions={
                  <a href={importsApi.errorReportUrl(batch.id)} download>
                    <Button variant="secondary" size="sm" icon={Download}>
                      Error report
                    </Button>
                  </a>
                }
              />
              <CardBody>
                <ul className="import__errors">
                  {(batch.errors ?? []).map((entry) => (
                    <li key={`${entry.rows}-${entry.message}`} className="import__error-row">
                      <TriangleAlert size={14} strokeWidth={1.9} aria-hidden="true" />
                      <span className="import__error-rows mono">Rows {entry.rows}</span>
                      <span className="import__error-message">{entry.message}</span>
                    </li>
                  ))}
                </ul>
                <p className="import__errors-note">
                  These rows are left out of the run. Everything else still imports — fix them in the sheet and upload
                  again when you are ready.
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Preview" subtitle="The first rows, as they will be applied" />

            {(batch.preview ?? []).length === 0 ? (
              <EmptyState
                compact
                icon={FileSpreadsheet}
                title="Nothing to preview"
                description="No row in this file passed validation."
              />
            ) : (
              <TableWrap minWidth={860}>
                <thead>
                  <tr>
                    <Th width={56}>Row</Th>
                    <Th width={140}>Part number</Th>
                    <Th>Name</Th>
                    <Th align="right" width={90}>
                      Quantity
                    </Th>
                    <Th align="right" width={110}>
                      Price
                    </Th>
                    <Th width={120}>Outcome</Th>
                  </tr>
                </thead>
                <tbody>
                  {batch.preview.map((row) => (
                    <Tr key={row.row}>
                      <Td className="import__row-no mono">{row.row}</Td>
                      <Td nowrap className="mono">
                        {row.part_number}
                      </Td>
                      <Td>{row.name}</Td>
                      <Td align="right" nowrap className="num">
                        {row.quantity}
                      </Td>
                      <Td align="right" nowrap className="num">
                        {row.price}
                      </Td>
                      <Td nowrap>
                        <Badge tone={OUTCOME_TONE[row.tone] || 'neutral'} size="sm">
                          {row.outcome}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>

          <Card>
            <CardBody className="import__commit">
              <div>
                <p className="import__commit-title">
                  Import {pluralize(batch.valid_rows, 'row')} into the catalogue?
                </p>
                <p className="import__commit-sub">
                  The whole run is written in one transaction. If any row fails at that point, nothing is applied.
                </p>
              </div>
              <Button
                size="lg"
                icon={Check}
                loading={confirm.isPending}
                disabled={batch.valid_rows === 0}
                onClick={() => confirm.mutate(batch.id)}
              >
                Confirm import
              </Button>
            </CardBody>
          </Card>
        </>
      )}

      <Card>
        <CardHeader
          title="Bulk photos"
          subtitle="Match photos to existing parts by filename — name each photo after its part number or SKU, zip them, and upload the zip"
        />
        <CardBody>
          <div
            className="import__drop"
            data-dragging={photoDragging ? 'true' : undefined}
            onDragOver={(event) => {
              event.preventDefault();
              setPhotoDragging(true);
            }}
            onDragLeave={() => setPhotoDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setPhotoDragging(false);
              acceptPhotoZip(event.dataTransfer.files?.[0]);
            }}
          >
            <span className="import__drop-icon" aria-hidden="true">
              <ImagePlus size={24} strokeWidth={1.5} />
            </span>

            <p className="import__drop-title">
              {uploadPhotos.isPending ? `Matching ${photoFile?.name}…` : 'Drop the photo .zip here'}
            </p>
            <p className="import__drop-sub">
              {uploadPhotos.isPending
                ? 'Reading the archive and matching each file to a part…'
                : 'or choose it — e.g. BRK-TOY-4821.jpg matches part number BRK-TOY-4821.'}
            </p>

            {!uploadPhotos.isPending ? (
              <Button icon={Upload} onClick={() => photoInputRef.current?.click()}>
                Choose a .zip
              </Button>
            ) : null}

            <input
              ref={photoInputRef}
              type="file"
              accept=".zip"
              className="import__input"
              onChange={(event) => acceptPhotoZip(event.target.files?.[0])}
            />
          </div>

          {photoResult ? (
            <div className="import__photo-result">
              <StatGrid min={140}>
                <StatTile
                  label="Matched"
                  value={number(photoResult.matched)}
                  sub="photos assigned"
                  chip={photoResult.matched > 0 ? 'Assigned' : undefined}
                  chipTone="success"
                />
                <StatTile
                  label="Unmatched"
                  value={number(photoResult.unmatched.length)}
                  sub="no part with that name"
                  tone={photoResult.unmatched.length ? 'warning' : 'ink'}
                />
                <StatTile
                  label="Rejected"
                  value={number(photoResult.rejected.length)}
                  sub="not a valid photo"
                  tone={photoResult.rejected.length ? 'danger' : 'ink'}
                />
              </StatGrid>

              {photoResult.unmatched.length > 0 ? (
                <p className="import__photo-note">
                  No matching part for: <span className="mono">{photoResult.unmatched.join(', ')}</span>
                </p>
              ) : null}

              {photoResult.rejected.length > 0 ? (
                <ul className="import__errors">
                  {photoResult.rejected.map((entry) => (
                    <li key={entry.file} className="import__error-row">
                      <TriangleAlert size={14} strokeWidth={1.9} aria-hidden="true" />
                      <span className="import__error-rows mono">{entry.file}</span>
                      <span className="import__error-message">{entry.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={restartPhotos}>
                Upload another zip
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
