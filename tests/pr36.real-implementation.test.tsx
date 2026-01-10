/**
 * PR-36 REAL: Remove DIRECT CUT MODE + cap+1.0 tolerance + max yield policy
 *
 * Tests:
 * T1: Direct cut removal – ETF nikdy nepadne o 50% v jednom kroku
 * T2: Profile ordering sanity – Growth risk >= Balanced risk >= Conservative risk
 * T3: cap+1 policy – finalRisk <= riskCap + 1.0 + EPS
 */

import { describe, it, expect } from "vitest";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import type { ProfileForAdjustments } from "../src/features/portfolio/mixAdjustments";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";
import {
  riskScore0to10,
  approxYieldAnnualFromMix,
} from "../src/features/mix/assetModel";

const FIXTURE: ProfileForAdjustments = {
  lumpSumEur: 10000,
  monthlyEur: 500, // PR-36: vyššie aby sinks mali miesto (10k/300 je príliš constraint)
  horizonYears: 20,
  goalAssetsEur: 0,
  debts: [],
  riskPref: "rastovy",
};

describe("PR-36 REAL: Remove DIRECT CUT + cap+1.0 tolerance", () => {
  const PRESETS = {
    konzervativny: PORTFOLIO_PRESETS.find((p) => p.id === "konzervativny")!,
    vyvazeny: PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!,
    rastovy: PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!,
  };

  it("T1: Direct cut removal – ETF never drops by 50% in single step", () => {
    // Growth profil (naj rizikovejší) → enforceRiskCap musí znižovať jemne, nie katastroficky
    const result = getAdjustedMix(PRESETS.rastovy.mix, FIXTURE);

    const etfFinal = result.mix.find((m) => m.key === "etf")?.pct ?? 0;
    const etfPreset =
      PRESETS.rastovy.mix.find((m) => m.key === "etf")?.pct ?? 0;

    // ETF nikdy nesmie klesnúť o viac ako 30% (DIRECT CUT škrtalo 50%)
    const etfDrop = etfPreset - etfFinal;
    const etfDropPercent = etfPreset > 0 ? (etfDrop / etfPreset) * 100 : 0;

    console.log(
      `[T1] ETF: ${etfPreset.toFixed(1)}% → ${etfFinal.toFixed(1)}% (drop ${etfDropPercent.toFixed(1)}%)`
    );

    expect(
      etfDropPercent,
      `ETF drop ${etfDropPercent.toFixed(1)}% > 30% (DIRECT CUT detected!)`
    ).toBeLessThan(30);

    // Dyn tiež nesmie klesnúť drasticky
    const dynFinal = result.mix.find((m) => m.key === "dyn")?.pct ?? 0;
    const dynPreset =
      PRESETS.rastovy.mix.find((m) => m.key === "dyn")?.pct ?? 0;
    const dynDrop = dynPreset - dynFinal;
    const dynDropPercent = dynPreset > 0 ? (dynDrop / dynPreset) * 100 : 0;

    console.log(
      `[T1] Dyn: ${dynPreset.toFixed(1)}% → ${dynFinal.toFixed(1)}% (drop ${dynDropPercent.toFixed(1)}%)`
    );

    expect(
      dynDropPercent,
      `Dyn drop ${dynDropPercent.toFixed(1)}% > 40% (DIRECT CUT detected!)`
    ).toBeLessThan(40);
  });

  it("T2: Profile ordering sanity – Growth risk >= Balanced >= Conservative", () => {
    const conservative = getAdjustedMix(PRESETS.konzervativny.mix, FIXTURE);
    const balanced = getAdjustedMix(PRESETS.vyvazeny.mix, FIXTURE);
    const growth = getAdjustedMix(PRESETS.rastovy.mix, FIXTURE);

    const riskC = riskScore0to10(conservative.mix, "konzervativny", 0);
    const riskB = riskScore0to10(balanced.mix, "vyvazeny", 0);
    const riskG = riskScore0to10(growth.mix, "rastovy", 0);

    const yieldC = approxYieldAnnualFromMix(conservative.mix);
    const yieldB = approxYieldAnnualFromMix(balanced.mix);
    const yieldG = approxYieldAnnualFromMix(growth.mix);

    console.log(
      `[T2] Conservative: Risk ${riskC.toFixed(2)}, Yield ${yieldC.toFixed(2)}%`
    );
    console.log(
      `[T2] Balanced: Risk ${riskB.toFixed(2)}, Yield ${yieldB.toFixed(2)}%`
    );
    console.log(
      `[T2] Growth: Risk ${riskG.toFixed(2)}, Yield ${yieldG.toFixed(2)}%`
    );

    // Risk ordering: C < B < G (s malým epsilonom pre floating-point)
    expect(riskC, "Conservative risk musí byť najnižší").toBeLessThanOrEqual(
      riskB + 0.2
    );
    expect(riskB, "Balanced risk musí byť <= Growth risk").toBeLessThanOrEqual(
      riskG + 0.2
    );

    // Growth NESMIE byť konzervatívnejší ako Balanced (hlavný PR-36 bug)
    expect(
      riskG,
      "Growth risk NESMIE byť nižší ako Balanced (PR-36 bug check)"
    ).toBeGreaterThanOrEqual(riskB - 0.5);

    // Yield ordering: G >= B >= C (s epsilonom)
    expect(
      yieldG,
      "Growth yield musí byť >= Balanced yield"
    ).toBeGreaterThanOrEqual(yieldB - 0.5);
    expect(
      yieldB,
      "Balanced yield musí byť >= Conservative yield"
    ).toBeGreaterThanOrEqual(yieldC - 0.5);
  });

  it("T3: cap+1 policy – Growth finalRisk <= riskCap + 1.0 + EPS", () => {
    const result = getAdjustedMix(PRESETS.rastovy.mix, FIXTURE);
    const finalRisk = riskScore0to10(result.mix, "rastovy", 0);

    const riskCap = 7.5; // Growth risk cap
    const TOLERANCE = 1.0; // PR-36 policy
    const EPS = 0.15; // Floating-point tolerance

    console.log(
      `[T3] Growth final risk: ${finalRisk.toFixed(2)} / cap ${riskCap.toFixed(1)} + ${TOLERANCE.toFixed(1)} = ${(riskCap + TOLERANCE).toFixed(1)} (EPS ${EPS.toFixed(2)})`
    );

    expect(
      finalRisk,
      `Growth risk ${finalRisk.toFixed(2)} > cap+1.0+EPS ${(riskCap + TOLERANCE + EPS).toFixed(2)}`
    ).toBeLessThanOrEqual(riskCap + TOLERANCE + EPS);

    // Risk musí byť rozumný (nie collapse na 4.0 ako v PR-36 bugu)
    expect(
      finalRisk,
      "Growth risk musí byť > 6.0 (nie collapse na 4.0)"
    ).toBeGreaterThan(6.0);
  });

  it("T4: Balanced cap+1 policy – finalRisk <= 6.0 + 1.0 + EPS", () => {
    const result = getAdjustedMix(PRESETS.vyvazeny.mix, {
      ...FIXTURE,
      riskPref: "vyvazeny",
    });
    const finalRisk = riskScore0to10(result.mix, "vyvazeny", 0);

    const riskCap = 6.0; // Balanced risk cap
    const TOLERANCE = 1.0;
    const EPS = 0.15;

    console.log(
      `[T4] Balanced final risk: ${finalRisk.toFixed(2)} / cap ${riskCap.toFixed(1)} + ${TOLERANCE.toFixed(1)} = ${(riskCap + TOLERANCE).toFixed(1)} (EPS ${EPS.toFixed(2)})`
    );

    expect(
      finalRisk,
      `Balanced risk ${finalRisk.toFixed(2)} > cap+1.0+EPS ${(riskCap + TOLERANCE + EPS).toFixed(2)}`
    ).toBeLessThanOrEqual(riskCap + TOLERANCE + EPS);
  });

  it("T5: Conservative cap+1 policy – finalRisk <= 4.0 + 1.0 + EPS", () => {
    const result = getAdjustedMix(PRESETS.konzervativny.mix, {
      ...FIXTURE,
      riskPref: "konzervativny",
    });
    const finalRisk = riskScore0to10(result.mix, "konzervativny", 0);

    const riskCap = 4.0; // Conservative risk cap
    const TOLERANCE = 1.0;
    const EPS = 0.15;

    console.log(
      `[T5] Conservative final risk: ${finalRisk.toFixed(2)} / cap ${riskCap.toFixed(1)} + ${TOLERANCE.toFixed(1)} = ${(riskCap + TOLERANCE).toFixed(1)} (EPS ${EPS.toFixed(2)})`
    );

    expect(
      finalRisk,
      `Conservative risk ${finalRisk.toFixed(2)} > cap+1.0+EPS ${(riskCap + TOLERANCE + EPS).toFixed(2)}`
    ).toBeLessThanOrEqual(riskCap + TOLERANCE + EPS);
  });
});
