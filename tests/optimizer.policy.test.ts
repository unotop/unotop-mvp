import { describe, it, expect } from 'vitest';
import { findBestPortfolio } from '../src/domain/optimizer';
import { getAssetsByScenario } from '../src/domain/assets';

// Jednoduchý smoke test optimalizátora na policy capy

describe('Optimizer – policy capy', () => {
  const assets = getAssetsByScenario('base', 'legacy');
  it('neponúkne riešenie porušujúce dyn/krypto cap a dyn+krypto sum', () => {
    const sols = findBestPortfolio(assets, {
      step: 10,
      requireGoldMin: 10,
      dynamicCap: 15,
      cryptoCap: 4,
      riskySumMax: 18,
      maxSolutions: 5,
      mode: 'legacy',
      reasonMode: 'score',
    });
    for (const s of sols) {
      const d = s.weights['Dynamické riadenie'] || 0;
      const c = s.weights['Krypto (BTC/ETH)'] || 0;
      const g = s.weights['Zlato (fyzické)'] || 0;
      expect(g).toBeGreaterThanOrEqual(10);
      expect(d).toBeLessThanOrEqual(15);
      expect(c).toBeLessThanOrEqual(4);
      expect(d + c).toBeLessThanOrEqual(18);
      expect(['low risk','score','výnos']).toContain(s.reason);
    }
  });
});
