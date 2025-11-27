/**
 * PR-34 Manual Test: Balanced/Growth Profile Gold Cap
 * 
 * TEST: Overenie GOLD_POLICY caps a RISK_SINKS logiky
 * - Balanced: gold ≤ 20% (hardCap)
 * - Growth: gold ≤ 15% (hardCap)
 * - RISK_SINKS priorita: bonds > bond3y9 > gold (capped) > cash
 */

import { describe, it, expect } from "vitest";
import { enforceRiskCap } from "../src/features/portfolio/enforceRiskCap";
import { normalize } from "../src/features/mix/mix.service";
import type { MixItem, RiskPref } from "../src/types/core";

describe("PR-34: Balanced/Growth gold caps", () => {
  it("Balanced enforceRiskCap → gold max 20% (GOLD_POLICY.vyvazeny.hardCap)", () => {
    // Mock mix: vysoké riziká (dyn 25%, crypto 10%, ETF 30%, gold 5%, bonds 15%, bond9 10%, cash 5%)
    const baseMix: MixItem[] = normalize([
      { key: "dyn", pct: 25 },
      { key: "crypto", pct: 10 },
      { key: "etf", pct: 30 },
      { key: "gold", pct: 5 },
      { key: "bonds", pct: 15 },
      { key: "bond3y9", pct: 10 },
      { key: "cash", pct: 5 },
      { key: "real", pct: 0 },
    ]);

    const result = enforceRiskCap(baseMix, "vyvazeny" as RiskPref, {
      gold: 20, // GOLD_POLICY.vyvazeny.hardCap
      etf: 50,
      dyn: 22,
      crypto: 8,
    });

    console.log("[PR-34 Test] Balanced enforceRiskCap result:");
    result.mix.forEach((m) => {
      if (m.pct > 0.5) {
        console.log(`  ${m.key}: ${m.pct.toFixed(2)}%`);
      }
    });
    console.log(`  Initial risk: ${result.initialRisk.toFixed(2)}`);
    console.log(`  Final risk: ${result.finalRisk.toFixed(2)}`);
    console.log(`  Iterations: ${result.iterations}`);

    // CRITICAL: Gold ≤ 20% (GOLD_POLICY.vyvazeny.hardCap)
    const goldItem = result.mix.find((m) => m.key === "gold");
    expect(goldItem).toBeDefined();
    expect(goldItem!.pct).toBeLessThanOrEqual(20.5); // 0.5 buffer pre normalize

    // Bonds/bond9 by mali byť viac ako pôvodne (redistribúcia z risk assets)
    const bondsItem = result.mix.find((m) => m.key === "bonds");
    const bond9Item = result.mix.find((m) => m.key === "bond3y9");
    expect(bondsItem!.pct).toBeGreaterThan(15); // min zvýšenie
    expect(bond9Item!.pct).toBeGreaterThan(10); // min zvýšenie

    // Risk by mal klesnúť
    expect(result.finalRisk).toBeLessThan(result.initialRisk);
  });

  it("Growth enforceRiskCap → gold max 15% (GOLD_POLICY.rastovy.hardCap)", () => {
    const baseMix: MixItem[] = normalize([
      { key: "dyn", pct: 30 },
      { key: "crypto", pct: 12 },
      { key: "etf", pct: 28 },
      { key: "gold", pct: 5 },
      { key: "bonds", pct: 10 },
      { key: "bond3y9", pct: 10 },
      { key: "cash", pct: 3 },
      { key: "real", pct: 2 },
    ]);

    const result = enforceRiskCap(baseMix, "rastovy" as RiskPref, {
      gold: 15, // GOLD_POLICY.rastovy.hardCap
      etf: 50,
      dyn: 22,
      crypto: 8,
    });

    console.log("[PR-34 Test] Growth enforceRiskCap result:");
    result.mix.forEach((m) => {
      if (m.pct > 0.5) {
        console.log(`  ${m.key}: ${m.pct.toFixed(2)}%`);
      }
    });
    console.log(`  Initial risk: ${result.initialRisk.toFixed(2)}`);
    console.log(`  Final risk: ${result.finalRisk.toFixed(2)}`);
    console.log(`  Iterations: ${result.iterations}`);

    // CRITICAL: Gold ≤ 15% (GOLD_POLICY.rastovy.hardCap)
    const goldItem = result.mix.find((m) => m.key === "gold");
    expect(goldItem).toBeDefined();
    expect(goldItem!.pct).toBeLessThanOrEqual(15.5);

    // Bonds/bond9/real by mali byť viac ako pôvodne (AK sa enforcement spustil)
    // Ak risk už bol pod cap → nemuselo sa nič meniť
    const bondsItem = result.mix.find((m) => m.key === "bonds");
    const bond9Item = result.mix.find((m) => m.key === "bond3y9");
    
    if (result.iterations > 0) {
      // Enforcement sa spustil → aspoň bonds alebo bond9 by mali narásť
      const totalBonds = bondsItem!.pct + bond9Item!.pct;
      expect(totalBonds).toBeGreaterThan(19); // min 10+10 + redistribúcia
    } else {
      // Risk už bol OK → no changes
      expect(result.finalRisk).toBeLessThanOrEqual(8.0); // Growth cap 7.5, buffer 0.5
    }
  });

  it("Conservative → gold môže byť až 40% (GOLD_POLICY.konzervativny.hardCap)", () => {
    const baseMix: MixItem[] = normalize([
      { key: "dyn", pct: 10 },
      { key: "crypto", pct: 3 },
      { key: "etf", pct: 25 },
      { key: "gold", pct: 10 },
      { key: "bonds", pct: 20 },
      { key: "bond3y9", pct: 20 },
      { key: "cash", pct: 10 },
      { key: "real", pct: 2 },
    ]);

    const result = enforceRiskCap(baseMix, "konzervativny" as RiskPref, {
      gold: 40, // GOLD_POLICY.konzervativny.hardCap
      etf: 50,
      dyn: 22,
      crypto: 8,
    });

    console.log("[PR-34 Test] Conservative enforceRiskCap result:");
    result.mix.forEach((m) => {
      if (m.pct > 0.5) {
        console.log(`  ${m.key}: ${m.pct.toFixed(2)}%`);
      }
    });
    console.log(`  Initial risk: ${result.initialRisk.toFixed(2)}`);
    console.log(`  Final risk: ${result.finalRisk.toFixed(2)}`);

    // Conservative môže mať viac zlata (až 40%)
    const goldItem = result.mix.find((m) => m.key === "gold");
    expect(goldItem).toBeDefined();
    expect(goldItem!.pct).toBeLessThanOrEqual(40.5);

    // Risk by mal byť pod cap (ak bol nad cap, enforcement ho zníži)
    expect(result.finalRisk).toBeLessThanOrEqual(5.1); // Conservative cap 4.0, buffer 1.0
  });
});
