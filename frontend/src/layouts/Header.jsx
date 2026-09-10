import { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Menu, PanelLeft, X } from 'lucide-react';
import { titleForPath } from '@/constants/navigation';
import { PERMISSIONS } from '@/constants/permissions';
import { dashboardApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/store/uiStore';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { GlobalSearch } from './GlobalSearch';
import './Header.css';

/**
 * Sticky application header: navigation toggle, breadcrumb, global search,
 * alert bell and the signed-in user.
 */
export function Header({ crumb: crumbOverride, title: titleOverride }) {
  const { pathname } = useLocation();
  const { user, can } = useAuth();
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const openMobileNav = useUiStore((state) => state.openMobileNav);
  const notificationsOpen = useUiStore((state) => state.notificationsOpen);
  const toggleNotifications = useUiStore((state) => state.toggleNotifications);
  const closeNotifications = useUiStore((state) => state.closeNotifications);
  const panelRef = useRef(null);

  const route = titleForPath(pathname);
  const crumb = crumbOverride ?? route.crumb;
  const title = titleOverride ?? route.title;

  useOnClickOutside(panelRef, closeNotifications, notificationsOpen);

  // Alerts ride along with the dashboard summary rather than adding a second
  // endpoint for the same numbers.
  const { data: summary } = useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: () => dashboardApi.summary(),
    enabled: can(PERMISSIONS.VIEW_DASHBOARD),
    staleTime: 60_000,
  });

  const alerts = summary?.alerts ?? [];
  const alertCount = alerts.length;

  return (
    <header className="header" data-noprint>
      <button type="button" className="header__toggle header__toggle--desktop" onClick={toggleSidebar} aria-label="Toggle navigation">
        <PanelLeft size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>

      <button type="button" className="header__toggle header__toggle--mobile" onClick={openMobileNav} aria-label="Open navigation">
        <Menu size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>

      <div className="header__titles">
        <p className="header__crumb">{crumb}</p>
        <p className="header__title">{title}</p>
      </div>

      <GlobalSearch />

      <div className="header__alerts" ref={panelRef}>
        <button
          type="button"
          className="header__bell"
          onClick={toggleNotifications}
          aria-label={`Warehouse alerts${alertCount ? ` (${alertCount})` : ''}`}
          aria-expanded={notificationsOpen}
        >
          <Bell size={17} strokeWidth={1.7} aria-hidden="true" />
          {alertCount > 0 ? <span className="header__bell-count">{alertCount}</span> : null}
        </button>

        {notificationsOpen ? (
          <div className="header__panel">
            <div className="header__panel-head">
              <span className="header__panel-title">Warehouse alerts</span>
              <button type="button" className="header__panel-close" onClick={closeNotifications} aria-label="Close alerts">
                <X size={15} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>

            {alerts.length === 0 ? (
              <p className="header__panel-empty">Nothing needs attention right now.</p>
            ) : (
              alerts.map((alert, index) =>
                alert.link ? (
                  <Link
                    key={`${alert.text}-${index}`}
                    to={alert.link}
                    className="header__alert"
                    onClick={closeNotifications}
                  >
                    <span className={`header__alert-dot header__alert-dot--${alert.level}`} aria-hidden="true" />
                    <span className="header__alert-body">
                      <span className="header__alert-text">{alert.text}</span>
                      <span className="header__alert-meta">{alert.meta}</span>
                    </span>
                  </Link>
                ) : (
                  <div key={`${alert.text}-${index}`} className="header__alert">
                    <span className={`header__alert-dot header__alert-dot--${alert.level}`} aria-hidden="true" />
                    <span className="header__alert-body">
                      <span className="header__alert-text">{alert.text}</span>
                      <span className="header__alert-meta">{alert.meta}</span>
                    </span>
                  </div>
                ),
              )
            )}
          </div>
        ) : null}
      </div>

      <div className="header__user">
        <span className="header__avatar" aria-hidden="true">
          {user?.initials}
        </span>
        <span className="header__user-text">
          <span className="header__user-name">{user?.name}</span>
          <span className="header__user-role">{user?.role?.name}</span>
        </span>
      </div>
    </header>
  );
}
