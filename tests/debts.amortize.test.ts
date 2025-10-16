import { describe, it, expect } from 'vitest';
import { amortize, type Debt } from '../src/domain/debts';

describe('Debts – amortization', () => {
  it('amortizes typical mortgage with extra payment', () => {
    const d: Debt = {
      id: 'd1', type: 'hypoteka', name: 'Hypo', balance: 100_000,
      rate_pa: 4.0, monthly_payment: 600, months_remaining: 360
    };
    const base = amortize(d, 0);
    const extra = amortize(d, 200);
    expect(base.months).toBeGreaterThan(0);
    expect(extra.months).toBeLessThan(base.months);
    expect(Number.isFinite(base.totalInterest)).toBe(true);
    expect(Number.isFinite(extra.totalInterest)).toBe(true);
    expect(extra.totalInterest).toBeLessThan(base.totalInterest);
  });

  it('guard: if payment <= monthly interest, returns NaN interest and original months', () => {
    const d: Debt = {
      id: 'd2', type: 'spotrebny', name: 'Bad', balance: 10_000,
      rate_pa: 24.0, monthly_payment: 50, months_remaining: 999
    };
    const res = amortize(d, 0);
    expect(Number.isNaN(res.totalInterest)).toBe(true);
    expect(res.months).toBe(999);
  });
});
