import { describe, expect, it } from 'vitest';
import { cartTotals, isBelowCost, lineTotal } from './cartStore';

const line = (overrides = {}) => ({
  partId: 1,
  quantity: 1,
  unitPrice: 1000,
  costPrice: 0,
  discount: '',
  note: '',
  ...overrides,
});

describe('lineTotal', () => {
  it('is the full price when no discount is set', () => {
    expect(lineTotal(line({ quantity: 2 }))).toBe(2000);
  });

  it('subtracts the line discount', () => {
    expect(lineTotal(line({ quantity: 1, discount: '150' }))).toBe(850);
  });

  it('never goes below zero even if the discount exceeds the line price', () => {
    expect(lineTotal(line({ quantity: 1, unitPrice: 500, discount: '999999' }))).toBe(0);
  });
});

describe('isBelowCost', () => {
  it('is false when the discounted price still covers cost', () => {
    expect(isBelowCost(line({ unitPrice: 1000, costPrice: 700, discount: '100' }))).toBe(false);
  });

  it('is true once the discount drops the effective price under cost', () => {
    expect(isBelowCost(line({ unitPrice: 1000, costPrice: 700, discount: '400' }))).toBe(true);
  });

  it('is false with no discount at all, even with a high cost price', () => {
    expect(isBelowCost(line({ unitPrice: 1000, costPrice: 999 }))).toBe(false);
  });

  it('is false when the part has no recorded cost price', () => {
    expect(isBelowCost(line({ unitPrice: 1000, costPrice: 0, discount: '999' }))).toBe(false);
  });

  it('accounts for quantity, not just the unit price', () => {
    // 2 units at 1000 = 2000, discount 500 -> 750/unit, still above a 700 cost.
    expect(isBelowCost(line({ quantity: 2, unitPrice: 1000, costPrice: 700, discount: '500' }))).toBe(false);
    // Same line, discount 700 -> 650/unit, now below cost.
    expect(isBelowCost(line({ quantity: 2, unitPrice: 1000, costPrice: 700, discount: '700' }))).toBe(true);
  });
});

describe('cartTotals', () => {
  it('sums line totals with no discounts', () => {
    const totals = cartTotals({
      lines: [line({ partId: 1, quantity: 2, unitPrice: 1000 }), line({ partId: 2, quantity: 1, unitPrice: 500 })],
      discount: '',
    });
    expect(totals.subtotal).toBe(2500);
    expect(totals.itemDiscountTotal).toBe(0);
    expect(totals.total).toBe(2500);
  });

  it('takes item discounts off the subtotal before the order-level discount applies', () => {
    const totals = cartTotals({
      lines: [line({ partId: 1, quantity: 1, unitPrice: 1000, discount: '200' })],
      discount: '300',
    });
    expect(totals.subtotal).toBe(1000);
    expect(totals.itemDiscountTotal).toBe(200);
    expect(totals.discount).toBe(300);
    expect(totals.total).toBe(500);
  });

  it('clamps the order-level discount to what is left after item discounts, never going negative', () => {
    const totals = cartTotals({
      lines: [line({ partId: 1, quantity: 1, unitPrice: 1000, discount: '900' })],
      discount: '999999',
    });
    expect(totals.itemDiscountTotal).toBe(900);
    expect(totals.discount).toBe(100);
    expect(totals.total).toBe(0);
  });
});
