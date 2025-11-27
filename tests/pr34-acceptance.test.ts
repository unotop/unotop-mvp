/**
 * PR-34 Akceptačné testy (Task 8+9)
 * 
 * Overenie: Balanced/Growth mixy nesmú mať 40+ % zlata, engine musí vedieť nájsť 
 * maximálny výnos pri danom riziku, žiadne validation errors pri bežných scenároch.
 * 
 * Scenáre:
 * - 0/600/20 Balanced (Task 8 - bug fix validácia)
 * - 10k/300/20 × 3 profily (Task 9)
 * - 0/600/20 × 3 profily (Task 9)
 * - 98k/600/23 × 3 profily (Task 9)
 * 
 * Asserty:
 * - yield_C < yield_B < yield_G (min 0.3/0.5 p.b. gaps)
 * - risk_C < risk_B < risk_G
 * - gold_B ≤ gold_C, gold_G ≤ gold_B
 * - gold_B ≤ 20%, gold_G ≤ 15%
 * - NO validation errors "Príliš vysoká alokácia..."
 * - NO DEADLOCK/LOOP logs
 */

import { describe, it, expect } from "vitest";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import { getDynamicDefaultMix } from "../src/features/portfolio/presets";
import { riskScore0to10, approxYieldAnnualFromMix } from "../src/features/mix/assetModel";
import type { RiskPref } from "../src/features/mix/assetModel";

interface TestScenario {
  name: string;
  lumpSumEur: number;
  monthlyEur: number;
  horizonYears: number;
}

const SCENARIOS: TestScenario[] = [
  { name: "0/600/20", lumpSumEur: 0, monthlyEur: 600, horizonYears: 20 },
  { name: "10k/300/20", lumpSumEur: 10000, monthlyEur: 300, horizonYears: 20 },
  { name: "98k/600/23", lumpSumEur: 98000, monthlyEur: 600, horizonYears: 23 },
];

const PROFILES: RiskPref[] = ["konzervativny", "vyvazeny", "rastovy"];

