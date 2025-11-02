/**
 * PR-6: useProjection — Centralizovaný hook pre projekciu
 * 
 * Jednotná reaktivita:
 * - Deps: lumpSum, monthly, horizon, goal, mix, debts
 * - Returns: fvSeries, debtSeries, crossoverIndex, yield, risk, goalProgress
 * - Žiadny snapshot, priama reaktivita na vstupy
 * 
 * Eliminuje:
 * - Duálnu pravdu výnosu (scenár vs. mix)
 * - Ad-hoc projectionRefresh++
 * - Snapshot dependency pre výpočty
 */

import { useMemo } from "react";
import { calculateFutureValue } from "../../engine/calculations";
import { approxYieldAnnualFromMix, riskScore0to10, type RiskPref } from "../mix/assetModel";
import type { MixItem } from "../mix/mix.service";
import type { Debt } from "../../persist/v3";
import { buildAmortSchedule } from "../../domain/amortization";

export interface ProjectionInputs {
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  goalAssetsEur: number;
  mix: MixItem[];
  debts: Debt[];
  riskPref: RiskPref;
}

export interface ProjectionResult {
  // FV projekcia
  fvFinal: number; // Konečná hodnota (po horizonYears)
  fvSeries: number[]; // Ročné hodnoty [year0, year1, ..., yearN]
  totalVklady: number; // Celkové vklady
  zisk: number; // Zisk (fv - vklady)
  
  // Dlhy
  debtSeries: number[]; // Ročné zostatky dlhov [year0, year1, ..., yearN]
  crossoverIndex: number | null; // Rok kedy investícia >= dlh (null ak nikdy)
  totalDebtRemaining: number; // Celkový zostatok dlhov na konci
  
  // Metriky
  approxYield: number; // Ročný výnos (z mixu)
  riskScore: number; // Riziko 0-10 (z mixu)
  goalProgress: number; // % splnenia cieľa (0-100+)
  remaining: number; // Zostáva do cieľa (€)
}

/**
 * Hlavný hook pre projekciu — deterministické deps, instant reaktivita
 */
export const useProjection = (inputs: ProjectionInputs): ProjectionResult => {
  // Stabilné deps keys (aby sa useMemo triggrovalo len pri zmene)
  const mixKey = JSON.stringify(inputs.mix.map(m => ({ k: m.key, p: m.pct })));
  const debtsKey = JSON.stringify(
    inputs.debts.map(d => ({
      p: d.principal,
      r: d.ratePa,
      m: d.monthsLeft,
      e: d.extraMonthly,
    }))
  );

  return useMemo(() => {
    const {
      lumpSumEur,
      monthlyVklad,
      horizonYears,
      goalAssetsEur,
      mix,
      debts,
      riskPref,
    } = inputs;

    // 1. Výnos z mixu (nie zo scenára!)
    const approxYield = approxYieldAnnualFromMix(mix, riskPref);

    // 2. FV series (ročne)
    const fvSeries: number[] = [];
    for (let year = 0; year <= horizonYears; year++) {
      const fv = calculateFutureValue(lumpSumEur, monthlyVklad, year, approxYield);
      fvSeries.push(fv);
    }
    const fvFinal = fvSeries[fvSeries.length - 1] || 0;
    const totalVklady = lumpSumEur + monthlyVklad * 12 * horizonYears;
    const zisk = fvFinal - totalVklady;

    // 3. Debt series (ročné zostatky)
    const debtSeries: number[] = [];
    for (let year = 0; year <= horizonYears; year++) {
      const targetMonth = year * 12;
      let totalDebtBalance = 0;

      debts.forEach((debt) => {
        const termMonths = debt.monthsLeft || 0;
        if (targetMonth >= termMonths) {
          // Dlh už splatený
          return;
        }

        // Build amortization schedule
        const schedule = buildAmortSchedule({
          principal: debt.principal,
          ratePa: debt.ratePa / 100, // % → decimal
          termMonths,
          monthlyPayment: debt.monthly - (debt.extraMonthly || 0), // Base payment
          extraMonthly: debt.extraMonthly || 0,
        });

        const monthData = schedule.months[targetMonth];
        totalDebtBalance += monthData?.balance || 0;
      });

      debtSeries.push(totalDebtBalance);
    }

    // 4. Crossover (prvý rok kde fv >= debt a debt > 0)
    let crossoverIndex: number | null = null;
    for (let i = 1; i < fvSeries.length; i++) {
      if (fvSeries[i] >= debtSeries[i] && debtSeries[i] > 0) {
        crossoverIndex = i;
        break;
      }
    }

    const totalDebtRemaining = debtSeries[debtSeries.length - 1] || 0;

    // 5. Risk (z mixu)
    const riskScore = riskScore0to10(mix, riskPref, 0);

    // 6. Goal progress
    const goalProgress = goalAssetsEur > 0 ? Math.min((fvFinal / goalAssetsEur) * 100, 100) : 0;
    const remaining = Math.max(goalAssetsEur - fvFinal, 0);

    return {
      fvFinal,
      fvSeries,
      totalVklady,
      zisk,
      debtSeries,
      crossoverIndex,
      totalDebtRemaining,
      approxYield,
      riskScore,
      goalProgress,
      remaining,
    };
  }, [
    inputs.lumpSumEur,
    inputs.monthlyVklad,
    inputs.horizonYears,
    inputs.goalAssetsEur,
    mixKey, // Stabilný key namiesto mix objektu
    debtsKey, // Stabilný key namiesto debts array
    inputs.riskPref,
  ]);
};
