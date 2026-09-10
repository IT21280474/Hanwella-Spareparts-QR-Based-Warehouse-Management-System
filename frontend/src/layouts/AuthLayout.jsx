import { Outlet } from 'react-router-dom';
import './AuthLayout.css';

const HIGHLIGHTS = [
  'Counter bill in three interactions',
  'Automatic deduction on every finalised order',
  'Batch QR labels, A4 print-ready',
];

/**
 * Split-screen shell for the unauthenticated routes: a dark brand panel beside
 * the form. Below the tablet breakpoint the brand panel collapses to a compact
 * banner so the form stays above the fold on a phone.
 */
export function AuthLayout() {
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
          <p className="auth__eyebrow">QR warehouse management</p>
          <h1 className="auth__headline">Scan a part. Bill it. Stock updates itself.</h1>
          <p className="auth__lede">
            One QR identity per spare part — counter billing, stock movement and payment status in a
            single operational record.
          </p>

          <ul className="auth__list">
            {HIGHLIGHTS.map((item) => (
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
