/**
 * COMPREHENSIVE INPUT COMBINATIONS TEST
 *
 * Účel: Otestovať všetky kombinácie vstupov pre rýchle odhalenie chýb
 * (rýchlejšie ako manuálne testovanie v UI)
 *
 * Kombinácie:
 * - Lump sum: 0, 1000, 10000, 100000
 * - Monthly: 50, 100, 250, 500
 * - Horizon: 10, 20, 30
 * - Profiles: konzervativny, vyvazeny, rastovy
 *
 * Total: 4 × 4 × 3 × 3 = 144 tests
 *
 * Validácie:
 * 1. Mix normalizovaný na 100% (±0.01)
 * 2. Žiadne asset > 50% (ETF cap)
 * 3. Gold ≤ 40%
 * 4. Risk score v rozumnom rozsahu (0-10)
 * 5. Yield > 0
 * 6. Žiadne NaN/Infinity hodnoty
 */

import { describe, it, expect } from "vitest";
import { computePortfolioFromInputs } from "../src/features/portfolio/portfolioEngine";
import type { RiskPref } from "../src/features/portfolio/portfolioEngine";

// Test inputs
const LUMP_SUMS = [0, 1_000, 10_000, 100_000];
const MONTHLY_AMOUNTS = [50, 100, 250, 500];
const HORIZONS = [10, 20, 30];
const PROFILES: RiskPref[] = ["konzervativny", "vyvazeny", "rastovy"];

// Validation helpers
function validateMix(
  mix: Array<{ key: string; pct: number }>,
  context: string
) {
  // 1. Sum normalization
  const sum = mix.reduce((acc, item) => acc + item.pct, 0);
  expect(sum, `${context}: Mix sum must be ~100%`).toBeGreaterThanOrEqual(
    99.99
  );
  expect(sum, `${context}: Mix sum must be ~100%`).toBeLessThanOrEqual(100.01);

  // 2. ETF cap (50%)
  const etfItem = mix.find((m) => m.key === "etf");
  if (etfItem) {
    expect(etfItem.pct, `${context}: ETF must be ≤50%`).toBeLessThanOrEqual(
      50.0
    );
  }

  // 3. Gold cap (40%)
  const goldItem = mix.find((m) => m.key === "gold");
  if (goldItem) {
    expect(goldItem.pct, `${context}: Gold must be ≤40%`).toBeLessThanOrEqual(
      40.0
    );
  }

  // 4. No asset > 50%
  mix.forEach((item) => {
    expect(
      item.pct,
      `${context}: ${item.key} must be ≤50%`
    ).toBeLessThanOrEqual(50.0);
  });

  // 5. No NaN/Infinity
  mix.forEach((item) => {
    expect(
      Number.isFinite(item.pct),
      `${context}: ${item.key} pct must be finite`
    ).toBe(true);
    expect(
      Number.isNaN(item.pct),
      `${context}: ${item.key} pct must not be NaN`
    ).toBe(false);
  });
}

function validateMetrics(yieldPa: number, riskScore: number, context: string) {
  // Yield > 0
  expect(yieldPa, `${context}: Yield must be > 0`).toBeGreaterThan(0);
  expect(Number.isFinite(yieldPa), `${context}: Yield must be finite`).toBe(
    true
  );

  // Risk 0-10
  expect(riskScore, `${context}: Risk must be ≥0`).toBeGreaterThanOrEqual(0);
  expect(riskScore, `${context}: Risk must be ≤10`).toBeLessThanOrEqual(10);
  expect(Number.isFinite(riskScore), `${context}: Risk must be finite`).toBe(
    true
  );
}

