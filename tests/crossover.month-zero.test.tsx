/**
 * PR-10 Priorita 3: Crossover pri mesiaci 0 (lump sum > debts)
 *
 * Advisor verdikt:
 * "Ak lumpSum > celkový dlh, crossover nastane v mesiaci 0 (okamžite).
 * Nefiltruj mesiac 0 pri rendri."
 */

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useProjection } from "../src/features/projection/useProjection";
import type { MixItem } from "../src/features/mix/mix.service";

describe("Crossover: mesiac 0 (lump sum > debts)", () => {
  it("zobrazí crossoverIndex=0 ak lumpSum > celkový dlh", () => {
    const mix: MixItem[] = [
      { key: "etf", pct: 60 },
      { key: "bonds", pct: 40 },
    ];

    const debts = [
      {
        id: "d1",
        name: "Spotrebný",
        principal: 10000,
        ratePa: 8,
        monthly: 200,
        monthsLeft: 60,
        extraMonthly: 0,
      },
    ];

    // LUMP SUM > DEBT (50k vs 10k)
    const { result } = renderHook(() =>
      useProjection({
        lumpSumEur: 50000,
        monthlyVklad: 0,
        horizonYears: 10,
        goalAssetsEur: 0,
        mix,
        debts,
        riskPref: "vyvazeny",
      })
    );

    // Crossover by mal byť okamžitý (mesiac 0)
    expect(result.current.crossoverIndex).toBe(0);
    expect(result.current.fvSeries[0]).toBeGreaterThan(
      result.current.debtSeries[0]
    );
  });

  it("nezobrazí crossover ak lumpSum < debt", () => {
    const mix: MixItem[] = [
      { key: "etf", pct: 60 },
      { key: "bonds", pct: 40 },
    ];

    const debts = [
      {
        id: "d1",
        name: "Spotrebný",
        principal: 50000,
        ratePa: 8,
        monthly: 500,
        monthsLeft: 120,
        extraMonthly: 0,
      },
    ];

    // LUMP SUM < DEBT (10k vs 50k)
    const { result } = renderHook(() =>
      useProjection({
        lumpSumEur: 10000,
        monthlyVklad: 300,
        horizonYears: 10,
        goalAssetsEur: 0,
        mix,
        debts,
        riskPref: "vyvazeny",
      })
    );

    // Crossover môže byť neskôr (nie mesiac 0), alebo null
    if (result.current.crossoverIndex !== null) {
      expect(result.current.crossoverIndex).toBeGreaterThan(0);
    }
  });

  it("crossover nastane neskôr ak lump=0 ale monthly vklad je dostatočný", () => {
    const mix: MixItem[] = [
      { key: "etf", pct: 60 },
      { key: "bonds", pct: 40 },
    ];

    const debts = [
      {
        id: "d1",
        name: "Spotrebný",
        principal: 20000,
        ratePa: 8,
        monthly: 400,
        monthsLeft: 60,
        extraMonthly: 0,
      },
    ];

    // LUMP=0, ale monthly 500€
    const { result } = renderHook(() =>
      useProjection({
        lumpSumEur: 0,
        monthlyVklad: 500,
        horizonYears: 10,
        goalAssetsEur: 0,
        mix,
        debts,
        riskPref: "vyvazeny",
      })
    );

    // Crossover by mal byť neskôr (nie 0)
    if (result.current.crossoverIndex !== null) {
      expect(result.current.crossoverIndex).toBeGreaterThan(0);
      expect(result.current.crossoverIndex).toBeLessThanOrEqual(10); // do 10 rokov
    }
  });
});
