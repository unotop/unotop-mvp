/**
 * TEST: Profile Divergence at 0/50/30
 * 
 * Scenár: lumpSum 0, monthly 50, horizon 30
 * Očakávanie: Konzervatívny/Vyvážený/Rastový by mali mať ROZDIELNE mixy a výnosy
 * 
 * Problém: Všetky 3 profily dávajú 8.0-8.6% výnos (skorumpované)
 */

import { PORTFOLIO_PRESETS } from "./src/features/portfolio/presets.js";
import { getAdjustedMix } from "./src/features/portfolio/mixAdjustments.js";

const scenario = {
  lumpSumEur: 0,
  monthlyEur: 50,
  horizonYears: 30,
  goalAssetsEur: 100_000,
  // Dummy cashflow
  monthlyIncome: 3000,
  fixedExpenses: 1500,
  variableExpenses: 500,
  reserveEur: 5000,
  reserveMonths: 6,
};

const profiles = ["konzervativny", "vyvazeny", "rastovy"];

console.log("=".repeat(80));
console.log("TEST: Profile Divergence @ 0 / 50 / 30");
console.log("=".repeat(80));

for (const riskPref of profiles) {
  const preset = PORTFOLIO_PRESETS.find((p) => p.id === riskPref);
  if (!preset) {
    console.error(`❌ Preset not found: ${riskPref}`);
    continue;
  }

  const baseMix = preset.mix.map((item) => ({ ...item }));
  const profile = { ...scenario, riskPref };

  console.log(`\n${"─".repeat(80)}`);
  console.log(`📊 ${preset.label.toUpperCase()} (${riskPref})`);
  console.log(`${"─".repeat(80)}`);

  console.log("\n🔹 Base mix (preset):");
  baseMix
    .filter((item) => item.pct > 0)
    .forEach((item) => {
      console.log(`   ${item.key.padEnd(10)} ${item.pct.toFixed(1).padStart(5)}%`);
    });

  const result = getAdjustedMix(baseMix, profile);

  console.log("\n🔹 Adjusted mix (after getAdjustedMix):");
  result.mix
    .filter((item) => item.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .forEach((item) => {
      console.log(`   ${item.key.padEnd(10)} ${item.pct.toFixed(1).padStart(5)}%`);
    });

  const sum = result.mix.reduce((s, m) => s + m.pct, 0);
  console.log(`\n   SUMA: ${sum.toFixed(2)}%`);

  console.log("\n🔹 Warnings:");
  if (result.warnings.length === 0) {
    console.log("   (none)");
  } else {
    result.warnings.forEach((w) => console.log(`   - ${w}`));
  }

  console.log("\n🔹 Info:");
  console.log(`   effectivePlanVolume: ${result.info.assetMinima?.effectivePlanVolume || "N/A"} €`);
  console.log(`   riskCapEnforcement: ${JSON.stringify(result.info.riskCapEnforcement || {}, null, 2)}`);

  // Vypočítaj yield (placeholder - potrebujeme approxYieldAnnualFromMix)
  // console.log(`\n🔹 Yield: ${approxYieldAnnualFromMix(result.mix, riskPref).toFixed(1)}% p.a.`);
}

console.log("\n" + "=".repeat(80));
console.log("KONIEC TESTU");
console.log("=".repeat(80));
