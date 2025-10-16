import { describe, it, expect } from 'vitest';
import { normalizeAndEnsureGold } from '../src/utils/portfolio';

describe('normalizeAndEnsureGold', () => {
  it('ensures sum = 100 and gold >= 10 when gold initially low', () => {
    const input = {
      'ETF (svet – aktívne)': 35,
      'Zlato (fyzické)': 5,
      'Krypto (BTC/ETH)': 15,
      'Dynamické riadenie': 15,
      'Garantovaný dlhopis 7,5% p.a.': 20,
      'Hotovosť/rezerva': 10,
    };
    const out = normalizeAndEnsureGold(input);
    const sum = Object.values(out).reduce((a,b)=>a+b,0);
    expect(sum).toBe(100);
    expect(out['Zlato (fyzické)']).toBeGreaterThanOrEqual(10);
  });

  it('keeps gold if already >= 10', () => {
    const input = {
      'ETF (svet – aktívne)': 30,
      'Zlato (fyzické)': 15,
      'Krypto (BTC/ETH)': 15,
      'Dynamické riadenie': 10,
      'Garantovaný dlhopis 7,5% p.a.': 20,
      'Hotovosť/rezerva': 10,
    };
    const out = normalizeAndEnsureGold(input);
    expect(out['Zlato (fyzické)']).toBe(15);
  });
});
