import { describe, it, expect } from 'vitest';
import { computeRecommendedMixLegacy } from '../src/domain/recommendationLegacy';
import { computeRiskLegacy } from '../src/domain/riskLegacy';
import { getAssetsByScenario } from '../src/domain/assets';
import { normalizeAndEnsureGold } from '../src/utils/portfolio';

interface ScenarioInput { years: number; income: number; monthlyInvest: number; oneTime: number; missingReserve: number; reUnlocked: boolean; }

const GOLDEN_SCENARIOS: { name: string; input: ScenarioInput }[] = [
  { name: 'Scenario A (short horizon, small reserve gap)', input: { years: 3, income: 1800, monthlyInvest: 300, oneTime: 5000, missingReserve: 1000, reUnlocked: false } },
  { name: 'Scenario B (mid horizon, no reserve gap, dynamic unlock)', input: { years: 7, income: 4000, monthlyInvest: 600, oneTime: 12000, missingReserve: 0, reUnlocked: true } },
  { name: 'Scenario C (long horizon, large lump sum, unlocked)', input: { years: 15, income: 5000, monthlyInvest: 800, oneTime: 300000, missingReserve: 0, reUnlocked: true } },
];

const assets = getAssetsByScenario('base' as any, 'legacy');

describe('Golden scenario parity (legacy)', () => {
  for (const sc of GOLDEN_SCENARIOS) {
    it(sc.name, () => {
      const rec = computeRecommendedMixLegacy({
        years: sc.input.years,
        income: sc.input.income,
        monthlyInvest: sc.input.monthlyInvest,
        oneTime: sc.input.oneTime,
        missingReserve: sc.input.missingReserve,
        reUnlocked: sc.input.reUnlocked,
        assetsKeys: Object.keys(assets)
      });
      const normalized = normalizeAndEnsureGold(rec);
      const sum = Object.values(normalized).reduce((a,b)=>a+b,0);
      expect(sum).toBe(100);
      const fractional: Record<string, number> = {};
      Object.keys(normalized).forEach(k => { fractional[k] = normalized[k] / 100; });
      const risk = computeRiskLegacy(fractional, assets).raw;

      const gold = normalized['Zlato (fyzické)'] || 0;
      const dyn = normalized['Dynamické riadenie'] || 0;
      const crypto = normalized['Krypto (BTC/ETH)'] || 0;
      const cash = normalized['Hotovosť/rezerva'] || 0;

      // Invariant assertions
      expect(gold).toBeGreaterThanOrEqual(10);
      expect(dyn).toBeLessThanOrEqual(30);
      expect(dyn + crypto).toBeLessThanOrEqual(22);
      if(sc.input.missingReserve > 0){
        expect(cash).toBeGreaterThanOrEqual(10);
      }
      expect(risk).toBeGreaterThan(0);
      expect(risk).toBeLessThanOrEqual(9);

      // Temporary logging for future snapshot decisions
      // eslint-disable-next-line no-console
      console.log(`[GoldenMix] ${sc.name}:`, normalized, 'risk=', risk.toFixed(3));
    });
  }
});