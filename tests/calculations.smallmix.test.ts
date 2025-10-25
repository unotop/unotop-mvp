/**
 * Unit test: calculateFutureValue s presným rate
 * Overuje mesačnú kapitalizáciu a annuity-due výpočet
 */

import { describe, it, expect } from 'vitest';
import { calculateFutureValue } from '../src/engine/calculations';
import { EXPECTED_VALUES } from '../src/test/fixtures/smallMix';

describe('engine/calculations - SMALL_MIX FV výpočet', () => {
  it('calculateFutureValue vracia správnu FV pre SMALL_MIX parametre', () => {
    // Arrange
    const lumpSumEur = 10000;
    const monthlyVklad = 500;
    const horizonYears = 20;
    const annualRate = EXPECTED_VALUES.approxYield; // 0.1214380443423

    // Act
    const actualFV = calculateFutureValue(
      lumpSumEur,
      monthlyVklad,
      horizonYears,
      annualRate
    );

    // Assert: tolerancia ±0.30% (±1700 € pri 567k)
    const expectedFV = EXPECTED_VALUES.futureValue; // 566 964.28
    const tolerance = expectedFV * EXPECTED_VALUES.fvTolerance; // 0.3%
    
    expect(actualFV).toBeGreaterThan(expectedFV - tolerance);
    expect(actualFV).toBeLessThan(expectedFV + tolerance);
  });

  it('vracia len lump sum ak years <= 0', () => {
    const fv = calculateFutureValue(10000, 500, 0, 0.12);
    expect(fv).toBe(10000);
  });

  it('správne počíta s nulovým výnosom (annualRate = 0)', () => {
    // Pri 0% výnose: FV = lump + (monthly × 12 × years)
    const lumpSumEur = 10000;
    const monthlyVklad = 500;
    const horizonYears = 20;
    
    const fv = calculateFutureValue(lumpSumEur, monthlyVklad, horizonYears, 0);
    const expected = lumpSumEur + monthlyVklad * 12 * horizonYears;
    
    expect(fv).toBeCloseTo(expected, 2);
  });

  it('výpočet je deterministický', () => {
    const params = [10000, 500, 20, 0.1214380443423] as const;
    
    const result1 = calculateFutureValue(...params);
    const result2 = calculateFutureValue(...params);
    
    expect(result1).toBe(result2);
  });

  it('správne aplikuje mesačnú kapitalizáciu (compound)', () => {
    // Pri mesačnej kapitalizácii musí byť FV vyššia než lineárny výpočet
    const lumpSumEur = 10000;
    const monthlyVklad = 500;
    const horizonYears = 20;
    const annualRate = 0.12;
    
    const fv = calculateFutureValue(
      lumpSumEur,
      monthlyVklad,
      horizonYears,
      annualRate
    );
    
    // Lineárny výpočet (bez compound): lump + vklady
    const linear = lumpSumEur + monthlyVklad * 12 * horizonYears;
    
    // FV s compoundom musí byť výrazne vyššia
    expect(fv).toBeGreaterThan(linear * 1.5); // aspoň 50% viac
  });
});
