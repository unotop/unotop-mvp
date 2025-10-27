/**
 * PR-15/16 Integration Tests
 *
 * Overenie:
 * - PR-15: UP-TUNE/DOWN-TUNE risk balancing (target bands)
 * - PR-16: Right panel state machine (ZERO/PARTIAL/ACTIVE)
 */

import { describe, test, expect } from "vitest";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import { riskScore0to10 } from "../src/features/mix/assetModel";
import {
  detectRightPanelState,
  shouldShowYieldRisk,
} from "../src/features/overview/rightPanelState";
import type { MixItem } from "../src/features/mix/mix.service";
import type { RiskPref } from "../src/features/mix/assetModel";

// Helper: vytvor base mix
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

describe("PR-15: UP-TUNE/DOWN-TUNE Risk Balancing", () => {
  test("Konzervatívny: nízky vklad → UP-TUNE k target 4.0-4.5", () => {
    const baseMix = createBaseMix();
    const profile = {
      lumpSumEur: 100,
      monthlyEur: 50,
      horizonYears: 40,
      monthlyIncome: 2000,
      fixedExpenses: 800,
      variableExpenses: 500,
      reserveEur: 1000,
      reserveMonths: 3,
      riskPref: "konzervativny" as RiskPref,
    };

    const { mix } = getAdjustedMix(baseMix, profile);
    const risk = riskScore0to10(mix, "konzervativny");

    // Target band: 4.0-4.5 (90-100% z cap 4.5)
    expect(
      risk,
      "Konzervatívny risk should be in target band 4.0-4.5"
    ).toBeGreaterThanOrEqual(3.8);
    expect(
      risk,
      "Konzervatívny risk should be in target band 4.0-4.5"
    ).toBeLessThanOrEqual(4.7);

    console.log(
      `Konzervatívny (100€/50€): risk=${risk.toFixed(2)}, target=4.0-4.5`
    );
  });

  test("Vyvážený: nízky vklad → UP-TUNE k target 6.17-6.5", () => {
    const baseMix = createBaseMix();
    const profile = {
      lumpSumEur: 100,
      monthlyEur: 50,
      horizonYears: 40,
      monthlyIncome: 2000,
      fixedExpenses: 800,
      variableExpenses: 500,
      reserveEur: 1000,
      reserveMonths: 3,
      riskPref: "vyvazeny" as RiskPref,
    };

    const { mix } = getAdjustedMix(baseMix, profile);
    const risk = riskScore0to10(mix, "vyvazeny");

    // Target band: 6.17-6.5 (95-100% z cap 6.5)
    expect(
      risk,
      "Vyvážený risk should be in target band 6.0-7.0"
    ).toBeGreaterThanOrEqual(5.8);
    expect(
      risk,
      "Vyvážený risk should be in target band 6.0-7.0"
    ).toBeLessThanOrEqual(7.2);

    console.log(
      `Vyvážený (100€/50€): risk=${risk.toFixed(2)}, target=6.17-6.5`
    );
  });

  test("Rastový: nízky vklad → UP-TUNE k target 7.84-8.0", () => {
    const baseMix = createBaseMix();
    const profile = {
      lumpSumEur: 100,
      monthlyEur: 50,
      horizonYears: 40,
      monthlyIncome: 2000,
      fixedExpenses: 800,
      variableExpenses: 500,
      reserveEur: 1000,
      reserveMonths: 3,
      riskPref: "rastovy" as RiskPref,
    };

    const { mix } = getAdjustedMix(baseMix, profile);
    const risk = riskScore0to10(mix, "rastovy");

    // Target band: 7.84-8.0 (98-100% z cap 8.0)
    expect(
      risk,
      "Rastový risk should be in target band 7.5-8.5"
    ).toBeGreaterThanOrEqual(7.3);
    expect(
      risk,
      "Rastový risk should be in target band 7.5-8.5"
    ).toBeLessThanOrEqual(8.7);

    console.log(`Rastový (100€/50€): risk=${risk.toFixed(2)}, target=7.84-8.0`);
  });

  test("DOWN-TUNE: vysoký kapitál → risk pod cap", () => {
    const baseMix = createBaseMix();
    const profile = {
      lumpSumEur: 100_000,
      monthlyEur: 1000,
      horizonYears: 5,
      monthlyIncome: 5000,
      fixedExpenses: 2000,
      variableExpenses: 1000,
      reserveEur: 10_000,
      reserveMonths: 6,
      riskPref: "rastovy" as RiskPref,
    };

    const { mix } = getAdjustedMix(baseMix, profile);
    const risk = riskScore0to10(mix, "rastovy");

    // DOWN-TUNE by mal znížiť risk pod cap (8.0 pre rastový v LATE stage)
    // LATE stage cap je nižší (napr. 7.0-7.5)
    expect(risk, "DOWN-TUNE should reduce risk below cap").toBeLessThanOrEqual(
      8.5
    );

    console.log(`DOWN-TUNE (100k€/1000€): risk=${risk.toFixed(2)}, cap<=8.0`);
  });
});

