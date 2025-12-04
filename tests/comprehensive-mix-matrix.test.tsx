/**
 * Comprehensive Mix Testing Matrix
 *
 * Lump: 0, 2500, 10000, 100000
 * Monthly: 50, 100, 200, 500
 * Horizon: 10, 20, 30
 *
 * = 4 × 4 × 3 = 48 scenárov × 3 profily = 144 testov
 */

import { describe, it, expect } from "vitest";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";
import { approxYieldAnnualFromMix } from "../src/features/mix/assetModel";
import { riskScore0to10 } from "../src/features/mix/assetModel";
import type { RiskPref } from "../src/features/mix/assetModel";

const LUMP_SUM_VALUES = [0, 2500, 10000, 100000];
const MONTHLY_VALUES = [50, 100, 200, 500];
const HORIZON_VALUES = [10, 20, 30];

const DUMMY_CASHFLOW = {
  monthlyIncome: 3000,
  fixedExpenses: 1500,
  variableExpenses: 500,
  reserveEur: 5000,
  reserveMonths: 6,
};

describe("Mix Testing Matrix - Yield/Risk Optimization", () => {
  const results: Array<{
    scenario: string;
    profile: string;
    volume: number;
    yield: number;
    risk: number;
    topAssets: string;
  }> = [];

  LUMP_SUM_VALUES.forEach((lump) => {
    MONTHLY_VALUES.forEach((monthly) => {
      HORIZON_VALUES.forEach((horizon) => {
        const effectivePlanVolume = lump + monthly * 12 * horizon;
        const scenario = `${lump}/${monthly}/${horizon}`;

        describe(`Scenario ${scenario} (volume ${effectivePlanVolume}€)`, () => {
          const profiles: RiskPref[] = ["konzervativny", "vyvazeny", "rastovy"];

          const scenarioResults: Record<
            RiskPref,
            { yield: number; risk: number; mix: any[] }
          > = {} as any;

          profiles.forEach((profile) => {
            it(`${profile} profil`, () => {
              const profileData = {
                lumpSumEur: lump,
                monthlyEur: monthly,
                horizonYears: horizon,
                goalAssetsEur: 100000,
                riskPref: profile,
                ...DUMMY_CASHFLOW,
              };

              const preset = PORTFOLIO_PRESETS.find((p) => p.id === profile);
              const baseMix = preset
                ? preset.mix.map((item) => ({ ...item }))
                : [];

              const result = getAdjustedMix(baseMix, profileData);
              const mix = result.mix;

              const yieldPa = approxYieldAnnualFromMix(mix, profile);
              const risk = riskScore0to10(mix);

              scenarioResults[profile] = { yield: yieldPa, risk, mix };

              // Top 3 assets
              const sorted = [...mix].sort((a, b) => b.pct - a.pct);
              const top3 = sorted
                .slice(0, 3)
                .filter((a) => a.pct > 0)
                .map((a) => `${a.key} ${a.pct.toFixed(0)}%`)
                .join(", ");

              results.push({
                scenario,
                profile,
                volume: effectivePlanVolume,
                yield: yieldPa * 100,
                risk,
                topAssets: top3,
              });

              // Základné invarianty
              expect(yieldPa).toBeGreaterThan(0);
              expect(risk).toBeGreaterThanOrEqual(0);
              expect(risk).toBeLessThanOrEqual(10);

              // Suma 100%
              const sum = mix.reduce((acc, m) => acc + m.pct, 0);
              expect(Math.abs(sum - 100)).toBeLessThan(0.1);
            });
          });

          // Cross-profile comparison
          it(`${scenario} - profily sa divergujú`, () => {
            const konz = scenarioResults.konzervativny;
            const vyv = scenarioResults.vyvazeny;
            const rast = scenarioResults.rastovy;

            // Rastový má vyšší výnos ako konzervatívny (ak nie sú locked všetky assets)
            if (effectivePlanVolume >= 1000) {
              expect(rast.yield).toBeGreaterThanOrEqual(konz.yield);
            }

            // Rastový má vyššie riziko ako konzervatívny
            expect(rast.risk).toBeGreaterThanOrEqual(konz.risk - 0.5); // Tolerance 0.5

            // Log pre debugging
            if (rast.yield < konz.yield || rast.risk < konz.risk - 0.5) {
              console.warn(`⚠️ ${scenario}: Profily sa nezlišujú dostatočne!`);
              console.warn(
                `  Konzervatívny: ${(konz.yield * 100).toFixed(1)}% yield, ${konz.risk.toFixed(1)} risk`
              );
              console.warn(
                `  Rastový:       ${(rast.yield * 100).toFixed(1)}% yield, ${rast.risk.toFixed(1)} risk`
              );
            }
          });
        });
      });
    });
  });

  // Summary po všetkých testoch
  it("Summary - yield/risk ranges", () => {
    const byProfile = {
      konzervativny: results.filter((r) => r.profile === "konzervativny"),
      vyvazeny: results.filter((r) => r.profile === "vyvazeny"),
      rastovy: results.filter((r) => r.profile === "rastovy"),
    };

    console.log(
      `\n📊 COMPREHENSIVE TESTING SUMMARY (48 scenárov × 3 profily = 144 testov)\n`
    );

    Object.entries(byProfile).forEach(([profile, rows]) => {
      const yields = rows.map((r) => r.yield);
      const risks = rows.map((r) => r.risk);

      const minYield = Math.min(...yields);
      const maxYield = Math.max(...yields);
      const avgYield = yields.reduce((a, b) => a + b, 0) / yields.length;

      const minRisk = Math.min(...risks);
      const maxRisk = Math.max(...risks);
      const avgRisk = risks.reduce((a, b) => a + b, 0) / risks.length;

      console.log(`🔹 ${profile.toUpperCase()}:`);
      console.log(
        `   Výnos: ${minYield.toFixed(1)}% – ${maxYield.toFixed(1)}% (avg ${avgYield.toFixed(1)}%)`
      );
      console.log(
        `   Riziko: ${minRisk.toFixed(1)} – ${maxRisk.toFixed(1)} (avg ${avgRisk.toFixed(1)})`
      );
    });

    console.log(`\n✅ Všetky scenáre testované!`);
  });
});
