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
import { scheduleWithExtra } from "../debt/amortization"; // PR-9 Task B: nový engine

export interface ProjectionInputs {
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  goalAssetsEur: number;
  mix: MixItem[];
  debts: Debt[];
  riskPref: RiskPref;
  modeUi?: "BASIC" | "PRO"; // PR-12: režim UI (default BASIC)
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
  debtPayoffMonth: number | null; // Mesiac posledného splatenia dlhu (null ak žiadne dlhy)
  
  // Metriky
  approxYield: number; // Ročný výnos (z mixu)
  riskScore: number; // Riziko 0-10 (z mixu)
  goalProgress: number; // % splnenia cieľa (0-100+)
  remaining: number; // Zostáva do cieľa (€)
  
  // PR-11: Doplnky pre ProjectionChart
  horizonMonths: number; // Efektívny horizont v mesiacoch
  investedSeries: number[]; // Kumulatívne vklady [year0, year1, ...]
  effectiveHorizonYears: number; // Efektívny horizont v rokoch (max z invest/debt)
  
  // PR-12: Drift detection pre lazy reapply
  hasDrift: boolean; // Má výrazný drift od profileSnapshot?
  driftFields: string[]; // Ktoré polia driftujú (napr. ['lumpSum', 'monthly'])
  canReapply: boolean; // Môže sa reaplikovať? (mixOrigin=presetAdjusted && presetId exists)
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

    // PR-10 Priorita 2: Effective horizon = max(investHorizon, maxDebtHorizon)
    const maxDebtHorizonMonths = debts.length > 0
      ? Math.max(...debts.map(d => d.monthsLeft || 0))
      : 0;
    const maxDebtHorizonYears = Math.ceil(maxDebtHorizonMonths / 12);
    const effectiveHorizonYears = Math.max(horizonYears, maxDebtHorizonYears);

    // 1. Výnos z mixu (nie zo scenára!)
    const approxYield = approxYieldAnnualFromMix(mix, riskPref);

    // 2. FV series (ročne) - použiť effectiveHorizon
    const fvSeries: number[] = [];
    for (let year = 0; year <= effectiveHorizonYears; year++) {
      const fv = calculateFutureValue(lumpSumEur, monthlyVklad, year, approxYield);
      fvSeries.push(fv);
    }
    const fvFinal = fvSeries[horizonYears] || fvSeries[fvSeries.length - 1] || 0; // FV pri investičnom horizonte
    const totalVklady = lumpSumEur + monthlyVklad * 12 * horizonYears;
    const zisk = fvFinal - totalVklady;

    // 3. Debt series (ročné zostatky) - PR-9 Task B: nový amortization engine
    const debtSeries: number[] = [];
    let debtPayoffMonth: number | null = null; // Najneskorší payoff mesiac
    
    for (let year = 0; year <= effectiveHorizonYears; year++) {
      const targetMonth = year * 12;
      let totalDebtBalance = 0;

      debts.forEach((debt) => {
        const termMonths = debt.monthsLeft || 0;
        if (termMonths === 0) return; // Žiadny dlh

        // PR-9 Task B: Použiť nový scheduleWithExtra
        const schedule = scheduleWithExtra(
          debt.principal,
          debt.ratePa / 100, // % → decimal
          termMonths,
          debt.extraMonthly || 0
        );

        // PR-13 DEBUG: Vypíš výpočet
        if (year === 0) {
          console.log("🔍 DEBUG debt calculation:", {
            debtName: debt.name,
            principal: debt.principal,
            ratePa: debt.ratePa,
            monthsLeft: termMonths,
            extraMonthly: debt.extraMonthly || 0,
            payoffMonth: schedule.payoffMonth,
            payoffYears: (schedule.payoffMonth / 12).toFixed(1),
          });
        }

        // Track najneskorší payoff
        if (debtPayoffMonth === null || schedule.payoffMonth > debtPayoffMonth) {
          debtPayoffMonth = schedule.payoffMonth;
        }

        // Zostatok v danom mesiaci
        const balance = schedule.balances[targetMonth] || 0;
        totalDebtBalance += balance;
      });

      debtSeries.push(totalDebtBalance);
    }

    // 4. Crossover (prvý rok kde fv >= debt a debt > 0)
    // PR-10 Priorita 3: Nezobrazuj crossover aj pri i=0 (lump sum > debts)
    let crossoverIndex: number | null = null;
    for (let i = 0; i < fvSeries.length; i++) {
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

    // PR-11: Rozšírené výstupy pre ProjectionChart
    const horizonMonths = effectiveHorizonYears * 12;
    
    // Kumulované vklady pre každý rok (invested series)
    const investedSeries: number[] = [];
    for (let year = 0; year <= effectiveHorizonYears; year++) {
      const invested = lumpSumEur + (monthlyVklad * 12 * year);
      investedSeries.push(invested);
    }

    // PR-12: Drift detection pre lazy reapply
    const v3 = typeof window !== 'undefined' ? (() => {
      try {
        const raw = localStorage.getItem('unotop:v3') || localStorage.getItem('unotop_v3');
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    })() : {};
    
    const mixOrigin = v3.mixOrigin as 'presetAdjusted' | 'manual' | undefined;
    const presetId = v3.presetId as string | undefined;
    const snapshot = v3.profileSnapshot as { lumpSum: number; monthly: number; horizon: number } | undefined;
    
    const canReapply = mixOrigin === 'presetAdjusted' && !!presetId;
    
    const driftFields: string[] = [];
    let hasDrift = false;
    
    if (canReapply && snapshot) {
      const modeUi = inputs.modeUi || "BASIC"; // PR-12: default BASIC
      
      // Thresholdy (absolútne OR relatívne, kombinácia)
      const lumpDriftAbs = Math.abs(lumpSumEur - snapshot.lumpSum);
      const lumpDriftRel = lumpDriftAbs / Math.max(snapshot.lumpSum, 1);
      if (lumpDriftAbs >= 5000 || lumpDriftRel >= 0.20) {
        driftFields.push('lumpSum');
        hasDrift = true;
      }
      
      const monthlyDriftAbs = Math.abs(monthlyVklad - snapshot.monthly);
      const monthlyDriftRel = monthlyDriftAbs / Math.max(snapshot.monthly, 1);
      if (monthlyDriftAbs >= 100 || monthlyDriftRel >= 0.20) {
        driftFields.push('monthly');
        hasDrift = true;
      }
      
      // PR-12 FIX: Horizon drift detection podľa režimu
      const horizonDriftAbs = Math.abs(horizonYears - snapshot.horizon);
      const horizonDriftRel = horizonDriftAbs / Math.max(snapshot.horizon, 1);
      
      if (modeUi === "BASIC") {
        // BASIC: Ignoruj horizon ako trigger (žiadne auto-optimize pre posun slidera)
        // Používateľ uvidí chip "Profil vyžaduje prepočítanie", ale auto-optimize nespustí
      } else {
        // PRO: Vyšší threshold (5 rokov alebo 25%)
        if (horizonDriftAbs >= 5 || horizonDriftRel >= 0.25) {
          driftFields.push('horizon');
          hasDrift = true;
        }
      }
    }

    return {
      fvFinal,
      fvSeries,
      totalVklady,
      zisk,
      debtSeries,
      crossoverIndex,
      totalDebtRemaining,
      debtPayoffMonth, // Nový export
      approxYield,
      riskScore,
      goalProgress,
      remaining,
      // PR-11: Nové exporty
      horizonMonths,
      investedSeries,
      effectiveHorizonYears,
      // PR-12: Drift detection
      hasDrift,
      driftFields,
      canReapply,
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
