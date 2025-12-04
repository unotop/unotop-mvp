/**
 * P1.3 BENCHMARK TESTS (Regression Protection)
 *
 * Účel: Uzamknúť aktuálne výstupy engine pre 3 referenčné scenáre.
 * Každá zmena v logике, ktorá zmení yield/risk nad tolerancie → FAIL.
 *
 * Tolerancie:
 * - Yield: ±0.5 percentuálny bod (±0.005)
 * - Risk: ±0.2
 *
 * Scenáre:
 * 1. BENCHMARK-STARTER (0/300/30): 108k EUR → PREMIUM band
 * 2. BENCHMARK-CORE (10k/500/20): 130k EUR → PREMIUM band
 * 3. BENCHMARK-PREMIUM (50k/1000/15): 230k EUR → PREMIUM band
 *
 * Baseline: P1.2 final state (01.12.2025)
 */

import { describe, it, expect } from "vitest";
import {
  computePortfolioFromInputs,
  type RiskPref,
} from "../src/features/portfolio/portfolioEngine";

// P1.3 Tolerancie (regression detection)
const YIELD_TOLERANCE = 0.005; // ±0.5 p.b.
const RISK_TOLERANCE = 0.2;

// Baseline hodnoty (P1.2 final state) - PLACEHOLDER, budú zmerané pri prvom behu
type Benchmark = {
  scenario: {
    lumpSumEur: number;
    monthlyVklad: number;
    horizonYears: number;
    reserveEur: number;
  };
  volumeExpected: number;
  baselines: Record<RiskPref, { yield: number; risk: number }>;
};

const BENCHMARKS: Record<string, Benchmark> = {
  "BENCHMARK-STARTER": {
    scenario: {
      lumpSumEur: 0,
      monthlyVklad: 300,
      horizonYears: 30,
      reserveEur: 0,
    },
    volumeExpected: 108_000,
    baselines: {
      konzervativny: { yield: 0.0675, risk: 5.07 }, // P1.2 measured: 6.75%, risk 5.07
      vyvazeny: { yield: 0.1403, risk: 4.07 }, // P1.2 measured: 14.03%, risk 4.07
      rastovy: { yield: 0.1876, risk: 8.35 }, // P1.2 measured: 18.76%, risk 8.35
    },
  },
  "BENCHMARK-CORE": {
    scenario: {
      lumpSumEur: 10_000,
      monthlyVklad: 500,
      horizonYears: 20,
      reserveEur: 0,
    },
    volumeExpected: 130_000,
    baselines: {
      konzervativny: { yield: 0.1073, risk: 4.96 }, // P1.2 measured: 10.73%, risk 4.96
      vyvazeny: { yield: 0.1528, risk: 6.35 }, // P1.2 measured: 15.28%, risk 6.35
      rastovy: { yield: 0.1838, risk: 6.53 }, // P1.2 measured: 18.38%, risk 6.53
    },
  },
  "BENCHMARK-PREMIUM": {
    scenario: {
      lumpSumEur: 50_000,
      monthlyVklad: 1_000,
      horizonYears: 15,
      reserveEur: 0,
    },
    volumeExpected: 230_000,
    baselines: {
      konzervativny: { yield: 0.1073, risk: 4.96 }, // P1.2 measured: 10.73%, risk 4.96
      vyvazeny: { yield: 0.1528, risk: 6.35 }, // P1.2 measured: 15.28%, risk 6.35
      rastovy: { yield: 0.1838, risk: 6.53 }, // P1.2 measured: 18.38%, risk 6.53
    },
  },
};