describe("PR-16: Right Panel State Machine", () => {
  test("ZERO state: žiadne investment inputs", () => {
    const state = detectRightPanelState({
      lumpSumEur: 0,
      monthlyVklad: 0,
      horizonYears: 0,
      goalAssetsEur: 0,
      monthlyIncome: 0,
      reserveEur: 0,
      reserveMonths: 0,
    });

    expect(state, "Should detect ZERO state").toBe("ZERO");
    expect(
      shouldShowYieldRisk(state),
      "Should NOT show yield/risk in ZERO"
    ).toBe(false);
  });

  test("PARTIAL state: investment OK, chýba profil", () => {
    const state = detectRightPanelState({
      lumpSumEur: 1000,
      monthlyVklad: 500,
      horizonYears: 10,
      goalAssetsEur: 0, // No goal
      monthlyIncome: 0, // No income
      reserveEur: 0, // No reserve
      reserveMonths: 0,
    });

    expect(state, "Should detect PARTIAL state").toBe("PARTIAL");
    expect(
      shouldShowYieldRisk(state),
      "Should NOT show yield/risk in PARTIAL"
    ).toBe(false);
  });

  test("ACTIVE state (goal provided): všetko OK", () => {
    const state = detectRightPanelState({
      lumpSumEur: 1000,
      monthlyVklad: 500,
      horizonYears: 10,
      goalAssetsEur: 50_000, // Goal set
      monthlyIncome: 0,
      reserveEur: 0,
      reserveMonths: 0,
    });

    expect(state, "Should detect ACTIVE state (goal provided)").toBe("ACTIVE");
    expect(shouldShowYieldRisk(state), "Should show yield/risk in ACTIVE").toBe(
      true
    );
  });

  test("ACTIVE state (profile provided): všetko OK", () => {
    const state = detectRightPanelState({
      lumpSumEur: 1000,
      monthlyVklad: 500,
      horizonYears: 10,
      goalAssetsEur: 0, // No goal
      monthlyIncome: 2000, // Income set
      reserveEur: 1000, // Reserve set
      reserveMonths: 3,
    });

    expect(state, "Should detect ACTIVE state (profile provided)").toBe(
      "ACTIVE"
    );
    expect(shouldShowYieldRisk(state), "Should show yield/risk in ACTIVE").toBe(
      true
    );
  });

  test("ACTIVE state (both goal + profile): všetko OK", () => {
    const state = detectRightPanelState({
      lumpSumEur: 1000,
      monthlyVklad: 500,
      horizonYears: 10,
      goalAssetsEur: 50_000, // Goal set
      monthlyIncome: 2000, // Income set
      reserveEur: 1000, // Reserve set
      reserveMonths: 3,
    });

    expect(state, "Should detect ACTIVE state (full profile)").toBe("ACTIVE");
    expect(shouldShowYieldRisk(state), "Should show yield/risk in ACTIVE").toBe(
      true
    );
  });
});
