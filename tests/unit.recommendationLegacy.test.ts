import { describe, it, expect } from 'vitest';
import { computeRecommendedMixLegacy } from '../src/domain/recommendationLegacy';

const baseArgs = {
  years: 10,
  income: 1500,
  monthlyInvest: 200,
  oneTime: 2000,
  missingReserve: 3300, // from spec A (6*800 - 1500)
  reUnlocked: false,
  assetsKeys: [
    'ETF (svet – aktívne)',
    'Zlato (fyzické)',
    'Krypto (BTC/ETH)',
    'Dynamické riadenie',
    'Garantovaný dlhopis 7,5% p.a.',
    'Hotovosť/rezerva'
  ]
};

describe('computeRecommendedMixLegacy', () => {
  it('applies defensive tilt with missing reserve (Golden A shape)', () => {
    const mix = computeRecommendedMixLegacy(baseArgs);
  // Expect bond >=29 (tolerancia 1 p.b. kvôli fair round), crypto <=5, dynamic <=6, cash >=10, gold >=10
  expect(mix['Garantovaný dlhopis 7,5% p.a.']).toBeGreaterThanOrEqual(29);
    expect(mix['Krypto (BTC/ETH)']).toBeLessThanOrEqual(5);
    expect(mix['Dynamické riadenie']).toBeLessThanOrEqual(6);
    expect(mix['Hotovosť/rezerva']).toBeGreaterThanOrEqual(10);
    expect(mix['Zlato (fyzické)']).toBeGreaterThanOrEqual(10);
    const sum = Object.values(mix).reduce((a,b)=>a+b,0);
    expect(sum).toBe(100);
  });
});