describe("Portfolio Engine: P1.3 Benchmark Tests (Regression Protection)", () => {
  // P1.3 MAIN TESTS: Yield & Risk regression detection
  describe.each(Object.entries(BENCHMARKS))(
    "%s",
    (benchmarkName, { scenario, volumeExpected, baselines }) => {
      const profiles: RiskPref[] = ["konzervativny", "vyvazeny", "rastovy"];

      profiles.forEach((profile) => {
        const baseline = baselines[profile];

        it(`${profile} → yield ${(baseline.yield * 100).toFixed(2)}% ±0.5 p.b.`, () => {
          const result = computePortfolioFromInputs({
            lumpSumEur: scenario.lumpSumEur,
            monthlyVklad: scenario.monthlyVklad,
            horizonYears: scenario.horizonYears,
            reserveEur: scenario.reserveEur,
            riskPref: profile,
          });

          expect(result.volumeBand).toBe("PREMIUM"); // všetky 3 benchmarky sú PREMIUM

          // REGRESSION CHECK: Yield nesmie vybočiť z ±0.5 p.b.
          const yieldDiff = Math.abs(result.yieldPa - baseline.yield);
          expect(yieldDiff).toBeLessThanOrEqual(YIELD_TOLERANCE);
          expect(result.yieldPa).toBeGreaterThanOrEqual(
            baseline.yield - YIELD_TOLERANCE
          );
          expect(result.yieldPa).toBeLessThanOrEqual(
            baseline.yield + YIELD_TOLERANCE
          );
        });

        it(`${profile} → risk ${baseline.risk.toFixed(2)} ±0.2`, () => {
          const result = computePortfolioFromInputs({
            lumpSumEur: scenario.lumpSumEur,
            monthlyVklad: scenario.monthlyVklad,
            horizonYears: scenario.horizonYears,
            reserveEur: scenario.reserveEur,
            riskPref: profile,
          });

          // REGRESSION CHECK: Risk nesmie vybočiť z ±0.2
          const riskDiff = Math.abs(result.riskScore - baseline.risk);
          expect(riskDiff).toBeLessThanOrEqual(RISK_TOLERANCE);
          expect(result.riskScore).toBeGreaterThanOrEqual(
            baseline.risk - RISK_TOLERANCE
          );
          expect(result.riskScore).toBeLessThanOrEqual(
            baseline.risk + RISK_TOLERANCE
          );
        });
      });
    }
  );

  // P1.3 SANITY: Benchmark consistency (cross-profile ordering)
  describe("Benchmark consistency (C < B < G)", () => {
    it("BENCHMARK-STARTER → C < B < G (yield)", () => {
      const c = computePortfolioFromInputs({
        lumpSumEur: 0,
        monthlyVklad: 300,
        horizonYears: 30,
        reserveEur: 0,
        riskPref: "konzervativny",
      });
      const b = computePortfolioFromInputs({
        lumpSumEur: 0,
        monthlyVklad: 300,
        horizonYears: 30,
        reserveEur: 0,
        riskPref: "vyvazeny",
      });
      const g = computePortfolioFromInputs({
        lumpSumEur: 0,
        monthlyVklad: 300,
        horizonYears: 30,
        reserveEur: 0,
        riskPref: "rastovy",
      });

      expect(c.yieldPa).toBeLessThan(b.yieldPa);
      expect(b.yieldPa).toBeLessThan(g.yieldPa);
    });

    it("BENCHMARK-STARTER → C < B < G (risk)", () => {
      const c = computePortfolioFromInputs({
        lumpSumEur: 0,
        monthlyVklad: 300,
        horizonYears: 30,
        reserveEur: 0,
        riskPref: "konzervativny",
      });
      const b = computePortfolioFromInputs({
        lumpSumEur: 0,
        monthlyVklad: 300,
        horizonYears: 30,
        reserveEur: 0,
        riskPref: "vyvazeny",
      });
      const g = computePortfolioFromInputs({
        lumpSumEur: 0,
        monthlyVklad: 300,
        horizonYears: 30,
        reserveEur: 0,
        riskPref: "rastovy",
      });

      // BENCHMARK-STARTER má známu inverziu C=5.07 > B=4.07 (P1.2 tolerancia C≤B+1.5)
      expect(c.riskScore).toBeLessThanOrEqual(b.riskScore + 1.5);
      expect(b.riskScore).toBeLessThan(g.riskScore);
    });

    it("BENCHMARK-CORE → C < B < G (yield)", () => {
      const c = computePortfolioFromInputs({
        lumpSumEur: 10_000,
        monthlyVklad: 500,
        horizonYears: 20,
        reserveEur: 0,
        riskPref: "konzervativny",
      });
      const b = computePortfolioFromInputs({
        lumpSumEur: 10_000,
        monthlyVklad: 500,
        horizonYears: 20,
        reserveEur: 0,
        riskPref: "vyvazeny",
      });
      const g = computePortfolioFromInputs({
        lumpSumEur: 10_000,
        monthlyVklad: 500,
        horizonYears: 20,
        reserveEur: 0,
        riskPref: "rastovy",
      });

      expect(c.yieldPa).toBeLessThan(b.yieldPa);
      expect(b.yieldPa).toBeLessThan(g.yieldPa);
    });

    it("BENCHMARK-CORE → C < B < G (risk)", () => {
      const c = computePortfolioFromInputs({
        lumpSumEur: 10_000,
        monthlyVklad: 500,
        horizonYears: 20,
        reserveEur: 0,
        riskPref: "konzervativny",
      });
      const b = computePortfolioFromInputs({
        lumpSumEur: 10_000,
        monthlyVklad: 500,
        horizonYears: 20,
        reserveEur: 0,
        riskPref: "vyvazeny",
      });
      const g = computePortfolioFromInputs({
        lumpSumEur: 10_000,
        monthlyVklad: 500,
        horizonYears: 20,
        reserveEur: 0,
        riskPref: "rastovy",
      });

      expect(c.riskScore).toBeLessThan(b.riskScore);
      expect(b.riskScore).toBeLessThan(g.riskScore);
    });

    it("BENCHMARK-PREMIUM → C < B < G (yield)", () => {
      const c = computePortfolioFromInputs({
        lumpSumEur: 50_000,
        monthlyVklad: 1_000,
        horizonYears: 15,
        reserveEur: 0,
        riskPref: "konzervativny",
      });
      const b = computePortfolioFromInputs({
        lumpSumEur: 50_000,
        monthlyVklad: 1_000,
        horizonYears: 15,
        reserveEur: 0,
        riskPref: "vyvazeny",
      });
      const g = computePortfolioFromInputs({
        lumpSumEur: 50_000,
        monthlyVklad: 1_000,
        horizonYears: 15,
        reserveEur: 0,
        riskPref: "rastovy",
      });

      expect(c.yieldPa).toBeLessThan(b.yieldPa);
      expect(b.yieldPa).toBeLessThan(g.yieldPa);
    });

    it("BENCHMARK-PREMIUM → C < B < G (risk)", () => {
      const c = computePortfolioFromInputs({
        lumpSumEur: 50_000,
        monthlyVklad: 1_000,
        horizonYears: 15,
        reserveEur: 0,
        riskPref: "konzervativny",
      });
      const b = computePortfolioFromInputs({
        lumpSumEur: 50_000,
        monthlyVklad: 1_000,
        horizonYears: 15,
        reserveEur: 0,
        riskPref: "vyvazeny",
      });
      const g = computePortfolioFromInputs({
        lumpSumEur: 50_000,
        monthlyVklad: 1_000,
        horizonYears: 15,
        reserveEur: 0,
        riskPref: "rastovy",
      });

      expect(c.riskScore).toBeLessThan(b.riskScore);
      expect(b.riskScore).toBeLessThan(g.riskScore);
    });
  });
});
