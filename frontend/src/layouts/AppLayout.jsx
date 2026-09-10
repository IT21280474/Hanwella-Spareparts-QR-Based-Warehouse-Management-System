import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Spinner } from '@/components/ui';
import './AppLayout.css';

/**
 * The application shell every signed-in route renders inside.
 *
 * `data-print-root` on <main> is what turns a bill or a label sheet into the
 * printed page: the sidebar and header carry `data-noprint` and drop away.
 */
export function AppLayout() {
  return (
    <div className="app">
      <Sidebar />

      <div className="app__column">
        <Header />

        <main className="app__main" data-print-root>
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

/** Shown while a lazily-loaded route chunk arrives. */
function RouteFallback() {
  return (
    <div className="app__fallback" role="status" aria-live="polite">
      <Spinner size={20} tone="var(--color-muted-2)" />
      <span>Loading…</span>
    </div>
  );
}
