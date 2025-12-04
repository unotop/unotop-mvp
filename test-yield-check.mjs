import { getAdjustedMix } from "./src/features/portfolio/mixAdjustments.js";
import { getDynamicDefaultMix } from "./src/features/portfolio/presets.js";
import { approxYieldAnnualFromMix } from "./src/features/metrics/metrics.service.js";
import { riskScore0to10 } from "./src/features/metrics/risk.js";

const scenario = { lumpSumEur: 4700, monthlyEur: 500, horizonYears: 20 };

["konzervativny", "vyvazeny", "rastovy"].forEach((profile) => {
  const baseMix = getDynamicDefaultMix(profile);
  const result = getAdjustedMix(baseMix, {
    ...scenario,
    riskPref: profile,
    monthlyIncome: 2500,
    fixedExpenses: 1500,
    variableExpenses: 400,
    reserveEur: 3000,
    reserveMonths: 6,
  });
  
  const gold = result.mix.find(m => m.key === "gold")?.pct ?? 0;
  const dyn = result.mix.find(m => m.key === "dyn")?.pct ?? 0;
  const yield_ = (approxYieldAnnualFromMix(result.mix) * 100).toFixed(2);
  const risk = riskScore0to10(result.mix, profile).toFixed(1);
  
  console.log(`[4700/500/20] ${profile.charAt(0).toUpperCase()}: yield=${yield_}%, risk=${risk}, gold=${gold.toFixed(1)}%, dyn=${dyn.toFixed(1)}%, warnings=${result.warnings.length}`);
});
