import { NavLink } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { NAV_GROUPS } from '@/constants/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/store/uiStore';
import { useCartStore } from '@/store/cartStore';
import { IconButton } from '@/components/ui';
import './Sidebar.css';

/**
 * Primary navigation.
 *
 * On desktop it is a sticky rail that collapses to icons; below the tablet
 * breakpoint the same markup becomes an off-canvas drawer, so there is one
 * navigation implementation rather than two that can drift apart.
 *
 * Labels are always rendered and hidden with CSS in the collapsed state — the
 * drawer needs them even while the desktop rail is collapsed.
 */
export function Sidebar() {
  const { user, logout, can } = useAuth();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const mobileNavOpen = useUiStore((state) => state.mobileNavOpen);
  const closeMobileNav = useUiStore((state) => state.closeMobileNav);
  const cartUnits = useCartStore((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0));

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      {mobileNavOpen ? (
        <div className="sidebar__scrim" onClick={closeMobileNav} aria-hidden="true" data-noprint />
      ) : null}

      <aside
        className={[
          'sidebar',
          sidebarOpen ? 'is-open' : 'is-collapsed',
          mobileNavOpen ? 'is-mobile-open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-noprint
      >
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">
            SJL
          </span>
          <span className="sidebar__brand-text sidebar__collapsible">
            <span className="sidebar__brand-name">Hanwella Spares</span>
            <span className="sidebar__brand-sub">WAREHOUSE OPS</span>
          </span>
          <span className="sidebar__mobile-close">
            <IconButton icon={X} label="Close navigation" variant="onDark" size={28} onClick={closeMobileNav} />
          </span>
        </div>

        <nav className="sidebar__nav" aria-label="Main">
          {groups.map((group) => (
            <div key={group.caption} className="sidebar__group">
              <p className="sidebar__caption sidebar__collapsible">{group.caption}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={item.label}
                  onClick={closeMobileNav}
                  className={({ isActive }) =>
                    ['sidebar__item', isActive ? 'is-active' : ''].filter(Boolean).join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <>
                          <span className="sidebar__item-fill" aria-hidden="true" />
                          <span className="sidebar__item-rail" aria-hidden="true" />
                        </>
                      ) : null}
                      <item.icon className="sidebar__icon" size={17} strokeWidth={1.7} aria-hidden="true" />
                      <span className="sidebar__label sidebar__collapsible">{item.label}</span>
                      {item.badge === 'cart' && cartUnits > 0 ? (
                        <span className="sidebar__badge">{cartUnits}</span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <span className="sidebar__avatar" aria-hidden="true">
            {user?.initials}
          </span>
          <span className="sidebar__user sidebar__collapsible">
            <span className="sidebar__user-name">{user?.name}</span>
            <span className="sidebar__user-role">{user?.role?.name}</span>
          </span>
          <button type="button" className="sidebar__signout" onClick={logout} title="Sign out" aria-label="Sign out">
            <LogOut size={16} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>
  );
}
