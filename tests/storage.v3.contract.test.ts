import { describe, it, expect, beforeEach } from 'vitest';
import { readLS, writeLS } from '../src/utils/storage';

// Kontraktný test pre v3 perzistenciu.
// Očakávania:
// 1. readLS() nikdy nevráti null – vždy objekt s version:3.
// 2. writeLS() vynechá uiMode ak je null.
// 3. writeLS() zachová už existujúce polia a merguje nové.

describe('storage v3 contract', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('readLS returns base object with version=3 when empty', () => {
    const d = readLS();
    expect(d).toBeTruthy();
    expect(d.version).toBe(3);
    expect(Object.keys(d).length).toBe(1); // iba version pri prázdnom stave
  });

  it('writeLS merges and omits uiMode when null', () => {
    writeLS({ monthlyIncome: 2500, uiMode: null });
    const after = readLS();
    expect(after.version).toBe(3);
    expect(after.monthlyIncome).toBe(2500);
    expect((after as any).uiMode).toBeUndefined();
  });

  it('writeLS sets uiMode when provided', () => {
    writeLS({ uiMode: 'basic' });
    const d = readLS();
    expect(d.uiMode).toBe('basic');
    writeLS({ uiMode: 'pro' });
    const d2 = readLS();
    expect(d2.uiMode).toBe('pro');
  });

  it('writeLS merges mix & debts arrays', () => {
    writeLS({ mix: { A: 10 } });
    writeLS({ debts: [{ id: 'x', balance: 1000 }] });
    const d = readLS();
    expect(d.mix).toEqual({ A: 10 });
    expect(Array.isArray(d.debts)).toBe(true);
    expect(d.debts?.length).toBe(1);
  });
});
