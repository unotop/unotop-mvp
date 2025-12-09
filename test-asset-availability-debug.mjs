/**
 * Debug assetAvailability pre 45800/200/30 rastový profil
 */

import { getAdjustedMix } from "./src/features/portfolio/mixAdjustments.ts";
import { PORTFOLIO_PRESETS } from "./src/features/portfolio/presets.ts";

const lumpSum = 45800;
const monthly = 200;
const horizonYears = 30;
const effectivePlanVolume = lumpSum + monthly * 12 * horizonYears; // 117800

console.log(`\n🔍 DEBUG: Asset Availability 45800/200/30 (volume ${effectivePlanVolume}€)`);

const dummyCashflow = {
  monthlyIncome: 3000,
  fixedExpenses: 1500,
  variableExpenses: 500,
  reserveEur: 5000,
  reserveMonths: 6,
};

const profiles = ["konzervativny", "vyvazeny", "rastovy"];
const mixesByProfile = {};

for (const riskPref of profiles) {
  const profile = {
    lumpSumEur: lumpSum,
    monthlyEur: monthly,
    horizonYears,
    goalAssetsEur: 100000,
    riskPref,
    ...dummyCashflow,
  };

  const preset = PORTFOLIO_PRESETS.find((p) => p.id === riskPref);
  const baseMix = preset ? preset.mix.map((item) => ({ ...item })) : [];

  const result = getAdjustedMix(baseMix, profile);
  mixesByProfile[riskPref] = result.mix;

  console.log(`\n🔹 ${riskPref.toUpperCase()} mix:`);
  const sorted = [...result.mix].sort((a, b) => b.pct - a.pct);
  for (const item of sorted) {
    if (item.pct > 0.01) {
      console.log(`   ${item.key.padEnd(10)} ${item.pct.toFixed(1)}%`);
    }
  }
}

// Spočítaj maxWeight pre crypto
const cryptoWeights = profiles.map((p) => {
  const item = mixesByProfile[p].find((m) => m.key === "crypto");
  return item ? item.pct : 0;
});

console.log(`\n📊 CRYPTO MAX WEIGHT:`);
console.log(`   Konzervatívny: ${cryptoWeights[0].toFixed(1)}%`);
console.log(`   Vyvážený:      ${cryptoWeights[1].toFixed(1)}%`);
console.log(`   Rastový:       ${cryptoWeights[2].toFixed(1)}%`);
console.log(`   → maxPct: ${Math.max(...cryptoWeights).toFixed(1)}%`);

if (Math.max(...cryptoWeights) > 0) {
  console.log(`\n✅ CRYPTO by malo byť ACTIVE (zelené)`);
} else {
  console.log(`\n❌ CRYPTO maxPct = 0 → AVAILABLE (sivé) BUG!`);
}
