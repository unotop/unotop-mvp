/**
 * TEST: Profile Divergence @ 0/50/30
 *
 * Problém: Všetky 3 profily (konzervativny, vyvazeny, rastovy) dávajú rovnaký output
 * Očakávanie: Rastový mal by mať výrazne vyšší výnos a riziko ako konzervatívny
 */

import { describe, it, expect } from "vitest";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import {
  riskScore0to10,
  approxYieldAnnualFromMix,
} from "../src/features/mix/assetModel";

describe("Profile Divergence @ 0/50/30", () => {
  const scenario = {
    lumpSumEur: 0,
    monthlyEur: 50,
    horizonYears: 30,
    goalAssetsEur: 100_000,
    monthlyIncome: 3000,
    fixedExpenses: 1500,
    variableExpenses: 500,
    reserveEur: 5000,
    reserveMonths: 6,
  };

  it("Konzervatívny profil má base mix gold 20%, ETF 20%, dyn 5%", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "konzervativny");
    expect(preset).toBeDefined();

    const goldItem = preset!.mix.find((m) => m.key === "gold");
    const etfItem = preset!.mix.find((m) => m.key === "etf");
    const dynItem = preset!.mix.find((m) => m.key === "dyn");

    expect(goldItem?.pct).toBe(20);
    expect(etfItem?.pct).toBe(20);
    expect(dynItem?.pct).toBe(5);
  });

  it("Rastový profil má base mix gold 10%, ETF 52%, dyn 16%, crypto 6%", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy");
    expect(preset).toBeDefined();

    const goldItem = preset!.mix.find((m) => m.key === "gold");
    const etfItem = preset!.mix.find((m) => m.key === "etf");
    const dynItem = preset!.mix.find((m) => m.key === "dyn");
    const cryptoItem = preset!.mix.find((m) => m.key === "crypto");

    expect(goldItem?.pct).toBe(10);
    expect(etfItem?.pct).toBe(52);
    expect(dynItem?.pct).toBe(16);
    expect(cryptoItem?.pct).toBe(6);
  });

  it("getAdjustedMix pre konzervatívny profil", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "konzervativny")!;
    const baseMix = preset.mix.map((item) => ({ ...item }));
    const profile = { ...scenario, riskPref: "konzervativny" as const };

    const result = getAdjustedMix(baseMix, profile);

    console.log("\n🔹 KONZERVATÍVNY adjusted mix:");
    result.mix
      .filter((m) => m.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .forEach((m) =>
        console.log(`   ${m.key.padEnd(10)} ${m.pct.toFixed(1)}%`)
      );

    const sum = result.mix.reduce((s, m) => s + m.pct, 0);
    const risk = riskScore0to10(result.mix, "konzervativny");
    const yieldPa = approxYieldAnnualFromMix(result.mix, "konzervativny");

    console.log(`   SUMA: ${sum.toFixed(2)}%`);
    console.log(`   RIZIKO: ${risk.toFixed(1)}`);
    console.log(`   VÝNOS: ${(yieldPa * 100).toFixed(1)}% p.a.`); // FIX: yieldPa je desatinné číslo

    expect(sum).toBeCloseTo(100, 0);
  });

  it("getAdjustedMix pre vyvážený profil", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
    const baseMix = preset.mix.map((item) => ({ ...item }));
    const profile = { ...scenario, riskPref: "vyvazeny" as const };

    const result = getAdjustedMix(baseMix, profile);

    console.log("\n🔹 VYVÁŽENÝ adjusted mix:");
    result.mix
      .filter((m) => m.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .forEach((m) =>
        console.log(`   ${m.key.padEnd(10)} ${m.pct.toFixed(1)}%`)
      );

    const sum = result.mix.reduce((s, m) => s + m.pct, 0);
    const risk = riskScore0to10(result.mix, "vyvazeny");
    const yieldPa = approxYieldAnnualFromMix(result.mix, "vyvazeny");

    console.log(`   SUMA: ${sum.toFixed(2)}%`);
    console.log(`   RIZIKO: ${risk.toFixed(1)}`);
    console.log(`   VÝNOS: ${(yieldPa * 100).toFixed(1)}% p.a.`); // FIX: yieldPa je desatinné číslo

    expect(sum).toBeCloseTo(100, 0);
  });

  it("getAdjustedMix pre rastový profil", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;
    const baseMix = preset.mix.map((item) => ({ ...item }));
    const profile = { ...scenario, riskPref: "rastovy" as const };

    const result = getAdjustedMix(baseMix, profile);

    console.log("\n🔹 RASTOVÝ adjusted mix:");
    result.mix
      .filter((m) => m.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .forEach((m) =>
        console.log(`   ${m.key.padEnd(10)} ${m.pct.toFixed(1)}%`)
      );

    const sum = result.mix.reduce((s, m) => s + m.pct, 0);
    const risk = riskScore0to10(result.mix, "rastovy");
    const yieldPa = approxYieldAnnualFromMix(result.mix, "rastovy");

    console.log(`   SUMA: ${sum.toFixed(2)}%`);
    console.log(`   RIZIKO: ${risk.toFixed(1)}`);
    console.log(`   VÝNOS: ${(yieldPa * 100).toFixed(1)}% p.a.`); // FIX: yieldPa je desatinné číslo

    expect(sum).toBeCloseTo(100, 0);
  });

  it("Rastový profil má VYŠŠÍ výnos ako konzervatívny", () => {
    const konz = PORTFOLIO_PRESETS.find((p) => p.id === "konzervativny")!;
    const rast = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;

    const konzMix = getAdjustedMix(
      konz.mix.map((m) => ({ ...m })),
      { ...scenario, riskPref: "konzervativny" as const }
    ).mix;

    const rastMix = getAdjustedMix(
      rast.mix.map((m) => ({ ...m })),
      { ...scenario, riskPref: "rastovy" as const }
    ).mix;

    const konzYield = approxYieldAnnualFromMix(konzMix, "konzervativny");
    const rastYield = approxYieldAnnualFromMix(rastMix, "rastovy");

    console.log(`\n📊 POROVNANIE VÝNOSOV:`);
    console.log(`   Konzervatívny: ${(konzYield * 100).toFixed(1)}% p.a.`);
    console.log(`   Rastový:       ${(rastYield * 100).toFixed(1)}% p.a.`);
    console.log(
      `   Delta:         ${((rastYield - konzYield) * 100).toFixed(1)} p.b.`
    );

    // Rastový MUST have vyšší výnos (min +1.5% = 0.015 desatinne)
    expect(rastYield).toBeGreaterThan(konzYield + 0.015);
  });

  it("Rastový profil má VYŠŠÍ riziko ako konzervatívny", () => {
    const konz = PORTFOLIO_PRESETS.find((p) => p.id === "konzervativny")!;
    const rast = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;

    const konzMix = getAdjustedMix(
      konz.mix.map((m) => ({ ...m })),
      { ...scenario, riskPref: "konzervativny" as const }
    ).mix;

    const rastMix = getAdjustedMix(
      rast.mix.map((m) => ({ ...m })),
      { ...scenario, riskPref: "rastovy" as const }
    ).mix;

    const konzRisk = riskScore0to10(konzMix, "konzervativny");
    const rastRisk = riskScore0to10(rastMix, "rastovy");

    console.log(`\n📊 POROVNANIE RIZIKA:`);
    console.log(`   Konzervatívny: ${konzRisk.toFixed(1)}`);
    console.log(`   Rastový:       ${rastRisk.toFixed(1)}`);
    console.log(`   Delta:         ${(rastRisk - konzRisk).toFixed(1)} p.b.`);

    // Rastový MUST have vyššie riziko (min +1.0)
    expect(rastRisk).toBeGreaterThan(konzRisk + 1.0);
  });
});
