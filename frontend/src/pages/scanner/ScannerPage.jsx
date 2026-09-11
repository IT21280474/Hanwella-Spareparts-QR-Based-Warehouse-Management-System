import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QrScanner from 'qr-scanner';
import {
  CameraOff,
  Check,
  Flashlight,
  Keyboard,
  Minus,
  Package,
  Plus,
  ScanLine,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { qrApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePermission } from '@/hooks/usePermission';
import { useCartStore } from '@/store/cartStore';
import { useScanStore } from '@/store/scanStore';
import { toast } from '@/store/toastStore';
import { PERMISSIONS } from '@/constants/permissions';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  IconButton,
  Input,
  PageHeader,
  QrImage,
  Spinner,
} from '@/components/ui';
import { AdjustStockModal } from '@/components/inventory/AdjustStockModal';
import { money, number, relativeDateTime } from '@/utils/format';
import { normaliseCode } from '@/utils/qr';
import { toApiError } from '@/utils/errors';
import { stockStatusLabel, stockStatusTone } from '@/utils/status';
import '@/components/dashboard/ActivityFeed.css';
import './ScannerPage.css';

/** Ignore a repeat decode of the same code inside this window. */
const REPEAT_GUARD_MS = 2500;

/**
 * QR scanning.
 *
 * The camera only ever produces a string; the part it refers to is resolved by
 * the API, which is the sole authority on whether a code is valid and which
 * record it belongs to. Manual entry uses exactly the same endpoint, so a
 * broken camera or a damaged label never blocks the counter.
 */
