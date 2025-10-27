/**
 * Edge case test: Mesačný vklad ≤51€ + lump ≤2489€
 * User hlási: "portfolio nereaguje"
 */

import { describe, test, expect } from "vitest";
import { detectStage } from "../src/features/policy/stage";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import { enforceStageCaps } from "../src/features/portfolio/presets";
import type { MixItem } from "../src/features/mix/mix.service";

function createBaseMix(): MixItem[] {
  return [
    { key: "gold", pct: 15 },
    { key: "etf", pct: 30 },
    { key: "bonds", pct: 10 },
    { key: "bond3y9", pct: 10 },
    { key: "dyn", pct: 10 },
    { key: "cash", pct: 20 },
    { key: "crypto", pct: 4 },
    { key: "real", pct: 1 },
  ];
}

describe("Edge Case: Veľmi nízky vklad (≤51€) + malý lump (≤2489€)", () => {
  test("51€ monthly / 2489€ lump / 10r → should respond", () => {
    const lump = 2489;
    const monthly = 51;
    const years = 10;

    const stage = detectStage(lump, monthly, years);
    console.log(
      `Stage: ${stage} (lump=${lump}, monthly=${monthly}, years=${years})`
    );

    const baseMix = createBaseMix();
    const profile = {
      lumpSumEur: lump,
      monthlyEur: monthly,
      horizonYears: years,
      monthlyIncome: 1500,
      fixedExpenses: 500,
      variableExpenses: 300,
      reserveEur: 500,
      reserveMonths: 2,
      riskPref: "vyvazeny" as const,
    };

    // Test 1: getAdjustedMix (main flow)
    const { mix: adjustedMix } = getAdjustedMix(baseMix, profile);
    const sum = adjustedMix.reduce((acc, m) => acc + m.pct, 0);

    console.log(`Adjusted mix sum: ${sum.toFixed(2)}%`);
    console.log(
      `Mix: ${adjustedMix.map((m) => `${m.key}:${m.pct.toFixed(1)}`).join(", ")}`
    );

    expect(sum, "Adjusted mix should sum to ~100%").toBeGreaterThanOrEqual(
      99.95
    );
    expect(sum, "Adjusted mix should sum to ~100%").toBeLessThanOrEqual(100.05);

    // Test 2: enforceStageCaps (direct call)
    const capsResult = enforceStageCaps(baseMix, "vyvazeny", stage);
    const capsSum = capsResult.reduce((acc, m) => acc + m.pct, 0);

    console.log(`Caps result sum: ${capsSum.toFixed(2)}%`);

    expect(capsSum, "Caps result should sum to ~100%").toBeGreaterThanOrEqual(
      99.95
    );
    expect(capsSum, "Caps result should sum to ~100%").toBeLessThanOrEqual(
      100.05
    );
  });

  test("30€ monthly / 1000€ lump / 15r → should respond", () => {
    const lump = 1000;
    const monthly = 30;
    const years = 15;

    const stage = detectStage(lump, monthly, years);
    console.log(
      `Stage: ${stage} (lump=${lump}, monthly=${monthly}, years=${years})`
    );

    const baseMix = createBaseMix();
    const profile = {
      lumpSumEur: lump,
      monthlyEur: monthly,
      horizonYears: years,
      monthlyIncome: 1000,
      fixedExpenses: 400,
      variableExpenses: 200,
      reserveEur: 300,
      reserveMonths: 2,
      riskPref: "konzervativny" as const,
    };

    const { mix } = getAdjustedMix(baseMix, profile);
    const sum = mix.reduce((acc, m) => acc + m.pct, 0);

    console.log(`Adjusted mix sum: ${sum.toFixed(2)}%`);
    console.log(
      `Mix: ${mix.map((m) => `${m.key}:${m.pct.toFixed(1)}`).join(", ")}`
    );

    expect(
      sum,
      "Very low monthly should still produce valid mix"
    ).toBeGreaterThanOrEqual(99.95);
    expect(
      sum,
      "Very low monthly should still produce valid mix"
    ).toBeLessThanOrEqual(100.05);
  });

  test("0€ monthly / 500€ lump / 20r → should respond (extreme)", () => {
    const lump = 500;
    const monthly = 0;
    const years = 20;

    const stage = detectStage(lump, monthly, years);
    console.log(
      `Stage: ${stage} (lump=${lump}, monthly=${monthly}, years=${years})`
    );

    const baseMix = createBaseMix();
    const profile = {
      lumpSumEur: lump,
      monthlyEur: monthly,
      horizonYears: years,
      monthlyIncome: 800,
      fixedExpenses: 300,
      variableExpenses: 200,
      reserveEur: 200,
      reserveMonths: 1,
      riskPref: "vyvazeny" as const,
    };

    const { mix } = getAdjustedMix(baseMix, profile);
    const sum = mix.reduce((acc, m) => acc + m.pct, 0);

    console.log(`Adjusted mix sum: ${sum.toFixed(2)}%`);
    console.log(
      `Mix: ${mix.map((m) => `${m.key}:${m.pct.toFixed(1)}`).join(", ")}`
    );

    expect(
      sum,
      "Zero monthly should still produce valid mix"
    ).toBeGreaterThanOrEqual(99.95);
    expect(
      sum,
      "Zero monthly should still produce valid mix"
    ).toBeLessThanOrEqual(100.05);
  });
});
