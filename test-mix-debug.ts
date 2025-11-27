/**
 * Debug mix composition - Pozrieť čo enforceRiskCap robí s mixom
 */
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";
import { approxYieldAnnualFromMix, riskScore0to10, type RiskPref } from "../src/features/mix/assetModel";

const preset = PORTFOLIO_PRESETS.find(p => p.id === "vyvazeny")!;
const baseMix = preset.mix.map(m => ({ ...m }));

console.log("\n=== BALANCED 2600/300/30 DEBUG ===\n");
console.log("BASE MIX:");
baseMix.forEach(m => {
  if (m.pct > 0) console.log(`  ${m.key}: ${m.pct.toFixed(1)}%`);
});

const result = getAdjustedMix(baseMix, {
  riskPref: "vyvazeny" as RiskPref,
  lumpSumEur: 2600,
  monthlyEur: 300,
  horizonYears: 30,
  monthlyIncome: 3000,
  fixedExpenses: 1000,
  variableExpenses: 500,
  reserveEur: 0,
  reserveMonths: 0,
});

console.log("\nFINAL MIX:");
result.mix.forEach(m => {
  if (m.pct > 0.1) console.log(`  ${m.key}: ${m.pct.toFixed(1)}%`);
});

const yield_pct = approxYieldAnnualFromMix(result.mix, "vyvazeny") * 100;
const risk = riskScore0to10(result.mix, "vyvazeny", 0);

console.log(`\nYield: ${yield_pct.toFixed(1)}% | Risk: ${risk.toFixed(1)}`);
console.log("\n");
