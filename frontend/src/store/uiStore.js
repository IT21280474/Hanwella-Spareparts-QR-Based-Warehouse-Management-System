import { create } from 'zustand';

const SIDEBAR_KEY = 'wms.sidebar.open';

const readSidebar = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== 'false';
  } catch {
    return true;
  }
};

/** Shell state: sidebar and the two header popovers. */
export const useUiStore = create((set, get) => ({
  sidebarOpen: readSidebar(),
  /** Off-canvas drawer, used below the tablet breakpoint. */
  mobileNavOpen: false,
  notificationsOpen: false,

  toggleSidebar: () => {
    const next = !get().sidebarOpen;
    try {
      localStorage.setItem(SIDEBAR_KEY, String(next));
    } catch {
      // A browser refusing storage must not break navigation.
    }
    set({ sidebarOpen: next });
  },

  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),

  toggleNotifications: () => set((s) => ({ notificationsOpen: !s.notificationsOpen })),
  closeNotifications: () => set({ notificationsOpen: false }),

  closeOverlays: () => set({ mobileNavOpen: false, notificationsOpen: false }),
}));
