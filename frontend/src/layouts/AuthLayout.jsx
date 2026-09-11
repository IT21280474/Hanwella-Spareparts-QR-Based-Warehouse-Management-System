import { Outlet } from 'react-router-dom';
import './AuthLayout.css';

const PITCH = {
  warehouse: {
    eyebrow: 'QR warehouse management',
    headline: 'Scan a part. Bill it. Stock updates itself.',
    lede: 'One QR identity per spare part — counter billing, stock movement and payment status in a single operational record.',
    highlights: [
      'Counter bill in three interactions',
      'Automatic deduction on every finalised order',
      'Batch QR labels, A4 print-ready',
    ],
  },
  security: {
    eyebrow: 'Yard gate · Security',
    headline: 'Only fully paid orders leave the yard.',
    lede: 'Scan the order number on the customer’s bill, check the goods against the list, and record the dispatch — every release is signed and timed.',
    highlights: [
      'Payment verified by the server, never by hand',
      'Every item and quantity listed before release',
      'Each dispatch recorded once, permanently',
    ],
  },
};

/**
 * Split-screen shell for the unauthenticated routes: a dark brand panel beside
 * the form. Below the tablet breakpoint the brand panel collapses to a compact
 * banner so the form stays above the fold on a phone. The `security` variant
 * is the same shell with the yard gate's own pitch.
 */
export function AuthLayout({ variant = 'warehouse' }) {
  const pitch = PITCH[variant] ?? PITCH.warehouse;

  return (
    <div className="auth">
      <aside className="auth__brand">
        <div className="auth__brand-top">
          <span className="auth__logo" aria-hidden="true">
            SJL
          </span>
          <span className="auth__brand-name">Hanwella Spareparts Warehouse</span>
        </div>

        <div className="auth__pitch">
          <p className="auth__eyebrow">{pitch.eyebrow}</p>
          <h1 className="auth__headline">{pitch.headline}</h1>
          <p className="auth__lede">{pitch.lede}</p>

          <ul className="auth__list">
            {pitch.highlights.map((item) => (
              <li key={item} className="auth__list-item">
                <span className="auth__dot" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="auth__credit">Built by eSupport · API Software Solutions</p>
      </aside>

      <main className="auth__panel">
        <div className="auth__form">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
