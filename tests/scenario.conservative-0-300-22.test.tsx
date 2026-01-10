/**
 * PR-39: Regression test - Conservative 0/300/22 preset validation failure
 * 
 * Issue: Pri nastavení lump=0, monthly=300, horizon=22 sa nedal vybrať konzervatívny profil.
 * Root cause: 
 * 1. enforceRiskCap nemohol dostať risk pod 4.0 (Conservative cap) → ostal na 4.12
 * 2. yield optimizer potom zvýšil risk na 4.24 (v rámci headroom 4.5)
 * 3. Validation kontrolovala proti riskMax=4.0 → FAIL
 * 
 * Fix: Yield optimizer teraz kontroluje `currentRisk > riskMax` (bez headroom) pred aplikáciou moves.
 * Ak je risk už nad cap, optimizer sa zastaví a nič nezvyšuje.
 */

import { describe, it, expect } from "vitest";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import type { ProfileForAdjustments } from "../src/features/portfolio/mixAdjustments";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";
import { riskScore0to10 } from "../src/features/mix/assetModel";

describe("Conservative preset validation (0/300/22)", () => {
  const conservativePreset = PORTFOLIO_PRESETS.find(
    (p) => p.id === "konzervativny"
  )!;

  const profile: ProfileForAdjustments = {
    lumpSumEur: 0,
    monthlyEur: 300,
    horizonYears: 22,
    goalAssetsEur: 0,
    debts: [],
    riskPref: "konzervativny",
  };

  it("should successfully apply Conservative preset without validation failure", () => {
    // Apply adjustments (štartuje s preset mixom)
    const result = getAdjustedMix(conservativePreset.mix, profile);

    // Validation checks (tie isté čo používa PortfolioSelector)
    expect(result).toBeDefined();
    expect(result.mix).toBeDefined();

    const { mix } = result;
    const finalRisk = riskScore0to10(mix);

    // 1. Risk musí byť pod Conservative cap (4.0)
    // PR-39 FIX: Yield optimizer teraz stopuje ak risk > riskMax, takže finálny risk
    // by mal byť <= 4.0 (nie 4.24 ako pred fixom)
    expect(finalRisk).toBeLessThanOrEqual(4.0);

    // 2. Mix musí byť normalized (súčet = 100%)
    const total = mix.reduce((sum, m) => sum + m.pct, 0);
    expect(total).toBeCloseTo(100, 1);

    // 3. ETF minimum (5% pre Conservative)
    const etf = mix.find((m) => m.key === "etf");
    expect(etf).toBeDefined();
    expect(etf!.pct).toBeGreaterThanOrEqual(5.0);

    // 4. Bonds minimum (5% combined)
    const bonds = mix.find((m) => m.key === "bonds");
    const bond3y9 = mix.find((m) => m.key === "bond3y9");
    const totalBonds = (bonds?.pct ?? 0) + (bond3y9?.pct ?? 0);
    expect(totalBonds).toBeGreaterThanOrEqual(5.0);

    // 5. Dyn should be 0 (Conservative in CORE band doesn't allow dyn)
    const dyn = mix.find((m) => m.key === "dyn");
    expect(dyn?.pct ?? 0).toBe(0);

    // Debug output (pre manuálnu verifikáciu)
    console.log(
      `[Conservative 0/300/22] Final risk: ${finalRisk.toFixed(2)}, Mix:`,
      mix
        .filter((m) => m.pct > 0)
        .map((m) => `${m.key}:${m.pct.toFixed(1)}%`)
        .join(", ")
    );
  });

  it("should NOT increase risk if already above riskMax", () => {
    // Test že yield optimizer detekuje stav "risk > riskMax" a stopuje
    const result = getAdjustedMix(conservativePreset.mix, profile);

    const { mix } = result;
    const finalRisk = riskScore0to10(mix);

    // Yield optimizer by NEMAL zvýšiť risk nad Conservative cap (4.0)
    // Pred PR-39 fixom: risk bol 4.24 (yield optimizer pridal 0.12)
    // Po PR-39 fixe: risk je <= 4.0 (yield optimizer stopol)
    expect(finalRisk).toBeLessThanOrEqual(4.0);

    // Edge case: Ak enforceRiskCap nemohol dostať risk presne na 4.0,
    // môže ostať mierne nad (napr. 4.05), ale NESMIE byť 4.24 ako pred fixom
    expect(finalRisk).toBeLessThan(4.15); // Tolerancia pre enforcement ťažkosti
  });
});
