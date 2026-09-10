import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PAYMENT_MODE, PAYMENT_STATUS } from '@/constants/options';

/**
 * The counter-sale basket.
 *
 * Lines hold a part snapshot so the cart can render without refetching, but
 * price and availability are always re-resolved by the server at checkout —
 * the basket is a draft, never an authority on stock or money.
 *
 * Persisted so a reloaded till does not lose a half-built sale.
 */
const emptyCustomer = { customerName: '', customerPhone: '' };

export const useCartStore = create()(
  persist(
    (set, get) => ({
      lines: [],
      ...emptyCustomer,
      discount: '',
      paymentStatus: PAYMENT_STATUS.PAID,
      paymentMode: PAYMENT_MODE.CASH,

      add: (part, quantity = 1) => {
        const available = Number(part.quantity ?? 0);
        if (available <= 0) return false;

        set((state) => {
          const index = state.lines.findIndex((line) => line.partId === part.id);
          if (index === -1) {
            return {
              lines: [
                ...state.lines,
                {
                  partId: part.id,
                  quantity: Math.min(quantity, available),
                  name: part.name,
                  partNumber: part.part_number,
                  qrCode: part.qr_code,
                  unitPrice: Number(part.selling_price) || 0,
                  available,
                },
              ],
            };
          }

          const lines = state.lines.slice();
          lines[index] = {
            ...lines[index],
            available,
            quantity: Math.min(lines[index].quantity + quantity, available),
          };
          return { lines };
        });

        return true;
      },

      setQuantity: (partId, quantity) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            line.partId === partId
              ? { ...line, quantity: Math.max(1, Math.min(Number(quantity) || 1, line.available)) }
              : line,
          ),
        })),

      increment: (partId) => {
        const line = get().lines.find((l) => l.partId === partId);
        if (line) get().setQuantity(partId, line.quantity + 1);
      },

      decrement: (partId) => {
        const line = get().lines.find((l) => l.partId === partId);
        if (!line) return;
        if (line.quantity <= 1) get().remove(partId);
        else get().setQuantity(partId, line.quantity - 1);
      },

      remove: (partId) =>
        set((state) => ({ lines: state.lines.filter((line) => line.partId !== partId) })),

      setCustomerName: (customerName) => set({ customerName }),
      setCustomerPhone: (customerPhone) => set({ customerPhone }),
      setDiscount: (discount) => set({ discount: String(discount).replace(/[^0-9]/g, '') }),
      setPaymentStatus: (paymentStatus) => set({ paymentStatus }),
      setPaymentMode: (paymentMode) => set({ paymentMode }),

      clear: () =>
        set({
          lines: [],
          ...emptyCustomer,
          discount: '',
          paymentStatus: PAYMENT_STATUS.PAID,
          paymentMode: PAYMENT_MODE.CASH,
        }),
    }),
    { name: 'wms.cart' },
  ),
);

/** Derived totals, computed in one place so the cart and the summary agree. */
export function cartTotals(state) {
  const subtotal = state.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discount = Math.min(Number(state.discount) || 0, subtotal);
  const units = state.lines.reduce((sum, line) => sum + line.quantity, 0);
  return { subtotal, discount, total: subtotal - discount, units, lineCount: state.lines.length };
}
