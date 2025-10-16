import { describe, it, expect } from 'vitest';
import { parseMoneyStrict } from '../src/utils/number';
import { fairRoundTo100 } from '../src/domain/finance';
import { normalizeAndEnsureGold } from '../src/utils/portfolio';

// Lightweight replicas for guardrail helpers (cannot import App component stateful funcs easily)
function setMixCappedSim(current: Record<string, number>, asset: string, next: number){
  const othersSum = Object.entries(current).filter(([k])=>k!==asset).reduce((a,[,v])=>a+v,0);
  const allowed = Math.max(0, 100 - othersSum);
  return { ...current, [asset]: Math.min(next, allowed) };
}

describe('parseMoneyStrict', () => {
  it('accepts plain number', () => {
    expect(parseMoneyStrict('1234')).toBe(1234);
  });
  it('accepts spaces & euro', () => {
    expect(parseMoneyStrict('  12 345 € ')).toBe(12345);
  });
  it('rejects scientific', () => {
    expect(Number.isNaN(parseMoneyStrict('1e6'))).toBe(true);
  });
  it('rejects letters', () => {
    expect(Number.isNaN(parseMoneyStrict('12k'))).toBe(true);
  });
});

describe('setMixCappedSim', () => {
  it('caps so total never exceeds 100', () => {
    const base = { A: 60, B: 30, C: 10 };
    const out = setMixCappedSim(base, 'A', 90); // others = 40 so max A = 60
    expect(out.A).toBe(60);
    const out2 = setMixCappedSim(base, 'C', 80); // others=90 => allowed=10
    expect(out2.C).toBe(10);
  });
});

describe('normalizeAndEnsureGold guard', () => {
  it('enforces gold >=10 and sum 100', () => {
    const mix = { 'Zlato (fyzické)': 2, 'Akcie': 50, 'Dlhopisy': 30, 'Hotovosť/rezerva': 20 } as Record<string, number>;
    const out = normalizeAndEnsureGold(mix);
    expect(out['Zlato (fyzické)']).toBeGreaterThanOrEqual(10);
    expect(Object.values(out).reduce((a,b)=>a+b,0)).toBe(100);
  });
});

// Overflow test (simple simulation) – using large horizon & rate
import { fvMonthly } from '../src/domain/finance';

describe('FV overflow heuristic', () => {
  it('can exceed overflow threshold with huge inputs', () => {
    const fv = fvMonthly({ initial: 5e15, monthly: 5e14, years: 5, rate: 0.15 });
    expect(fv).toBeGreaterThanOrEqual(1e16);
  });
});
