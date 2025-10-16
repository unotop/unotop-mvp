import { describe, it, expect } from 'vitest';
import { applyCrisisBias, getPolicy } from '../src/utils/profile';

function sum(m: Record<string, number>): number {
  return Object.values(m).reduce((a,b)=>a+b,0);
}

describe('crisis bias', () => {
  const base: Record<string, number> = {
    'Zlato (fyzické)': 10,
    'Garantovaný dlhopis (fixný)': 10,
    'ETF akumulačné': 30,
    'Dynamické riadenie': 30,
    'Krypto (BTC/ETH)': 5,
    'Hotovosť/rezerva': 15,
  };
  it('bias +1/+2/+3 pridá 2pp zlato + 2pp dlhopis na krok a berie najprv z ETF, potom z Dynamického', () => {
    const b1 = applyCrisisBias(base, 1);
    expect((b1['Zlato (fyzické)']||0)).toBe(12);
    expect((b1['Garantovaný dlhopis (fixný)']||0)).toBe(12);
    // ETF by malo klesnúť ako prvé
    expect((b1['ETF akumulačné']||0)).toBe(28);
    const b2 = applyCrisisBias(base, 2);
    expect((b2['Zlato (fyzické)']||0)).toBe(14);
    expect((b2['Garantovaný dlhopis (fixný)']||0)).toBe(14);
    // ETF klesá na 26, zvyšok ide z Dynamického
    expect((b2['ETF akumulačné']||0)).toBe(26);
    const b3 = applyCrisisBias(base, 3);
    expect((b3['Zlato (fyzické)']||0)).toBe(16);
    expect((b3['Garantovaný dlhopis (fixný)']||0)).toBe(16);
    // ETF 24, ostatné z Dynamického
    expect((b3['ETF akumulačné']||0)).toBe(24);
  });

  it('sum = 100 po aplikácii', () => {
    for (let s=0; s<=3; s++) {
      const out = applyCrisisBias(base, s);
      expect(sum(out)).toBe(100);
    }
  });
});
