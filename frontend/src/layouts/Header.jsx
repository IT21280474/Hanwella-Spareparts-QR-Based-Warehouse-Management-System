import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu, PanelLeft, X } from 'lucide-react';
import { titleForPath } from '@/constants/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationsQuery, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/hooks/queries/useNotifications';
import { useUiStore } from '@/store/uiStore';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { relativeDateTime } from '@/utils/format';
import { GlobalSearch } from './GlobalSearch';
import './Header.css';

/**
 * Sticky application header: navigation toggle, breadcrumb, global search,
 * alert bell and the signed-in user.
 */
export function Header({ crumb: crumbOverride, title: titleOverride }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
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

  // Every signed-in user gets this — unlike the dashboard, there is no
  // permission gate here: SECURITY has no view_dashboard, but still needs to
  // hear about orders ready to dispatch.
  const { data } = useNotificationsQuery();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.rows ?? [];
  const unreadCount = data?.meta?.unread_count ?? 0;

  const onOpenNotification = (notification) => {
    if (!notification.read_at) markRead.mutate(notification.id);
    closeNotifications();
    if (notification.link) navigate(notification.link);
  };

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
          aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
          aria-expanded={notificationsOpen}
        >
          <Bell size={17} strokeWidth={1.7} aria-hidden="true" />
          {unreadCount > 0 ? <span className="header__bell-count">{unreadCount}</span> : null}
        </button>

        {notificationsOpen ? (
          <div className="header__panel">
            <div className="header__panel-head">
              <span className="header__panel-title">Notifications</span>
              <div className="header__panel-head-actions">
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    className="header__panel-markall"
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                  >
                    Mark all read
                  </button>
                ) : null}
                <button type="button" className="header__panel-close" onClick={closeNotifications} aria-label="Close notifications">
                  <X size={15} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="header__panel-list">
              {notifications.length === 0 ? (
                <p className="header__panel-empty">Nothing new right now.</p>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    className={['header__alert', notification.read_at ? '' : 'is-unread'].join(' ').trim()}
                    onClick={() => onOpenNotification(notification)}
                  >
                    <span className={`header__alert-dot header__alert-dot--${notification.level}`} aria-hidden="true" />
                    <span className="header__alert-body">
                      <span className="header__alert-text">{notification.title}</span>
                      {notification.body ? <span className="header__alert-meta">{notification.body}</span> : null}
                      <span className="header__alert-meta">{relativeDateTime(notification.created_at)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
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
