/**
 * Test skript pre overenie ULTIMATE HYBRID+ výstupov
 * 
 * Testovací scenár:
 * - lumpSumEur = 1000
 * - monthlyEur = 450
 * - horizonYears = 40
 * - monthlyIncome = 2500 (pre cash reserve override, nerelevantné pre mix)
 * - Stage = STARTER (horizont 40y, lump+12*monthly < 10k)
 * 
 * Očakávané výsledky (PR-13 ULTIMATE):
 * - Konzervatívny: risk ~4.4 (target 4.05-4.5)
 * - Vyvážený: risk ~6.3 (target 6.17-6.5)
 * - Rastový: risk ~7.9 (target 7.84-8.0)
 */

import { getAdjustedPreset, type ProfileForAdjustments } from "../src/features/portfolio/mixAdjustments.js";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets.js";
import { riskScore0to10 } from "../src/features/mix/assetModel.js";
import { getAdaptiveRiskCap } from "../src/features/policy/risk.js";
import { detectStage } from "../src/features/policy/stage.js";

// Test profile
const profile: ProfileForAdjustments = {
  lumpSumEur: 1000,
  monthlyEur: 450,
  horizonYears: 40,
  monthlyIncome: 2500,
  fixedExpenses: 800,
  variableExpenses: 500,
  reserveEur: 3000,
  reserveMonths: 6,
  goalAssetsEur: 100000,
  riskPref: "konzervativny", // Bude sa meniť
};

// Stage detection
const stage = detectStage(profile.lumpSumEur, profile.monthlyEur, profile.horizonYears, profile.goalAssetsEur);
console.log(`\n🎯 ULTIMATE HYBRID+ Test (lump=${profile.lumpSumEur}, monthly=${profile.monthlyEur}, horizon=${profile.horizonYears}y)`);
console.log(`📊 Stage: ${stage}`);
console.log(`═══════════════════════════════════════════════════════\n`);

// Test každý profil
for (const preset of PORTFOLIO_PRESETS) {
  const profileCopy = { ...profile, riskPref: preset.id };
  
  const { preset: adjusted, warnings } = getAdjustedPreset(preset, profileCopy);
  const risk = riskScore0to10(adjusted.mix, preset.id);
  const cap = getAdaptiveRiskCap(preset.id, stage);
  
  // Vypočítaj target pásmo (z mixAdjustments konštánt)
  const TARGET_BANDS = {
    konzervativny: { min: 0.90, max: 1.00 },
    vyvazeny: { min: 0.95, max: 1.00 },
    rastovy: { min: 0.98, max: 1.00 },
  };
  
  const band = TARGET_BANDS[preset.id as keyof typeof TARGET_BANDS];
  const targetMin = cap * band.min;
  const targetMax = cap * band.max;
  
  // Status emoji
  const inBand = risk >= targetMin && risk <= targetMax;
  const status = inBand ? "✅" : risk < targetMin ? "⚠️ POD" : "⚠️ NAD";
  
  console.log(`${status} ${preset.label.toUpperCase()}`);
  console.log(`   Risk: ${risk.toFixed(2)} (target: ${targetMin.toFixed(2)}-${targetMax.toFixed(2)}, cap: ${cap.toFixed(2)})`);
  console.log(`   Mix: ${adjusted.mix.map(m => `${m.key}:${m.pct.toFixed(1)}%`).join(", ")}`);
  if (warnings.length > 0) {
    console.log(`   Warnings: ${warnings.join(", ")}`);
  }
  console.log("");
}

console.log(`═══════════════════════════════════════════════════════`);
console.log(`✅ = v cieľovom pásme | ⚠️ = mimo pásma\n`);
