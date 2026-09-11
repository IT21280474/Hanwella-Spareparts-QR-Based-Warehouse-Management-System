import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { CameraOff, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import './ScanOrderModal.css';

const STATE_TEXT = {
  starting: 'Starting the camera…',
  unavailable: 'No camera was found on this device. Type the order number instead.',
  denied: 'Camera access was refused. Allow it in the browser settings, or type the order number instead.',
};

/**
 * Camera scan of the QR code printed on a customer's bill — it encodes the
 * order number. The first decoded value is handed back and the camera is
 * released as soon as the dialog closes, so the light never stays on.
 *
 * Browsers only grant camera access on HTTPS or localhost.
 */
export function ScanOrderModal({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const [state, setState] = useState('starting');

  // Read through a ref so a re-render of the parent never restarts the camera.
  const detectedRef = useRef(onDetected);
  detectedRef.current = onDetected;

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    let delivered = false;
    let scanner = null;

    const start = async () => {
      setState('starting');

      const available = await QrScanner.hasCamera().catch(() => false);
      if (cancelled) return;
      if (!available || !videoRef.current) {
        setState('unavailable');
        return;
      }

      scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const text = String(result?.data ?? result ?? '').trim();
          if (!text || delivered) return;
          delivered = true;
          detectedRef.current(text);
        },
        {
          preferredCamera: 'environment',
          highlightScanRegion: false,
          highlightCodeOutline: false,
          maxScansPerSecond: 5,
          returnDetailedScanResult: true,
        },
      );

      try {
        await scanner.start();
        if (!cancelled) setState('scanning');
      } catch {
        if (!cancelled) setState('denied');
      }
    };

    start();

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [open]);

  const failed = state === 'unavailable' || state === 'denied';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Scan the bill"
      description="Hold the QR code printed on the customer’s bill inside the frame."
      size="md"
    >
      <div className="scan-order" data-state={state}>
        <video ref={videoRef} className="scan-order__video" muted playsInline />

        {state === 'scanning' ? (
          <div className="scan-order__frame" aria-hidden="true">
            <span className="scan-order__corner scan-order__corner--tl" />
            <span className="scan-order__corner scan-order__corner--tr" />
            <span className="scan-order__corner scan-order__corner--bl" />
            <span className="scan-order__corner scan-order__corner--br" />
          </div>
        ) : (
          <div className="scan-order__status" role="status">
            {failed ? (
              <CameraOff size={24} strokeWidth={1.6} aria-hidden="true" />
            ) : (
              <Loader2 className="scan-order__spin" size={24} strokeWidth={1.6} aria-hidden="true" />
            )}
            <p>{STATE_TEXT[state]}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
