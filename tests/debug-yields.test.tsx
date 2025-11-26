/**
 * DEBUG: Porovnanie yields pre Conservative vs Growth
 * 
 * Testuje rôzne monthly amounts (bez lump sum)
 */

import { describe, it, expect } from "vitest";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import { approxYieldAnnualFromMix } from "../src/features/mix/assetModel";

describe("DEBUG: Conservative vs Growth yields", () => {
  const scenarios = [
    { monthly: 150, label: "150 EUR/m" },
    { monthly: 300, label: "300 EUR/m" },
    { monthly: 500, label: "500 EUR/m" },
    { monthly: 800, label: "800 EUR/m" },
    { monthly: 1000, label: "1000 EUR/m" },
  ];

  for (const { monthly, label } of scenarios) {
    it(`${label}: Growth yield >= Conservative yield`, () => {
      const presetC = PORTFOLIO_PRESETS.find(p => p.id === "konzervativny")!;
      const presetG = PORTFOLIO_PRESETS.find(p => p.id === "rastovy")!;

      const profile = {
        lumpSumEur: 0,
        monthlyEur: monthly,
        horizonYears: 21,
        goalAssetsEur: 0,
        debts: [],
        riskPref: "konzervativny" as const,
        stage: "starter" as const,
        monthlyIncome: 0,
        fixedExpenses: 0,
        variableExpenses: 0,
        reserveEur: 0,
        reserveMonths: 0,
      };

      const mixC = getAdjustedMix(presetC.mix, { ...profile, riskPref: "konzervativny" });
      const mixG = getAdjustedMix(presetG.mix, { ...profile, riskPref: "rastovy" });

      const yieldC = approxYieldAnnualFromMix(mixC.mix) * 100;
      const yieldG = approxYieldAnnualFromMix(mixG.mix) * 100;

      console.log(
        `${label}: Conservative ${yieldC.toFixed(2)}% vs Growth ${yieldG.toFixed(2)}%`
      );

      // INVARIANT: Growth yield >= Conservative yield
      expect(yieldG).toBeGreaterThanOrEqual(yieldC - 0.1);
    });
  }
});
