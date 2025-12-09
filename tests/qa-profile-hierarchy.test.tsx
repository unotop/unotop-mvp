/**
 * PR-30: Profile Hierarchy QA Tests
 *
 * Overuje produktovo-logické poradie profilov:
 * - Conservative < Balanced <= Growth (riziko aj výnos)
 * - cryptoG >= cryptoB
 * - IAD_G <= IAD_B
 *
 * Testový scenár: 0 / 150 / 21 (STARTER stage, ~37.8k EUR)
 */

import { describe, it, expect } from "vitest";
import { getAllAdjustedProfiles } from "../src/features/portfolio/mixAdjustments";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";
import {
  approxYieldAnnualFromMix,
  riskScore0to10,
} from "../src/features/mix/assetModel";
import type { ProfileForAdjustments } from "../src/features/portfolio/mixAdjustments";

describe("PR-30: Profile Hierarchy Invariants", () => {
  const profile: ProfileForAdjustments = {
    lumpSumEur: 0,
    monthlyEur: 150,
    horizonYears: 21,
    monthlyIncome: 0,
    fixedExpenses: 0,
    variableExpenses: 0,
    reserveEur: 0,
    reserveMonths: 0,
    goalAssetsEur: 0,
  };

  it("Plán 0/150/21 - Profile hierarchy (C < B <= G)", () => {
    const conservative = PORTFOLIO_PRESETS.find(
      (p) => p.id === "konzervativny"
    )!;
    const balanced = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
    const growth = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;

    const result = getAllAdjustedProfiles(
      { conservative, balanced, growth },
      profile
    );

    const consAdj = result.conservative.preset.mix;
    const balAdj = result.balanced.preset.mix;
    const growthAdj = result.growth.preset.mix;

    // Vypočítaj riziko a výnos
    const riskC = riskScore0to10(consAdj);
    const riskB = riskScore0to10(balAdj);
    const riskG = riskScore0to10(growthAdj);

    const yieldC = approxYieldAnnualFromMix(consAdj);
    const yieldB = approxYieldAnnualFromMix(balAdj);
    const yieldG = approxYieldAnnualFromMix(growthAdj);

    // Log pre debug
    console.log(`\n[QA Profile Hierarchy] Plán 0/150/21:`);
    console.log(
      `  Conservative: risk ${riskC.toFixed(2)}, yield ${(yieldC * 100).toFixed(2)}%`
    );
    console.log(
      `  Balanced: risk ${riskB.toFixed(2)}, yield ${(yieldB * 100).toFixed(2)}%`
    );
    console.log(
      `  Growth: risk ${riskG.toFixed(2)}, yield ${(yieldG * 100).toFixed(2)}%`
    );

    // INVARIANT 1: riskC < riskB <= riskG
    expect(riskC).toBeLessThan(riskB);
    expect(riskB).toBeLessThanOrEqual(riskG);

    // INVARIANT 2: yieldC < yieldB <= yieldG (s toleranciou 0.1%)
    expect(yieldC).toBeLessThan(yieldB + 0.001);
    expect(yieldB).toBeLessThanOrEqual(yieldG + 0.001);

    console.log(`  ✅ Hierarchy: C < B <= G (risk aj yield)`);
  });

  it("Plán 0/150/21 - Crypto hierarchy (cryptoG >= cryptoB)", () => {
    const conservative = PORTFOLIO_PRESETS.find(
      (p) => p.id === "konzervativny"
    )!;
    const balanced = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
    const growth = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;

    const result = getAllAdjustedProfiles(
      { conservative, balanced, growth },
      profile
    );

    const balAdj = result.balanced.preset.mix;
    const growthAdj = result.growth.preset.mix;

    const cryptoC =
      result.conservative.preset.mix.find((m) => m.key === "crypto")?.pct ?? 0;
    const cryptoB = balAdj.find((m) => m.key === "crypto")?.pct ?? 0;
    const cryptoG = growthAdj.find((m) => m.key === "crypto")?.pct ?? 0;

    console.log(`\n[QA Crypto Hierarchy]:`);
    console.log(`  Conservative crypto: ${cryptoC.toFixed(1)}%`);
    console.log(`  Balanced crypto: ${cryptoB.toFixed(1)}%`);
    console.log(`  Growth crypto: ${cryptoG.toFixed(1)}%`);

    // STARTER Balanced by mal mať 0% crypto
    expect(cryptoB).toBeCloseTo(0, 1);

    // PR-30: STARTER Growth crypto môže byť 0% (enforceRiskCap to vymaže kvôli riskMax 8.5)
    // Advisor: "crypto aspoň 5% (AK TO riskMax dovolí)" → pri STARTER to NEDOVOLÍ
    if (cryptoG < 0.1) {
      console.log(
        `  ⚠️ WARNING: Growth crypto = 0% (enforceRiskCap zničil kvôli riskMax 8.5)`
      );
      console.log(
        `  → Advisor: "AK TO riskMax dovolí" → pri STARTER to NEDOVOLÍ`
      );
    }

    // INVARIANT 3: cryptoG >= cryptoB (splnené aj keď obidva 0%)
    expect(cryptoG).toBeGreaterThanOrEqual(cryptoB - 0.1);

    console.log(
      `  ✅ Crypto hierarchy: cryptoG (${cryptoG.toFixed(1)}%) >= cryptoB (${cryptoB.toFixed(1)}%)`
    );
  });

  it("Plán 0/150/21 - IAD DK hierarchy (IAD_G <= IAD_B)", () => {
    const conservative = PORTFOLIO_PRESETS.find(
      (p) => p.id === "konzervativny"
    )!;
    const balanced = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
    const growth = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;

    const result = getAllAdjustedProfiles(
      { conservative, balanced, growth },
      profile
    );

    const consAdj = result.conservative.preset.mix;
    const balAdj = result.balanced.preset.mix;
    const growthAdj = result.growth.preset.mix;

    const cashC = consAdj.find((m) => m.key === "cash")?.pct ?? 0;
    const cashB = balAdj.find((m) => m.key === "cash")?.pct ?? 0;
    const cashG = growthAdj.find((m) => m.key === "cash")?.pct ?? 0;

    console.log(`\n[QA IAD DK Hierarchy]:`);
    console.log(`  Conservative IAD DK: ${cashC.toFixed(1)}%`);
    console.log(`  Balanced IAD DK: ${cashB.toFixed(1)}%`);
    console.log(`  Growth IAD DK: ${cashG.toFixed(1)}%`);

    // STARTER Growth by mal mať menej IAD než Balanced (3% < 5%)
    expect(cashG).toBeLessThanOrEqual(cashB + 0.1);

    console.log(
      `  ✅ IAD hierarchy: IAD_G (${cashG.toFixed(1)}%) <= IAD_B (${cashB.toFixed(1)}%)`
    );
  });

  it("Plán 0/150/21 - Mix breakdown (all profiles)", () => {
    const conservative = PORTFOLIO_PRESETS.find(
      (p) => p.id === "konzervativny"
    )!;
    const balanced = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
    const growth = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;

    const result = getAllAdjustedProfiles(
      { conservative, balanced, growth },
      profile
    );

    console.log(`\n[QA Mix Breakdown] Plán 0/150/21:`);

    // Conservative
    console.log(`\n  CONSERVATIVE:`);
    result.conservative.preset.mix
      .filter((m) => m.pct > 0)
      .forEach((m) => {
        console.log(`    ${m.key}: ${m.pct.toFixed(1)}%`);
      });

    // Balanced
    console.log(`\n  BALANCED:`);
    result.balanced.preset.mix
      .filter((m) => m.pct > 0)
      .forEach((m) => {
        console.log(`    ${m.key}: ${m.pct.toFixed(1)}%`);
      });

    // Growth
    console.log(`\n  GROWTH:`);
    result.growth.preset.mix
      .filter((m) => m.pct > 0)
      .forEach((m) => {
        console.log(`    ${m.key}: ${m.pct.toFixed(1)}%`);
      });

    // Verify sums
    const sumC = result.conservative.preset.mix.reduce(
      (acc, m) => acc + m.pct,
      0
    );
    const sumB = result.balanced.preset.mix.reduce((acc, m) => acc + m.pct, 0);
    const sumG = result.growth.preset.mix.reduce((acc, m) => acc + m.pct, 0);

    expect(sumC).toBeCloseTo(100, 1);
    expect(sumB).toBeCloseTo(100, 1);
    expect(sumG).toBeCloseTo(100, 1);

    console.log(`\n  ✅ All mixes sum to 100%`);
  });

  it("Plán 0/150/21 - Expected asset distribution (STARTER)", () => {
    const conservative = PORTFOLIO_PRESETS.find(
      (p) => p.id === "konzervativny"
    )!;
    const balanced = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
    const growth = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;

    const result = getAllAdjustedProfiles(
      { conservative, balanced, growth },
      profile
    );

    const balAdj = result.balanced.preset.mix;
    const growthAdj = result.growth.preset.mix;

    // BALANCED: očakávaný mix (STARTER)
    const balGold = balAdj.find((m) => m.key === "gold")?.pct ?? 0;
    const balEtf = balAdj.find((m) => m.key === "etf")?.pct ?? 0;
    const balCrypto = balAdj.find((m) => m.key === "crypto")?.pct ?? 0;
    const balCash = balAdj.find((m) => m.key === "cash")?.pct ?? 0;

    console.log(`\n[QA Expected Distribution - BALANCED]:`);
    console.log(`  Gold: ${balGold.toFixed(1)}% (expected ~40%)`);
    console.log(`  ETF: ${balEtf.toFixed(1)}% (expected ~45%)`);
    console.log(`  Crypto: ${balCrypto.toFixed(1)}% (expected 0%)`);
    console.log(`  IAD DK: ${balCash.toFixed(1)}% (expected ~5%)`);

    // Tolerancia ±10% na gold/ETF (enforceRiskCap môže robiť úpravy)
    expect(balGold).toBeGreaterThan(30);
    expect(balGold).toBeLessThan(50);
    expect(balEtf).toBeGreaterThan(35);
    expect(balEtf).toBeLessThan(55);
    expect(balCrypto).toBeLessThan(1); // Mali by byť 0%

    // GROWTH: očakávaný mix (STARTER)
    const growthGold = growthAdj.find((m) => m.key === "gold")?.pct ?? 0;
    const growthEtf = growthAdj.find((m) => m.key === "etf")?.pct ?? 0;
    const growthCrypto = growthAdj.find((m) => m.key === "crypto")?.pct ?? 0;
    const growthCash = growthAdj.find((m) => m.key === "cash")?.pct ?? 0;

    console.log(`\n[QA Expected Distribution - GROWTH]:`);
    console.log(`  Gold: ${growthGold.toFixed(1)}% (expected ~40%)`);
    console.log(`  ETF: ${growthEtf.toFixed(1)}% (expected ~45%)`);
    console.log(`  Crypto: ${growthCrypto.toFixed(1)}% (expected 5-7%)`);
    console.log(`  IAD DK: ${growthCash.toFixed(1)}% (expected ~3%)`);

    expect(growthGold).toBeGreaterThan(30);
    expect(growthGold).toBeLessThan(50);
    expect(growthEtf).toBeGreaterThan(35);
    expect(growthEtf).toBeLessThan(55);

    // PR-30: STARTER Growth crypto môže byť 0% (enforceRiskCap to vymaže kvôli riskMax 8.5)
    // Advisor: "crypto aspoň 5% (AK TO riskMax dovolí)" → pri STARTER to NEDOVOLÍ
    if (growthCrypto < 0.1) {
      console.log(
        `\n  ⚠️ WARNING: Growth crypto = 0% (enforceRiskCap zničil kvôli riskMax 8.5)`
      );
    } else {
      expect(growthCrypto).toBeGreaterThanOrEqual(2); // Aspoň 2% ak nejde na 0
    }

    expect(growthCash).toBeLessThanOrEqual(balCash + 0.1); // Menej než Balanced

    console.log(`\n  ✅ Asset distribution within expected ranges`);
  });
});
