/**
 * Test SINGLE profile to verify getAdjustedMix isolation
 */

import { describe, it, expect } from "vitest";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";
import {
  riskScore0to10,
  approxYieldAnnualFromMix,
} from "../src/features/mix/assetModel";

describe("Single Profile Test (10k/300/20)", () => {
  const testScenario = {
    lumpSumEur: 10000,
    monthlyEur: 300,
    horizonYears: 20,
    monthlyIncome: 2000,
    fixedExpenses: 1000,
    variableExpenses: 500,
    reserveEur: 5000,
    reserveMonths: 6,
  };

  it("Conservative alone", () => {
    const conservative = PORTFOLIO_PRESETS.find(
      (p) => p.id === "konzervativny"
    )!;

    const result = getAdjustedMix(conservative.mix, {
      ...testScenario,
      riskPref: "konzervativny",
    });

    const risk = riskScore0to10(result.mix, "konzervativny");
    const yieldPa = approxYieldAnnualFromMix(result.mix);
    const sum = result.mix.reduce((acc, m) => acc + m.pct, 0);

    console.log(
      `Conservative: Risk ${risk.toFixed(2)}, Yield ${yieldPa.toFixed(2)}%, Sum ${sum.toFixed(2)}%`
    );

    expect(risk).toBeGreaterThan(0);
    expect(risk).toBeLessThan(10);
    expect(yieldPa).toBeGreaterThan(0);
    expect(yieldPa).toBeLessThan(50);
    expect(sum).toBeCloseTo(100, 0);
  });

  it("Balanced alone", () => {
    const balanced = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;

    const result = getAdjustedMix(balanced.mix, {
      ...testScenario,
      riskPref: "vyvazeny",
    });

    const risk = riskScore0to10(result.mix, "vyvazeny");
    const yieldPa = approxYieldAnnualFromMix(result.mix);
    const sum = result.mix.reduce((acc, m) => acc + m.pct, 0);

    console.log(
      `Balanced: Risk ${risk.toFixed(2)}, Yield ${yieldPa.toFixed(2)}%, Sum ${sum.toFixed(2)}%`
    );

    expect(risk).toBeGreaterThan(0);
    expect(risk).toBeLessThan(10);
    expect(yieldPa).toBeGreaterThan(0);
    expect(yieldPa).toBeLessThan(50);
    expect(sum).toBeCloseTo(100, 0);
  });

  it("Growth alone", () => {
    const growth = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;

    const result = getAdjustedMix(growth.mix, {
      ...testScenario,
      riskPref: "rastovy",
    });

    const risk = riskScore0to10(result.mix, "rastovy");
    const yieldPa = approxYieldAnnualFromMix(result.mix);
    const sum = result.mix.reduce((acc, m) => acc + m.pct, 0);

    console.log(
      `Growth: Risk ${risk.toFixed(2)}, Yield ${yieldPa.toFixed(2)}%, Sum ${sum.toFixed(2)}%`
    );

    expect(risk).toBeGreaterThan(0);
    expect(risk).toBeLessThan(10);
    expect(yieldPa).toBeGreaterThan(0);
    expect(yieldPa).toBeLessThan(50);
    expect(sum).toBeCloseTo(100, 0);
  });
});
