import { describe, it, expect } from 'vitest';
import { getPolicy } from '../src/utils/profile';

type RiskPref = 'conservative'|'balanced'|'growth';
const prefs: RiskPref[] = ['conservative','balanced','growth'];

describe('policy mapping BASIC/PRO', () => {
  it('BASIC hodnoty podľa preferencie rizika', () => {
    const expected: Record<RiskPref, {goldMin:number;dynamicMax:number;cryptoMax:number;riskySumMax:number}> = {
      conservative: { goldMin: 15, dynamicMax: 12, cryptoMax: 3, riskySumMax: 15 },
      balanced:     { goldMin: 12, dynamicMax: 15, cryptoMax: 4, riskySumMax: 18 },
      growth:       { goldMin: 10, dynamicMax: 17, cryptoMax: 5, riskySumMax: 22 },
    };
    for (const p of prefs) {
      const pol = getPolicy(p, 'basic');
      expect(pol).toEqual(expected[p]);
    }
  });

  it('PRO má vyššie capy (okrem riskySumMax ≤ 22)', () => {
    for (const p of prefs) {
      const b = getPolicy(p, 'basic');
      const pro = getPolicy(p, 'pro');
      expect(pro.goldMin).toBe(b.goldMin);
      expect(pro.dynamicMax).toBeGreaterThanOrEqual(b.dynamicMax);
      expect(pro.cryptoMax).toBeGreaterThanOrEqual(b.cryptoMax);
      expect(pro.riskySumMax).toBeLessThanOrEqual(22);
    }
  });
});
