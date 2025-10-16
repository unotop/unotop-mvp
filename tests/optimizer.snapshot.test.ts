import { describe, it, expect } from 'vitest';
import { findBestPortfolio } from '../src/domain/optimizer';
import { getAssetsByScenario } from '../src/domain/assets';

const assetsLegacy = getAssetsByScenario('base' as any, 'legacy');
const assetsCurrent = getAssetsByScenario('base' as any, 'current');

describe('optimizer snapshots', () => {
  it('returns solutions ordered by score (legacy)', () => {
    const sols = findBestPortfolio(assetsLegacy, { maxSolutions: 8, mode: 'legacy' }) || [];
    expect(sols.length).toBeGreaterThan(0);
    for (let i = 1; i < sols.length; i++) {
      expect(sols[i - 1].score).toBeGreaterThanOrEqual(sols[i].score - 1e-6);
      // Constraints
      const gold = sols[i - 1].weights['Zlato (fyzické)'] || 0;
      const dyn = sols[i - 1].weights['Dynamické riadenie'] || 0;
      expect(gold).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(dyn).toBeLessThanOrEqual(30 + 1e-6);
    }
  });

  it('returns solutions ordered by score (current)', () => {
    const sols = findBestPortfolio(assetsCurrent, { maxSolutions: 8, mode: 'current' }) || [];
    expect(sols.length).toBeGreaterThan(0);
    for (let i = 1; i < sols.length; i++) {
      expect(sols[i - 1].score).toBeGreaterThanOrEqual(sols[i].score - 1e-6);
    }
  });

  it('legacy vs current produce different ordering set (divergence)', () => {
    const legacy = findBestPortfolio(assetsLegacy, { maxSolutions: 5, mode: 'legacy' }) || [];
    const current = findBestPortfolio(assetsCurrent, { maxSolutions: 5, mode: 'current' }) || [];
    // Compare first solution weight signatures; expect at least one differing key weight >=2 p.p.
    if (legacy.length && current.length) {
      const l0 = legacy[0].weights;
      const c0 = current[0].weights;
      const keys = new Set([...Object.keys(l0), ...Object.keys(c0)]);
      const divergent = Array.from(keys).some(k => Math.abs((l0[k] || 0) - (c0[k] || 0)) >= 2);
      expect(divergent).toBe(true);
    }
  });
});