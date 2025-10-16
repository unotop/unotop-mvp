import { describe, it, expect } from 'vitest';
import { comparePayDownVsInvest, type Debt } from '../src/domain/debts';

describe('Debts – compare paydown vs invest', () => {
  const baseDebt: Debt = {
    id: 'x', type: 'hypoteka', balance: 50_000, rate_pa: 5.0, monthly_payment: 300, months_remaining: 240,
  };
  it('prefers paydown when rate > expectedReturn - 2pp', () => {
    const res = comparePayDownVsInvest(baseDebt, 200, 5, 0.04);
    expect(res.verdict).toBe('splácať');
  });
  it('prefers invest when rate < expectedReturn - 2pp', () => {
    const res = comparePayDownVsInvest(baseDebt, 200, 5, 0.10);
    expect(res.verdict).toBe('investovať');
  });
});
