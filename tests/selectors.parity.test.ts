import { describe, it, expect } from 'vitest';
import { selectErPa, selectFutureValue, selectReserveGap } from '../src/domain/selectors';

describe('selectors parity with legacy calculations', () => {
  const assets: any = {
    A: { expReturn: 0.05 },
    B: { expReturn: 0.10 },
  };
  const mix: Record<string, number> = { A: 60, B: 40 };
  const normMix = Object.fromEntries(Object.entries(mix).map(([k,v]) => [k, (v as number)/100])) as Record<string,number>;

  function legacyErPa(norm: Record<string, number>, as: any) {
    return Object.entries(norm).reduce((a, [k, w]) => a + w * (as[k]?.expReturn || 0), 0);
  }

  function legacyFV(years: number, lump: number, monthly: number, er: number){
    const months = Math.max(0, Math.round(years * 12));
    const i = er / 12;
    let value = Math.max(0, lump);
    for (let m = 1; m <= months; m++) {
      value = value * (1 + i) + Math.max(0, monthly);
    }
    return value;
  }

  function legacyReserveGap(fixed: number, months: number, cur: number){
    const req = Math.max(0, months * fixed);
    return Math.max(0, req - Math.max(0, cur));
  }

  it('ER p.a. parity', () => {
    const legacy = legacyErPa(normMix, assets);
    const sel = selectErPa(normMix, assets);
    expect(sel).toBeCloseTo(legacy, 12);
  });

  it('FV parity', () => {
    const legacy = legacyFV(7, 10000, 300, legacyErPa(normMix, assets));
    const sel = selectFutureValue(7, 10000, 300, selectErPa(normMix, assets));
    expect(sel).toBeCloseTo(legacy, 8);
  });

  it('Reserve gap parity', () => {
    const legacy = legacyReserveGap(800, 6, 3000);
    const sel = selectReserveGap(800, 6, 3000);
    expect(sel).toBe(legacy);
  });
});