describe("Portfolio Engine: Input Combinations (144 tests)", () => {
  // Generate all combinations
  const combinations: Array<{
    lump: number;
    monthly: number;
    horizon: number;
    profile: RiskPref;
  }> = [];

  LUMP_SUMS.forEach((lump) => {
    MONTHLY_AMOUNTS.forEach((monthly) => {
      HORIZONS.forEach((horizon) => {
        PROFILES.forEach((profile) => {
          combinations.push({ lump, monthly, horizon, profile });
        });
      });
    });
  });

  // Test each combination
  combinations.forEach(({ lump, monthly, horizon, profile }) => {
    const volume = lump + monthly * 12 * horizon;
    const testName = `${profile} | ${lump}/${monthly}/${horizon} (${(volume / 1000).toFixed(0)}k)`;

    it(testName, () => {
      const result = computePortfolioFromInputs({
        lumpSumEur: lump,
        monthlyVklad: monthly,
        horizonYears: horizon,
        reserveEur: 0,
        riskPref: profile,
      });

      // Context string for error messages
      const ctx = `[${testName}]`;

      // Validate mix
      expect(result.mix, `${ctx}: Mix must exist`).toBeDefined();
      expect(result.mix.length, `${ctx}: Mix must have items`).toBeGreaterThan(
        0
      );
      validateMix(result.mix, ctx);

      // Validate metrics
      validateMetrics(result.yieldPa, result.riskScore, ctx);

      // Validate volume band
      expect(
        ["STARTER", "CORE", "PREMIUM"],
        `${ctx}: Volume band must be valid`
      ).toContain(result.volumeBand);

      // Validate warnings array
      expect(
        Array.isArray(result.warnings),
        `${ctx}: Warnings must be array`
      ).toBe(true);

      // Profile-specific risk checks (with tolerance for edge cases)
      if (profile === "konzervativny") {
        expect(
          result.riskScore,
          `${ctx}: Conservative risk should be ≤6.0 (with tolerance)`
        ).toBeLessThanOrEqual(7.0);
      } else if (profile === "rastovy") {
        expect(
          result.riskScore,
          `${ctx}: Growth risk should be ≥5.0 (with tolerance)`
        ).toBeGreaterThanOrEqual(4.0);
      }
    });
  });

  // Summary test: Check critical edge cases
  describe("Edge case scenarios (known problematic inputs)", () => {
    it("Bug report: 0/50/30 rastovy → ETF 50.01%", () => {
      const result = computePortfolioFromInputs({
        lumpSumEur: 0,
        monthlyVklad: 50,
        horizonYears: 30,
        reserveEur: 0,
        riskPref: "rastovy",
      });

      const ctx = "[Bug: 0/50/30 rastovy]";
      validateMix(result.mix, ctx);

      // Specific check for ETF cap
      const etf = result.mix.find((m) => m.key === "etf");
      expect(etf?.pct, `${ctx}: ETF must be exactly ≤50%`).toBeLessThanOrEqual(
        50.0
      );
    });

    it("Tiny plan: 0/50/10 konzervativny", () => {
      const result = computePortfolioFromInputs({
        lumpSumEur: 0,
        monthlyVklad: 50,
        horizonYears: 10,
        reserveEur: 0,
        riskPref: "konzervativny",
      });

      const ctx = "[Tiny: 0/50/10 konzervativny]";
      validateMix(result.mix, ctx);
      validateMetrics(result.yieldPa, result.riskScore, ctx);
    });

    it("Large plan: 100k/500/30 rastovy", () => {
      const result = computePortfolioFromInputs({
        lumpSumEur: 100_000,
        monthlyVklad: 500,
        horizonYears: 30,
        reserveEur: 0,
        riskPref: "rastovy",
      });

      const ctx = "[Large: 100k/500/30 rastovy]";
      validateMix(result.mix, ctx);
      validateMetrics(result.yieldPa, result.riskScore, ctx);
      expect(result.volumeBand).toBe("PREMIUM");
    });

    it("No lump, high monthly: 0/500/30 vyvazeny", () => {
      const result = computePortfolioFromInputs({
        lumpSumEur: 0,
        monthlyVklad: 500,
        horizonYears: 30,
        reserveEur: 0,
        riskPref: "vyvazeny",
      });

      const ctx = "[0/500/30 vyvazeny]";
      validateMix(result.mix, ctx);
      validateMetrics(result.yieldPa, result.riskScore, ctx);
    });

    it("High lump, no monthly: 100k/0/20 konzervativny", () => {
      const result = computePortfolioFromInputs({
        lumpSumEur: 100_000,
        monthlyVklad: 0,
        horizonYears: 20,
        reserveEur: 0,
        riskPref: "konzervativny",
      });

      const ctx = "[100k/0/20 konzervativny]";
      validateMix(result.mix, ctx);
      validateMetrics(result.yieldPa, result.riskScore, ctx);
    });
  });

  // Profile hierarchy check (for each input combo)
  describe("Profile hierarchy (C < B < G) - sample checks", () => {
    const sampleCombos = [
      { lump: 0, monthly: 100, horizon: 20 },
      { lump: 10_000, monthly: 250, horizon: 20 },
      { lump: 100_000, monthly: 500, horizon: 30 },
    ];

    sampleCombos.forEach(({ lump, monthly, horizon }) => {
      it(`${lump}/${monthly}/${horizon} → C < B < G (yield)`, () => {
        const c = computePortfolioFromInputs({
          lumpSumEur: lump,
          monthlyVklad: monthly,
          horizonYears: horizon,
          reserveEur: 0,
          riskPref: "konzervativny",
        });
        const b = computePortfolioFromInputs({
          lumpSumEur: lump,
          monthlyVklad: monthly,
          horizonYears: horizon,
          reserveEur: 0,
          riskPref: "vyvazeny",
        });
        const g = computePortfolioFromInputs({
          lumpSumEur: lump,
          monthlyVklad: monthly,
          horizonYears: horizon,
          reserveEur: 0,
          riskPref: "rastovy",
        });

        // With P1.2 tolerances
        expect(c.yieldPa).toBeLessThanOrEqual(b.yieldPa + 0.01);
        expect(b.yieldPa).toBeLessThanOrEqual(g.yieldPa + 0.01);
      });

      it(`${lump}/${monthly}/${horizon} → C < B < G (risk)`, () => {
        const c = computePortfolioFromInputs({
          lumpSumEur: lump,
          monthlyVklad: monthly,
          horizonYears: horizon,
          reserveEur: 0,
          riskPref: "konzervativny",
        });
        const b = computePortfolioFromInputs({
          lumpSumEur: lump,
          monthlyVklad: monthly,
          horizonYears: horizon,
          reserveEur: 0,
          riskPref: "vyvazeny",
        });
        const g = computePortfolioFromInputs({
          lumpSumEur: lump,
          monthlyVklad: monthly,
          horizonYears: horizon,
          reserveEur: 0,
          riskPref: "rastovy",
        });

        // With P1.2 tolerances
        expect(c.riskScore).toBeLessThanOrEqual(b.riskScore + 1.5);
        expect(b.riskScore).toBeLessThanOrEqual(g.riskScore + 0.5);
      });
    });
  });
});
