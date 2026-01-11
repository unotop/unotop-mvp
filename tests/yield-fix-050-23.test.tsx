/**
 * Test: Overenie že pri 0/50/23 (13.8k EUR) má rastový profil dyn > 0%
 */
import { describe, it, expect } from "vitest";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import { approxYieldAnnualFromMix } from "../src/features/mix/assetModel";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";

describe("Yield fix @ 0/50/23", () => {
  const profile = {
    lumpSumEur: 0,
    monthlyEur: 50,
    horizonYears: 23,
    monthlyIncome: 2500,
    fixedExpenses: 1200,
    variableExpenses: 800,
    reserveEur: 1000,
    reserveMonths: 3,
    goalAssetsEur: 100000,
  };

  const balanced = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
  const growth = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;

  it("Vyvážený has dyn > 0% at 0/50/23", () => {
    const result = getAdjustedMix(balanced.mix, {
      ...profile,
      riskPref: "vyvazeny",
    });
    const dyn = result.mix.find((m) => m.key === "dyn")?.pct || 0;
    const yieldAnnual = approxYieldAnnualFromMix(result.mix);

    console.log(
      `[Balanced] dyn=${dyn.toFixed(1)}%, yield=${(yieldAnnual * 100).toFixed(2)}%`
    );
    console.log(
      `  Mix:`,
      result.mix
        .filter((m) => m.pct > 0)
        .map((m) => `${m.key}:${m.pct.toFixed(1)}%`)
        .join(", ")
    );

    expect(dyn).toBeGreaterThan(0);
    expect(yieldAnnual).toBeGreaterThanOrEqual(0.11); // min 11%
  });

  it("Rastový has dyn > 0% at 0/50/23", () => {
    const result = getAdjustedMix(growth.mix, {
      ...profile,
      riskPref: "rastovy",
    });
    const dyn = result.mix.find((m) => m.key === "dyn")?.pct || 0;
    const yieldAnnual = approxYieldAnnualFromMix(result.mix);

    console.log(
      `[Growth] dyn=${dyn.toFixed(1)}%, yield=${(yieldAnnual * 100).toFixed(2)}%`
    );
    console.log(
      `  Mix:`,
      result.mix
        .filter((m) => m.pct > 0)
        .map((m) => `${m.key}:${m.pct.toFixed(1)}%`)
        .join(", ")
    );

    expect(dyn).toBeGreaterThan(0);
    expect(yieldAnnual).toBeGreaterThanOrEqual(0.13); // min 13%
  });

  it("Rastový yield > Vyvážený yield at 0/50/23", () => {
    const balancedResult = getAdjustedMix(balanced.mix, {
      ...profile,
      riskPref: "vyvazeny",
    });
    const growthResult = getAdjustedMix(growth.mix, {
      ...profile,
      riskPref: "rastovy",
    });

    const balancedYield = approxYieldAnnualFromMix(balancedResult.mix);
    const growthYield = approxYieldAnnualFromMix(growthResult.mix);

    console.log(
      `Balanced ${(balancedYield * 100).toFixed(2)}% vs Growth ${(growthYield * 100).toFixed(2)}%`
    );

    expect(growthYield).toBeGreaterThan(balancedYield);
  });
});
