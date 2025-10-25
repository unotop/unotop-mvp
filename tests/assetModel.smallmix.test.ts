/**
 * Unit test: approxYieldAnnualFromMix s SMALL_MIX
 * Overuje výpočet váženého priemeru výnosov z mixu
 */

import { describe, it, expect } from 'vitest';
import { approxYieldAnnualFromMix } from '../src/features/mix/assetModel';
import {
  SMALL_MIX_VYVAZENY,
  SMALL_MIX_RISK_PREF,
  EXPECTED_VALUES,
} from '../src/test/fixtures/smallMix';

describe('assetModel - SMALL_MIX výnos', () => {
  it('approxYieldAnnualFromMix vracia presný vážený priemer pre SMALL_MIX_VYVAZENY', () => {
    // Act
    const actualYield = approxYieldAnnualFromMix(
      SMALL_MIX_VYVAZENY,
      SMALL_MIX_RISK_PREF
    );

    // Assert
    expect(actualYield).toBeCloseTo(
      EXPECTED_VALUES.approxYield,
      6 // 6 desatinných miest = tolerancia ±0.000001
    );
  });

  it('vracia 0.04 pre prázdny mix (fallback)', () => {
    const actualYield = approxYieldAnnualFromMix([], 'vyvazeny');
    expect(actualYield).toBe(0.04);
  });

  it('výpočet je deterministický (opakované volania dávajú rovnaký výsledok)', () => {
    const result1 = approxYieldAnnualFromMix(
      SMALL_MIX_VYVAZENY,
      SMALL_MIX_RISK_PREF
    );
    const result2 = approxYieldAnnualFromMix(
      SMALL_MIX_VYVAZENY,
      SMALL_MIX_RISK_PREF
    );
    expect(result1).toBe(result2);
  });
});
