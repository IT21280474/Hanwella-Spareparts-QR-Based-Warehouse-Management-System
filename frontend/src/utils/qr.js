import qrcode from 'qrcode-generator';

/**
 * Render a QR payload as an inline SVG data URI.
 *
 * Error-correction level M with a 4px cell and 2-module quiet zone reproduces
 * the printed label reference, so a regenerated label scans identically to one
 * already fixed to a bin.
 */
const CACHE = new Map();
const CELL_SIZE = 4;
const MARGIN = 2;
const CACHE_LIMIT = 512;

export function qrDataUri(text) {
  if (!text) return '';
  const cached = CACHE.get(text);
  if (cached) return cached;

  try {
    const qr = qrcode(0, 'M');
    qr.addData(String(text));
    qr.make();
    const svg = qr.createSvgTag({ cellSize: CELL_SIZE, margin: MARGIN, scalable: true });
    const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    if (CACHE.size >= CACHE_LIMIT) CACHE.clear();
    CACHE.set(text, uri);
    return uri;
  } catch {
    // An unencodable payload must not take a page down; the caller renders a
    // placeholder when the URI is empty.
    return '';
  }
}

/** Loose client-side shape check. The server is the authority on validity. */
const CODE_SHAPE = /^[A-Z]{2,6}-\d{3,8}$/;

export function looksLikeQrCode(value) {
  return CODE_SHAPE.test(String(value || '').trim().toUpperCase());
}

/** Normalise scanner and keyboard input before it reaches the API. */
export function normaliseCode(value) {
  return String(value || '').trim().toUpperCase();
}
