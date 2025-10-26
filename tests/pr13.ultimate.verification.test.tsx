/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import {
  getAdjustedPreset,
  type ProfileForAdjustments,
} from "../src/features/portfolio/mixAdjustments";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";
import { riskScore0to10 } from "../src/features/mix/assetModel";
import { getAdaptiveRiskCap } from "../src/features/policy/risk";
import { detectStage } from "../src/features/policy/stage";

describe("PR-13 ULTIMATE HYBRID+ Verification", () => {
  const profile: ProfileForAdjustments = {
    lumpSumEur: 1000,
    monthlyEur: 450,
    horizonYears: 40,
    monthlyIncome: 2500,
    fixedExpenses: 800,
    variableExpenses: 500,
    reserveEur: 3000,
    reserveMonths: 6,
    goalAssetsEur: 1000000, // FIXED: 1M cieľ → stage STARTER (coverage ~22%)
    riskPref: "konzervativny",
  };

  const stage = detectStage(
    profile.lumpSumEur,
    profile.monthlyEur,
    profile.horizonYears,
    profile.goalAssetsEur
  );

  // Target bands (z mixAdjustments.ts)
  const TARGET_BANDS = {
    konzervativny: { min: 0.9, max: 1.0 },
    vyvazeny: { min: 0.95, max: 1.0 },
    rastovy: { min: 0.98, max: 1.0 },
  } as const;

  it("Konzervatívny profil: risk ~4.4 (target 4.05-4.5)", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "konzervativny")!;
    const profileCopy = { ...profile, riskPref: "konzervativny" as const };

    const { preset: adjusted } = getAdjustedPreset(preset, profileCopy);
    const risk = riskScore0to10(adjusted.mix, "konzervativny");
    const cap = getAdaptiveRiskCap("konzervativny", stage);
    const targetMin = cap * TARGET_BANDS.konzervativny.min;
    const targetMax = cap * TARGET_BANDS.konzervativny.max;

    console.log(
      `\n📊 KONZERVATÍVNY (lump=${profile.lumpSumEur}, monthly=${profile.monthlyEur}, stage=${stage})`
    );
    console.log(
      `   Risk: ${risk.toFixed(2)} (target: ${targetMin.toFixed(2)}-${targetMax.toFixed(2)})`
    );
    console.log(
      `   Mix: ${adjusted.mix.map((m) => `${m.key}:${m.pct.toFixed(1)}%`).join(", ")}`
    );

    // Akceptujeme ±0.5 toleranciu (UP-TUNE/DOWN-TUNE kroky 0.5pb)
    expect(risk).toBeGreaterThanOrEqual(targetMin - 0.5);
    expect(risk).toBeLessThanOrEqual(targetMax + 0.5);
  });

  it("Vyvážený profil: risk ~6.5 (UP-TUNE aktivovaný)", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
    const profileCopy = { ...profile, riskPref: "vyvazeny" as const };

    const { preset: adjusted } = getAdjustedPreset(preset, profileCopy);
    const risk = riskScore0to10(adjusted.mix, "vyvazeny");
    const cap = getAdaptiveRiskCap("vyvazeny", stage);
    const targetMin = cap * TARGET_BANDS.vyvazeny.min;
    const targetMax = cap * TARGET_BANDS.vyvazeny.max;

    console.log(
      `\n📊 VYVÁŽENÝ (lump=${profile.lumpSumEur}, monthly=${profile.monthlyEur}, stage=${stage})`
    );
    console.log(
      `   Risk: ${risk.toFixed(2)} (target: ${targetMin.toFixed(2)}-${targetMax.toFixed(2)})`
    );
    console.log(
      `   Mix: ${adjusted.mix.map((m) => `${m.key}:${m.pct.toFixed(1)}%`).join(", ")}`
    );

    // UP-TUNE by mal zdvihnúť risk k hornej hranici (±0.5pb tolerancia)
    expect(risk).toBeGreaterThanOrEqual(targetMin - 0.5);
    expect(risk).toBeLessThanOrEqual(targetMax + 0.5);
  });

  it("Rastový profil: risk ~8.0 (UP-TUNE maximálny)", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;
    const profileCopy = { ...profile, riskPref: "rastovy" as const };

    const { preset: adjusted } = getAdjustedPreset(preset, profileCopy);
    const risk = riskScore0to10(adjusted.mix, "rastovy");
    const cap = getAdaptiveRiskCap("rastovy", stage);
    const targetMin = cap * TARGET_BANDS.rastovy.min;
    const targetMax = cap * TARGET_BANDS.rastovy.max;

    console.log(
      `\n📊 RASTOVÝ (lump=${profile.lumpSumEur}, monthly=${profile.monthlyEur}, stage=${stage})`
    );
    console.log(
      `   Risk: ${risk.toFixed(2)} (target: ${targetMin.toFixed(2)}-${targetMax.toFixed(2)})`
    );
    console.log(
      `   Mix: ${adjusted.mix.map((m) => `${m.key}:${m.pct.toFixed(1)}%`).join(", ")}`
    );

    // Rastový by mal byť NAJ-vyšší (UP-TUNE maximálne, ±0.5pb)
    expect(risk).toBeGreaterThanOrEqual(targetMin - 0.5);
    expect(risk).toBeLessThanOrEqual(targetMax + 0.5);
  });

  it("Diferenciácia: rastový > vyvážený > konzervatívny (ULTIMATE HYBRID+ overenie)", () => {
    const konz = PORTFOLIO_PRESETS.find((p) => p.id === "konzervativny")!;
    const vyv = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
    const rast = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;

    const konzRisk = riskScore0to10(
      getAdjustedPreset(konz, { ...profile, riskPref: "konzervativny" }).preset
        .mix,
      "konzervativny"
    );
    const vyvRisk = riskScore0to10(
      getAdjustedPreset(vyv, { ...profile, riskPref: "vyvazeny" }).preset.mix,
      "vyvazeny"
    );
    const rastRisk = riskScore0to10(
      getAdjustedPreset(rast, { ...profile, riskPref: "rastovy" }).preset.mix,
      "rastovy"
    );

    console.log(`\n🎯 DIFERENCIÁCIA TEST:`);
    console.log(`   Konzervatívny: ${konzRisk.toFixed(2)}`);
    console.log(
      `   Vyvážený: ${vyvRisk.toFixed(2)} (rozdiel: +${(vyvRisk - konzRisk).toFixed(2)})`
    );
    console.log(
      `   Rastový: ${rastRisk.toFixed(2)} (rozdiel: +${(rastRisk - konzRisk).toFixed(2)})`
    );

    // Klúčový test: portfoliá MUSIA byť jasne odlíšené (PRED: všetky ~4.6, PO: rôzne)
    expect(vyvRisk).toBeGreaterThan(konzRisk + 1.0); // Min 1.0 point rozdiel
    expect(rastRisk).toBeGreaterThan(vyvRisk + 0.8); // Min 0.8 point rozdiel
    expect(rastRisk).toBeGreaterThan(konzRisk + 2.5); // Min 2.5 point celkový rozdiel
  });
});