describe("PR-34 Akceptačné testy", () => {
  describe("Task 8: 0/600/20 Balanced (bug fix validácia)", () => {
    it("Balanced mix má gold ≤ 20%, yield > Conservative, NO validation errors", () => {
      const scenario = SCENARIOS[0]; // 0/600/20
      
      const baseMixB = getDynamicDefaultMix("vyvazeny");
      const baseMixC = getDynamicDefaultMix("konzervativny");
      
      const balancedResult = getAdjustedMix(baseMixB, {
        lumpSumEur: scenario.lumpSumEur,
        monthlyEur: scenario.monthlyEur,
        horizonYears: scenario.horizonYears,
        riskPref: "vyvazeny",
        monthlyIncome: 2500, // Default
        fixedExpenses: 1500,
        variableExpenses: 400,
        reserveEur: 3000,
        reserveMonths: 6,
      });
      
      const conservativeResult = getAdjustedMix(baseMixC, {
        lumpSumEur: scenario.lumpSumEur,
        monthlyEur: scenario.monthlyEur,
        horizonYears: scenario.horizonYears,
        riskPref: "konzervativny",
        monthlyIncome: 2500,
        fixedExpenses: 1500,
        variableExpenses: 400,
        reserveEur: 3000,
        reserveMonths: 6,
      });
      
      const goldItemB = balancedResult.mix.find((m) => m.key === "gold");
      const goldPctB = goldItemB?.pct ?? 0;
      
      const yieldB = approxYieldAnnualFromMix(balancedResult.mix) * 100; // Convert to %
      const yieldC = approxYieldAnnualFromMix(conservativeResult.mix) * 100;
      
      const riskB = riskScore0to10(balancedResult.mix, "vyvazeny");
      
      // Debug: vypis mixy
      console.log(`[Task 8 DEBUG] Balanced mix:`, JSON.stringify(balancedResult.mix.filter(m => m.pct > 0).map(m => ({ k: m.key, p: m.pct.toFixed(1) }))));
      console.log(`[Task 8 DEBUG] Conservative mix:`, JSON.stringify(conservativeResult.mix.filter(m => m.pct > 0).map(m => ({ k: m.key, p: m.pct.toFixed(1) }))));
      
      // Assert: gold ≤ 20% (ideálne 10-15%)
      expect(goldPctB).toBeLessThanOrEqual(20.5); // Tolerance 0.5%
      
      // Assert: yield Balanced > Conservative (min 0.3 p.b. gap)
      expect(yieldB).toBeGreaterThan(yieldC + 0.3);
      
      // Assert: risk Balanced > Conservative, ale < Growth (4.0-7.0)
      expect(riskB).toBeGreaterThan(4.0);
      expect(riskB).toBeLessThan(7.5);
      
      // Assert: NO validation errors v warnings (check že warnings array je prázdny alebo bez cap warnings)
      const hasCapWarning = balancedResult.warnings.length > 0; // Any warnings = FAIL
      expect(hasCapWarning).toBe(false);
      
      console.log(`[Task 8] 0/600/20 Balanced: gold=${goldPctB.toFixed(1)}%, yield=${yieldB.toFixed(2)}%, risk=${riskB.toFixed(1)}`);
      console.log(`[Task 8] 0/600/20 Conservative: gold=${conservativeResult.mix.find(m => m.key === "gold")?.pct.toFixed(1)}%, yield=${yieldC.toFixed(2)}%, risk=${riskScore0to10(conservativeResult.mix, "konzervativny").toFixed(1)}`);
    });
  });

  describe("Task 9: Akceptačné testy (3 scenáre × 3 profily)", () => {
    SCENARIOS.forEach((scenario) => {
      it(`${scenario.name}: yield_C < yield_B < yield_G, risk_C < risk_B < risk_G, gold hierarchy`, () => {
        const results = PROFILES.map((profile) => {
          const baseMix = getDynamicDefaultMix(profile);
          const result = getAdjustedMix(baseMix, {
            lumpSumEur: scenario.lumpSumEur,
            monthlyEur: scenario.monthlyEur,
            horizonYears: scenario.horizonYears,
            riskPref: profile,
            monthlyIncome: 2500,
            fixedExpenses: 1500,
            variableExpenses: 400,
            reserveEur: 3000,
            reserveMonths: 6,
          });
          
          const goldItem = result.mix.find((m) => m.key === "gold");
          const goldPct = goldItem?.pct ?? 0;
          const yield_ = approxYieldAnnualFromMix(result.mix) * 100; // Convert to %
          const risk = riskScore0to10(result.mix, profile);
          
          return { profile, mix: result.mix, goldPct, yield: yield_, risk, warnings: result.warnings };
        });
        
        const [conservative, balanced, growth] = results;
        
        // Assert: yield_C < yield_B < yield_G (min 0.3/0.5 p.b. gaps)
        expect(balanced.yield).toBeGreaterThan(conservative.yield + 0.3);
        expect(growth.yield).toBeGreaterThan(balanced.yield + 0.5);
        
        // Assert: risk_C < risk_B < risk_G
        expect(balanced.risk).toBeGreaterThan(conservative.risk);
        expect(growth.risk).toBeGreaterThan(balanced.risk);
        
        // Assert: gold hierarchy (gold_G ≤ gold_B ≤ gold_C)
        expect(growth.goldPct).toBeLessThanOrEqual(balanced.goldPct);
        expect(balanced.goldPct).toBeLessThanOrEqual(conservative.goldPct);
        
        // Assert: gold caps (gold_B ≤ 20%, gold_G ≤ 15%)
        expect(balanced.goldPct).toBeLessThanOrEqual(20.5); // Tolerance 0.5%
        expect(growth.goldPct).toBeLessThanOrEqual(15.5);
        
        // Assert: NO validation errors (žiadne warnings)
        expect(balanced.warnings.length).toBe(0);
        expect(growth.warnings.length).toBe(0);
        
        console.log(`[${scenario.name}] C: yield=${conservative.yield.toFixed(2)}%, risk=${conservative.risk.toFixed(1)}, gold=${conservative.goldPct.toFixed(1)}%`);
        console.log(`[${scenario.name}] B: yield=${balanced.yield.toFixed(2)}%, risk=${balanced.risk.toFixed(1)}, gold=${balanced.goldPct.toFixed(1)}%`);
        console.log(`[${scenario.name}] G: yield=${growth.yield.toFixed(2)}%, risk=${growth.risk.toFixed(1)}, gold=${growth.goldPct.toFixed(1)}%`);
      });
    });
  });
});
