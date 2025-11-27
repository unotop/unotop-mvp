/**
 * PR-33 FIX C - Quick yield validation
 * Overenie či yield calibration (ETF 11%, dyn 36%, crypto 20%) dosiahla target (15-18%)
 */
import { describe, it, expect } from "vitest";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";
import { approxYieldAnnualFromMix, riskScore0to10, type RiskPref } from "../src/features/mix/assetModel";

describe("PR-33 Yield Calibration Validation", () => {
  it("Balanced 2600/300/30 → yield 15-16%", () => {
    const preset = PORTFOLIO_PRESETS.find(p => p.id === "vyvazeny")!;
    const baseMix = preset.mix.map(m => ({ ...m }));
    
    const result = getAdjustedMix(baseMix, {
      riskPref: "vyvazeny" as RiskPref,
      lumpSumEur: 2600,
      monthlyEur: 300,
      horizonYears: 30,
      monthlyIncome: 3000,
      fixedExpenses: 1000,
      variableExpenses: 500,
      reserveEur: 0,
      reserveMonths: 0,
    });

    const yield_pct = approxYieldAnnualFromMix(result.mix, "vyvazeny") * 100;
    const risk = riskScore0to10(result.mix, "vyvazeny", 0);

    console.log(`[Balanced 2600/300/30] Yield: ${yield_pct.toFixed(1)}% | Risk: ${risk.toFixed(1)}`);
    
    expect(yield_pct).toBeGreaterThanOrEqual(15.0);
    expect(yield_pct).toBeLessThanOrEqual(17.0); // Tolerancia +1%
    expect(risk).toBeLessThanOrEqual(6.0); // Risk cap Balanced
  });

  it("Growth 98100/600/23 → yield 18-20%", () => {
    const preset = PORTFOLIO_PRESETS.find(p => p.id === "rastovy")!;
    const baseMix = preset.mix.map(m => ({ ...m }));
    
    const result = getAdjustedMix(baseMix, {
      riskPref: "rastovy" as RiskPref,
      lumpSumEur: 98100,
      monthlyEur: 600,
      horizonYears: 23,
      monthlyIncome: 3000,
      fixedExpenses: 1000,
      variableExpenses: 500,
      reserveEur: 0,
      reserveMonths: 0,
    });

    const yield_pct = approxYieldAnnualFromMix(result.mix, "rastovy") * 100;
    const risk = riskScore0to10(result.mix, "rastovy", 0);

    console.log(`[Growth 98100/600/23] Yield: ${yield_pct.toFixed(1)}% | Risk: ${risk.toFixed(1)}`);
    
    expect(yield_pct).toBeGreaterThanOrEqual(18.0);
    expect(yield_pct).toBeLessThanOrEqual(20.0); // Tolerancia +1%
    expect(risk).toBeLessThanOrEqual(7.5); // Risk cap Growth
  });

  it("Conservative 5600/800/21 → yield ≤ Balanced", () => {
    const presetC = PORTFOLIO_PRESETS.find(p => p.id === "konzervativny")!;
    const baseMixC = presetC.mix.map(m => ({ ...m }));
    
    const resultC = getAdjustedMix(baseMixC, {
      riskPref: "konzervativny" as RiskPref,
      lumpSumEur: 5600,
      monthlyEur: 800,
      horizonYears: 21,
      monthlyIncome: 3000,
      fixedExpenses: 1000,
      variableExpenses: 500,
      reserveEur: 0,
      reserveMonths: 0,
    });

    const presetB = PORTFOLIO_PRESETS.find(p => p.id === "vyvazeny")!;
    const baseMixB = presetB.mix.map(m => ({ ...m }));
    
    const resultB = getAdjustedMix(baseMixB, {
      riskPref: "vyvazeny" as RiskPref,
      lumpSumEur: 5600,
      monthlyEur: 800,
      horizonYears: 21,
      monthlyIncome: 3000,
      fixedExpenses: 1000,
      variableExpenses: 500,
      reserveEur: 0,
      reserveMonths: 0,
    });

    const yieldC = approxYieldAnnualFromMix(resultC.mix, "konzervativny") * 100;
    const yieldB = approxYieldAnnualFromMix(resultB.mix, "vyvazeny") * 100;

    console.log(`[5600/800/21] C: ${yieldC.toFixed(1)}% | B: ${yieldB.toFixed(1)}%`);
    
    expect(yieldC).toBeLessThanOrEqual(yieldB + 0.5); // Tolerancia +0.5%
  });
});
