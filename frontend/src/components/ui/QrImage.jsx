import { QrCode } from 'lucide-react';
import { qrDataUri } from '@/utils/qr';
import './QrImage.css';

/**
 * Renders a QR identity as an SVG image.
 *
 * Encoding happens in the browser from the code the server issued, so a label
 * can be re-rendered offline; the code itself is always server-assigned.
 */
export function QrImage({ code, size = 30, className = '', bordered = true }) {
  const src = code ? qrDataUri(code) : '';

  if (!src) {
    return (
      <span
        className={['qr-image', 'qr-image--empty', className].filter(Boolean).join(' ')}
        style={{ width: size, height: size }}
        title={code ? 'QR could not be rendered' : 'No QR identity assigned'}
      >
        <QrCode size={Math.round(size * 0.55)} strokeWidth={1.5} aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={`QR code ${code}`}
      width={size}
      height={size}
      className={['qr-image', bordered ? 'qr-image--bordered' : '', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
    />
  );
}
