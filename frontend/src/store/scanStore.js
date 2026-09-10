import { create } from 'zustand';

const MAX_RECENT = 6;

/**
 * Recently scanned parts, shown as a quick-pick strip on the scanner and the
 * counter-sale screen. Session-scoped on purpose: yesterday's scans are noise
 * at a shared terminal.
 */
export const useScanStore = create((set) => ({
  recent: [],

  remember: (part) =>
    set((state) => ({
      recent: [part, ...state.recent.filter((p) => p.id !== part.id)].slice(0, MAX_RECENT),
    })),

  clear: () => set({ recent: [] }),
}));
