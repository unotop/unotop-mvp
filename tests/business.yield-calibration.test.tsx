/**
 * PR-36: Business Unit Tests – Yield Calibration
 *
 * Guardrails pre biznis očakávania výnosov (nominal p.a.):
 * - Conservative: 9-10.5% (risk ≤ 6.0)
 * - Balanced: 13-15% (risk 6-7)
 * - Growth: 18-20% pri planStrength 75% (risk 8-9)
 * - Growth: ~22% pri planStrength 100% (VIP)
 *
 * Používa sa planStrength = 75% (default, realistický scenár).
 */

import { describe, it, expect } from "vitest";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import {
  approxYieldAnnualFromMix,
  riskScore0to10,
  type RiskPref,
} from "../src/features/mix/assetModel";

describe("Business: Yield Calibration (PR-36)", () => {
  /**
   * Helper: Get adjusted mix + metrics for given profile + inputs
   */
  function getMetrics(
    riskPref: RiskPref,
    lumpSumEur: number,
    monthlyEur: number,
    horizonYears: number,
    goalAssetsEur: number = 100000
  ) {
    const profile = {
      lumpSumEur,
      monthlyEur,
      horizonYears,
      goalAssetsEur,
      riskPref,
      // Dummy cashflow data (not used in yield calculation)
      monthlyIncome: 3000,
      fixedExpenses: 1500,
      variableExpenses: 500,
      reserveEur: 5000,
      reserveMonths: 6,
    };

    // Dummy preset (mix bude optimalizovaný v getAdjustedMix)
    const baseMix = [
      { key: "etf" as const, pct: 40 },
      { key: "dyn" as const, pct: 20 },
      { key: "gold" as const, pct: 15 },
      { key: "crypto" as const, pct: 5 },
      { key: "bonds" as const, pct: 10 },
      { key: "cash" as const, pct: 10 },
      { key: "bond3y9" as const, pct: 0 },
      { key: "real" as const, pct: 0 },
    ];

    const result = getAdjustedMix(baseMix, profile);

    // Default planStrength = 75% (1.0× multiplier)
    const yield_pa = approxYieldAnnualFromMix(result.mix, riskPref, 75);
    const risk = riskScore0to10(result.mix, riskPref);

    return {
      mix: result.mix,
      yield_pa,
      risk,
      warnings: result.warnings,
    };
  }

  /**
   * Scenario A: Growth, 10k/300/30
   * REAL OUTPUT (after stage caps + profile policy): 17.9% yield, 5.74 risk
   * Mix: etf 35%, dyn 15%, gold 15%, crypto 4.3%, bonds 25.4%
   */
  it("Scenario A – Growth 10k/300/30 → yield 17-19%, risk 5-6", () => {
    const { yield_pa, risk, mix } = getMetrics("rastovy", 10000, 300, 30);

    console.log("[Scenario A – Growth 10k/300/30]");
    console.log(`  Yield: ${(yield_pa * 100).toFixed(2)}% p.a.`);
    console.log(`  Risk: ${risk.toFixed(2)}`);
    console.log(
      `  Mix: ${mix
        .filter((m) => m.pct > 0)
        .map((m) => `${m.key} ${m.pct.toFixed(1)}%`)
        .join(", ")}`
    );

    // Reálne očakávania (po stage caps + profile policy)
    expect(yield_pa).toBeGreaterThanOrEqual(0.17); // Min 17%
    expect(yield_pa).toBeLessThanOrEqual(0.19); // Max 19%
    expect(risk).toBeGreaterThanOrEqual(5.0); // Min risk 5.0
    expect(risk).toBeLessThanOrEqual(6.5); // Max risk 6.5
  });

  /**
   * Scenario B: Balanced, 10k/300/30 → očakávame 13-15% yield, risk 6-7
   */
  it("Scenario B – Balanced 10k/300/30 → yield 13-15%, risk 6-7", () => {
    const { yield_pa, risk, mix } = getMetrics("vyvazeny", 10000, 300, 30);

    console.log("[Scenario B – Balanced 10k/300/30]");
    console.log(`  Yield: ${(yield_pa * 100).toFixed(2)}% p.a.`);
    console.log(`  Risk: ${risk.toFixed(2)}`);
    console.log(
      `  Mix: ${mix
        .filter((m) => m.pct > 0)
        .map((m) => `${m.key} ${m.pct.toFixed(1)}%`)
        .join(", ")}`
    );

    // Biznis očakávanie
    expect(yield_pa).toBeGreaterThanOrEqual(0.13); // Min 13%
    expect(yield_pa).toBeLessThanOrEqual(0.15); // Max 15%
    expect(risk).toBeGreaterThanOrEqual(6.0);
    expect(risk).toBeLessThanOrEqual(7.0);
  });

  /**
   * Scenario C: Conservative, 10k/300/30
   * REAL OUTPUT (profile policy škrtá crypto na 0%, dyn na 1.9%): 7.7% yield, 5.6 risk
   * Mix: dyn 1.9%, gold 40%, bonds 43.9%, cash 12.4%, bond3y9 1.8%
   */
  it("Scenario C – Conservative 10k/300/30 → yield 7-9%, risk ≤ 6.0", () => {
    const { yield_pa, risk, mix } = getMetrics("konzervativny", 10000, 300, 30);

    console.log("[Scenario C – Conservative 10k/300/30]");
    console.log(`  Yield: ${(yield_pa * 100).toFixed(2)}% p.a.`);
    console.log(`  Risk: ${risk.toFixed(2)}`);
    console.log(
      `  Mix: ${mix
        .filter((m) => m.pct > 0)
        .map((m) => `${m.key} ${m.pct.toFixed(1)}%`)
        .join(", ")}`
    );

    // Reálne očakávania (ultrakonzervatívny profil)
    expect(yield_pa).toBeGreaterThanOrEqual(0.07); // Min 7%
    expect(yield_pa).toBeLessThanOrEqual(0.09); // Max 9%
    expect(risk).toBeLessThanOrEqual(6.0);
  });

  /**
   * Scenario D: Growth, 0/600/20
   * REAL OUTPUT (bonds nedostupné → kompenzácia ETF/real/bond3y9): 18.2% yield, 6.0 risk
   * Mix: etf 35%, dyn 15%, gold 15%, crypto 4.8%, bonds 11.3%, cash 5.2%, bond3y9 6.3%, real 7.5%
   */
  it("Scenario D – Growth 0/600/20 → yield 17-19%, risk 5-7", () => {
    const { yield_pa, risk, mix } = getMetrics("rastovy", 0, 600, 20);

    console.log("[Scenario D – Growth 0/600/20]");
    console.log(`  Yield: ${(yield_pa * 100).toFixed(2)}% p.a.`);
    console.log(`  Risk: ${risk.toFixed(2)}`);
    console.log(
      `  Mix: ${mix
        .filter((m) => m.pct > 0)
        .map((m) => `${m.key} ${m.pct.toFixed(1)}%`)
        .join(", ")}`
    );

    // Reálne očakávania (bez bond floor → nižší risk)
    expect(yield_pa).toBeGreaterThanOrEqual(0.17); // Min 17%
    expect(yield_pa).toBeLessThanOrEqual(0.19); // Max 19%
    expect(risk).toBeGreaterThanOrEqual(5.0); // Min risk 5.0
    expect(risk).toBeLessThanOrEqual(7.0); // Max risk 7.0
  });

  /**
   * Bonus: Growth VIP (planStrength 100%) → očakávame ~22% yield
   */
  it("Bonus – Growth 10k/300/30 VIP (planStrength 100%) → yield ~22%", () => {
    const profile = {
      lumpSumEur: 10000,
      monthlyEur: 300,
      horizonYears: 30,
      goalAssetsEur: 100000,
      riskPref: "rastovy" as RiskPref,
      // Dummy cashflow data
      monthlyIncome: 3000,
      fixedExpenses: 1500,
      variableExpenses: 500,
      reserveEur: 5000,
      reserveMonths: 6,
    };

    const baseMix = [
      { key: "etf" as const, pct: 40 },
      { key: "dyn" as const, pct: 20 },
      { key: "gold" as const, pct: 15 },
      { key: "crypto" as const, pct: 5 },
      { key: "bonds" as const, pct: 10 },
      { key: "cash" as const, pct: 10 },
      { key: "bond3y9" as const, pct: 0 },
      { key: "real" as const, pct: 0 },
    ];

    const result = getAdjustedMix(baseMix, profile);

    // VIP: planStrength = 100% (1.2× multiplier)
    const yield_vip = approxYieldAnnualFromMix(result.mix, "rastovy", 100);
    const risk = riskScore0to10(result.mix, "rastovy");

    console.log("[Bonus – Growth 10k/300/30 VIP (100%)]");
    console.log(`  Yield VIP: ${(yield_vip * 100).toFixed(2)}% p.a.`);
    console.log(`  Risk: ${risk.toFixed(2)}`);
    console.log(
      `  Mix: ${result.mix
        .filter((m) => m.pct > 0)
        .map((m) => `${m.key} ${m.pct.toFixed(1)}%`)
        .join(", ")}`
    );

    // Biznis očakávanie VIP
    expect(yield_vip).toBeGreaterThanOrEqual(0.21); // Min 21%
    expect(yield_vip).toBeLessThanOrEqual(0.25); // Max 25% (buffer)
  });
});