export default function ScannerPage() {
  useDocumentTitle('Scan a part');
  const navigate = useNavigate();
  const { can } = usePermission();

  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const lastCodeRef = useRef({ code: '', at: 0 });

  const [cameraState, setCameraState] = useState('idle'); // idle | starting | scanning | denied | unavailable
  const [flashAvailable, setFlashAvailable] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState(null); // { part } | { notFound: code }
  const [quantity, setQuantity] = useState(1);
  const [adjusting, setAdjusting] = useState(false);

  const addToCart = useCartStore((state) => state.add);
  const recent = useScanStore((state) => state.recent);
  const remember = useScanStore((state) => state.remember);

  const queryClient = useQueryClient();
  const scanLog = useQuery({
    queryKey: queryKeys.qr.recentScans(),
    queryFn: () => qrApi.recentScans(),
  });

  const lookup = useMutation({
    mutationFn: (code) => qrApi.scan(code),
    onSuccess: ({ part }) => {
      setResult({ part });
      setQuantity(1);
      remember(part);
      queryClient.invalidateQueries({ queryKey: queryKeys.qr.recentScans() });
    },
    onError: (error, code) => {
      const apiError = toApiError(error);
      if (apiError.isNotFound) {
        setResult({ notFound: code });
        queryClient.invalidateQueries({ queryKey: queryKeys.qr.recentScans() });
        return;
      }
      setResult(null);
      toast.fromError(error, 'Scan could not be resolved');
    },
  });

  const resolve = useCallback(
    (raw) => {
      const code = normaliseCode(raw);
      if (!code) return;

      const now = Date.now();
      // A camera decodes the same label many times a second; only the first
      // one in the guard window is a scan the user meant to make.
      if (lastCodeRef.current.code === code && now - lastCodeRef.current.at < REPEAT_GUARD_MS) return;
      lastCodeRef.current = { code, at: now };

      lookup.mutate(code);
    },
    [lookup],
  );

  // The camera is started once and must not be torn down when `resolve` is
  // rebuilt, so the decode callback reads the current one through a ref.
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;

  // Camera lifecycle. The stream is released on unmount, so leaving the page
  // always turns the camera light off.
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      setCameraState('starting');

      const available = await QrScanner.hasCamera().catch(() => false);
      if (cancelled) return;

      if (!available) {
        setCameraState('unavailable');
        return;
      }

      const scanner = new QrScanner(videoRef.current, (decoded) => resolveRef.current(decoded?.data ?? decoded), {
        preferredCamera: 'environment',
        highlightScanRegion: false,
        highlightCodeOutline: false,
        maxScansPerSecond: 5,
        returnDetailedScanResult: true,
      });

      scannerRef.current = scanner;

      try {
        await scanner.start();
        if (cancelled) return;
        setCameraState('scanning');
        setFlashAvailable(await scanner.hasFlash().catch(() => false));
      } catch {
        if (!cancelled) setCameraState('denied');
      }
    };

    start();

    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  const toggleFlash = async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.toggleFlash();
      setFlashOn((on) => !on);
    } catch {
      toast.warning('Torch unavailable', 'This camera did not accept the torch command.');
    }
  };

  const onManualSubmit = (event) => {
    event.preventDefault();
    const code = normaliseCode(manualCode);
    if (!code) return;
    lastCodeRef.current = { code: '', at: 0 };
    resolve(code);
    setManualCode('');
  };

  const part = result?.part;
  const available = Number(part?.quantity ?? 0);

  const onAddToCart = () => {
    if (addToCart(part, quantity)) {
      toast.success('Added to order', `${part.name} × ${quantity}`);
      setResult(null);
    } else {
      toast.error('Out of stock', `${part.name} has no units on hand.`);
    }
  };

  return (
    <div className="scanner">
      <PageHeader
        title="Scan a part"
        description="Point the camera at a bin label, or type the code. The identity is resolved by the server before anything is shown."
        actions={
          <Link to="/inventory">
            <Button variant="secondary" icon={Package}>
              Browse inventory
            </Button>
          </Link>
        }
      />

      <div className="scanner__layout">
        <Card className="scanner__camera-card">
          <div className="scanner__viewport" data-state={cameraState}>
            <video ref={videoRef} className="scanner__video" muted playsInline />

            <div className="scanner__frame" aria-hidden="true">
              <span className="scanner__corner scanner__corner--tl" />
              <span className="scanner__corner scanner__corner--tr" />
              <span className="scanner__corner scanner__corner--bl" />
              <span className="scanner__corner scanner__corner--br" />
              {cameraState === 'scanning' ? <span className="scanner__sweep" /> : null}
            </div>

            {cameraState === 'starting' ? (
              <div className="scanner__overlay" role="status">
                <Spinner size={20} tone="var(--color-brand)" />
                <p>Starting the camera…</p>
              </div>
            ) : null}

            {cameraState === 'denied' || cameraState === 'unavailable' ? (
              <div className="scanner__overlay">
                <CameraOff size={26} strokeWidth={1.5} aria-hidden="true" />
                <p className="scanner__overlay-title">
                  {cameraState === 'denied' ? 'Camera access was refused' : 'No camera on this device'}
                </p>
                <p className="scanner__overlay-sub">
                  Type the code printed under the QR square instead — it resolves the same way.
                </p>
              </div>
            ) : null}

            {lookup.isPending ? (
              <div className="scanner__badge" role="status">
                <Spinner size={12} tone="var(--color-brand)" />
                Resolving…
              </div>
            ) : null}
          </div>

          <div className="scanner__controls">
            <p className="scanner__status">
              {cameraState === 'scanning' ? 'Scanning · hold the label steady' : 'Camera idle'}
            </p>
            {flashAvailable ? (
              <Button
                variant={flashOn ? 'brand' : 'secondary'}
                size="sm"
                icon={Flashlight}
                onClick={toggleFlash}
              >
                {flashOn ? 'Torch on' : 'Torch'}
              </Button>
            ) : null}
          </div>

          <form onSubmit={onManualSubmit} className="scanner__manual">
            <Keyboard size={15} strokeWidth={1.8} aria-hidden="true" className="scanner__manual-icon" />
            <Input
              value={manualCode}
              mono
              placeholder="SJL-00001"
              aria-label="Enter a QR code manually"
              maxLength={20}
              onChange={(event) => setManualCode(event.target.value.toUpperCase())}
            />
            <Button type="submit" icon={ScanLine} loading={lookup.isPending} disabled={!manualCode.trim()}>
              Look up
            </Button>
          </form>
        </Card>

        <div className="scanner__side">
          <Card>
            <CardHeader title="Result" subtitle="What the last code resolved to" />
            <CardBody>
              {part ? (
                <div className="scanner__result">
                  <div className="scanner__result-head">
                    <QrImage code={part.qr_code} size={54} />
                    <div className="scanner__result-text">
                      <p className="scanner__result-name">{part.name}</p>
                      <p className="scanner__result-meta mono">
                        {part.part_number} · {part.qr_code}
                      </p>
                    </div>
                  </div>

                  <div className="scanner__result-facts">
                    <div>
                      <span className="scanner__fact-label">On hand</span>
                      <span className="scanner__fact-value num">{number(available)}</span>
                    </div>
                    <div>
                      <span className="scanner__fact-label">Price</span>
                      <span className="scanner__fact-value num">{money(part.selling_price)}</span>
                    </div>
                    <div>
                      <span className="scanner__fact-label">Bin</span>
                      <span className="scanner__fact-value mono">{part.bin || '—'}</span>
                    </div>
                  </div>

                  <Badge tone={stockStatusTone(part)} dot>
                    {stockStatusLabel(part)}
                  </Badge>

                  {available > 0 && can(PERMISSIONS.CREATE_STOCK_OUT) ? (
                    <div className="scanner__stepper">
                      <IconButton
                        icon={Minus}
                        label="Decrease quantity"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                      />
                      <span className="scanner__quantity num">{quantity}</span>
                      <IconButton
                        icon={Plus}
                        label="Increase quantity"
                        onClick={() => setQuantity((q) => Math.min(available, q + 1))}
                        disabled={quantity >= available}
                      />
                      <span className="scanner__stepper-hint">
                        {number(available - quantity)} left after this
                      </span>
                    </div>
                  ) : null}

                  <div className="scanner__result-actions">
                    {can(PERMISSIONS.CREATE_STOCK_OUT) ? (
                      <Button icon={ShoppingCart} onClick={onAddToCart} disabled={available <= 0} fullWidth>
                        Add to order
                      </Button>
                    ) : null}
                    <Button variant="secondary" fullWidth onClick={() => navigate(`/inventory/${part.id}`)}>
                      Open part
                    </Button>
                    {can(PERMISSIONS.UPDATE_INVENTORY) ? (
                      <Button variant="secondary" icon={SlidersHorizontal} fullWidth onClick={() => setAdjusting(true)}>
                        Adjust stock
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : result?.notFound ? (
                <EmptyState
                  compact
                  icon={ScanLine}
                  title="That code is not in the system"
                  description={`No spare part carries ${result.notFound}. The label may belong to another warehouse, or the part was never issued an identity.`}
                  actions={
                    can(PERMISSIONS.CREATE_INVENTORY) ? (
                      <Link to="/inventory/new">
                        <Button size="sm">Add this part</Button>
                      </Link>
                    ) : null
                  }
                />
              ) : (
                <EmptyState
                  compact
                  icon={ScanLine}
                  title="Nothing scanned yet"
                  description="Hold a QR label inside the frame, or type the code beneath it."
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent scans" subtitle="This session only" />
            <CardBody>
              {recent.length === 0 ? (
                <p className="scanner__empty">Parts you scan appear here for a quick second look.</p>
              ) : (
                <ul className="scanner__recent">
                  {recent.map((entry) => (
                    <li key={entry.id}>
                      <button type="button" className="scanner__recent-item" onClick={() => setResult({ part: entry })}>
                        <QrImage code={entry.qr_code} size={26} />
                        <span className="scanner__recent-text">
                          <span className="scanner__recent-name">{entry.name}</span>
                          <span className="scanner__recent-meta mono">{entry.qr_code}</span>
                        </span>
                        <span className="scanner__recent-qty num">{number(entry.quantity)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Scan log" subtitle="Every attempt, across the whole team" />
            <CardBody>
              {scanLog.isLoading ? (
                <p className="scanner__empty">Loading…</p>
              ) : (scanLog.data ?? []).length === 0 ? (
                <p className="scanner__empty">Nothing scanned by anyone yet.</p>
              ) : (
                <ul className="activity">
                  {scanLog.data.map((entry) => (
                    <li key={entry.id}>
                      <div className="activity__row">
                        <span
                          className={['activity__mark', entry.found ? 'is-paid' : 'is-danger'].join(' ')}
                          aria-hidden="true"
                        >
                          {entry.found ? <Check size={13} strokeWidth={2.2} /> : <X size={13} strokeWidth={2.2} />}
                        </span>
                        <span className="activity__body">
                          <span className="activity__text mono">
                            {entry.code} {entry.part ? `· ${entry.part.name}` : '· no match'}
                          </span>
                          <span className="activity__meta">
                            {entry.user?.name || 'Unknown'} · {relativeDateTime(entry.created_at)}
                          </span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <AdjustStockModal
        open={adjusting}
        part={part}
        onClose={() => setAdjusting(false)}
        onAdjusted={() => setResult(null)}
      />
    </div>
  );
}
