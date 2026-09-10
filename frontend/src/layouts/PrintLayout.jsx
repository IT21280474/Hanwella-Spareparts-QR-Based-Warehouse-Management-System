import './PrintLayout.css';

/**
 * Wrapper for printable documents (customer bill, QR label sheet).
 *
 * On screen the sheet floats on the page background as a paper preview; in
 * print it becomes the page itself.
 */
export function PrintLayout({ width = 'var(--paper-w)', children }) {
  return (
    <div className="print-stage">
      <div className="print-paper" data-paper style={{ width }}>
        {children}
      </div>
    </div>
  );
}
