import { create } from 'zustand';
import { TOAST_TTL_MS } from '@/constants';
import { errorMessage } from '@/utils/errors';

let nextId = 0;

/**
 * Global toast queue. Kept outside React so services and mutation callbacks can
 * raise a notification without threading a callback through the tree.
 */
export const useToastStore = create((set, get) => ({
  toasts: [],

  push: ({ title, body = '', kind = 'ok' }) => {
    const id = ++nextId;
    set((state) => ({ toasts: [...state.toasts, { id, title, body, kind }] }));
    setTimeout(() => get().dismiss(id), TOAST_TTL_MS);
    return id;
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  clear: () => set({ toasts: [] }),
}));

const push = (kind) => (title, body) => useToastStore.getState().push({ title, body, kind });

/** Imperative helpers: `toast.success('Saved', 'SJL-00001 updated')`. */
export const toast = {
  success: push('ok'),
  error: push('err'),
  warning: push('warn'),
  info: push('info'),

  /** Report a caught error without each caller re-deriving the message. */
  fromError: (error, title = 'Something went wrong') =>
    useToastStore.getState().push({ title, body: errorMessage(error), kind: 'err' }),
};
