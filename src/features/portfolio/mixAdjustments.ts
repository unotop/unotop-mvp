/**
 * Mix Adjustments Orchestrator - Kombinuje všetky scaling logiky
 * 
 * Flow:
 * 1. Lump sum scaling (caps risky, boost safe)
 * 2. Monthly scaling (500 EUR cap na dyn+crypto)
 * 3. Cash reserve optimization (dynamická rezerva)
 * 4. Bond minimum handling (2500 EUR threshold)
 * 5. Stage-aware caps enforcement (PR-8: adaptive policy)
 * 
 * Export: Adjusted preset + warnings array pre UI
 */

import type { MixItem } from "../mix/mix.service";
import type { PortfolioPreset } from "./presets";
import type { ReserveProfile } from "./cashReserve";
import type { RiskPref } from "../mix/assetModel";

import { normalize } from "../mix/mix.service";
import { scaleMixByLumpSum, getLumpSumTierInfo } from "./lumpSumScaling";
import { scaleMixByMonthly, getMonthlyCappingInfo } from "./monthlyScaling";
import { adjustMixForCashReserve, getCashReserveInfo } from "./cashReserve";
import { applyBondMinimum, getBondMinimumInfo } from "./bondMinimum";
import { enforceStageCaps } from "./presets";
import { detectStage } from "../policy/stage";
import { applyMinimums } from "../policy/applyMinimums";

export interface ProfileForAdjustments {
  lumpSumEur: number;
  monthlyEur: number;
  horizonYears: number;
  // Reserve data
  monthlyIncome: number;
  fixedExpenses: number;
  variableExpenses: number;
  reserveEur: number;
  reserveMonths: number;
  // Goal for stage detection (PR-8)
  goalAssetsEur?: number;
  // Risk preference for stage caps
  riskPref?: RiskPref;
}

export type AdjustmentWarning =
  | "bond-minimum"
  | "lump-sum-scaling"
  | "monthly-capping"
  | "cash-reserve-low"
  | "cash-reserve-high";

export interface AdjustmentResult {
  mix: MixItem[];
  warnings: AdjustmentWarning[];
  info: {
    lumpSumTier?: ReturnType<typeof getLumpSumTierInfo>;
    monthlyCapping?: ReturnType<typeof getMonthlyCappingInfo>;
    cashReserve?: ReturnType<typeof getCashReserveInfo>;
    bondMinimum?: ReturnType<typeof getBondMinimumInfo>;
  };
}

/**
 * Aplikuj všetky adjustments na preset mix
 */
export function getAdjustedMix(
  baseMix: MixItem[],
  profile: ProfileForAdjustments
): AdjustmentResult {
  let mix = [...baseMix];
  const warnings: AdjustmentWarning[] = [];
  const info: AdjustmentResult["info"] = {};

  // === STEP 1: Bond minimum handling (FIRST!) ===
  // Musí byť prvý, aby sme vedeli reálnu alokáciu pred scaling
  const { mix: mixAfterBonds, bondWarning } = applyBondMinimum(
    mix,
    profile.lumpSumEur,
    profile.monthlyEur,
    profile.horizonYears
  );
  mix = mixAfterBonds;

  if (bondWarning) {
    warnings.push("bond-minimum");
    const bondInfo = getBondMinimumInfo(
      profile.lumpSumEur,
      profile.monthlyEur
    );
    if (bondInfo) {
      info.bondMinimum = bondInfo;
    }
  }

  // === STEP 2: Lump sum scaling ===
  mix = scaleMixByLumpSum(mix, profile.lumpSumEur);
  const lumpSumTier = getLumpSumTierInfo(profile.lumpSumEur);
  if (lumpSumTier?.applied) {
    warnings.push("lump-sum-scaling");
    info.lumpSumTier = lumpSumTier;
  }

  // === STEP 3: Monthly scaling ===
  const baseMixBeforeMonthly = [...mix];
  mix = scaleMixByMonthly(mix, profile.monthlyEur);
  const monthlyCapping = getMonthlyCappingInfo(
    baseMixBeforeMonthly,
    profile.monthlyEur
  );
  if (monthlyCapping?.applied) {
    warnings.push("monthly-capping");
    info.monthlyCapping = monthlyCapping;
  }

  // === STEP 4: Cash reserve optimization ===
  const baseMixBeforeCash = [...mix];
  mix = adjustMixForCashReserve(
    mix,
    {
      monthlyIncome: profile.monthlyIncome,
      fixedExpenses: profile.fixedExpenses,
      variableExpenses: profile.variableExpenses,
      reserveEur: profile.reserveEur,
      reserveMonths: profile.reserveMonths,
    },
    profile.lumpSumEur,
    profile.monthlyEur,
    profile.horizonYears
  );

  const totalPortfolioEur =
    profile.lumpSumEur + profile.monthlyEur * 12 * profile.horizonYears;
  const currentCashPct = baseMixBeforeCash.find((m) => m.key === "cash")?.pct || 0;
  const cashReserveInfo = getCashReserveInfo(
    {
      monthlyIncome: profile.monthlyIncome,
      fixedExpenses: profile.fixedExpenses,
      variableExpenses: profile.variableExpenses,
      reserveEur: profile.reserveEur,
      reserveMonths: profile.reserveMonths,
    },
    totalPortfolioEur,
    currentCashPct
  );

  if (cashReserveInfo.needsAdjustment) {
    if (cashReserveInfo.current < cashReserveInfo.optimal) {
      warnings.push("cash-reserve-low");
    } else {
      warnings.push("cash-reserve-high");
    }
    info.cashReserve = cashReserveInfo;
  }

  // === STEP 5: Apply asset minimums (PR-12) ===
  // Presunie nedostupné aktíva do ETF/hotovosti
  const { mix: mixAfterMinimums } = applyMinimums(mix, {
    lumpSumEur: profile.lumpSumEur,
    monthlyEur: profile.monthlyEur,
    monthlyIncome: profile.monthlyIncome,
  });
  mix = mixAfterMinimums;

  // === STEP 6: Stage-aware caps enforcement (PR-8) ===
  // Detekuj stage a aplikuj adaptive caps
  const stage = detectStage(
    profile.lumpSumEur,
    profile.monthlyEur,
    profile.horizonYears,
    profile.goalAssetsEur
  );
  const riskPref = profile.riskPref || "vyvazeny"; // fallback
  mix = enforceStageCaps(mix, riskPref, stage);

  return { mix: normalize(mix), warnings, info };
}

/**
 * Wrapper pre ľahšie volanie z presets.ts
 */
export function getAdjustedPreset(
  preset: PortfolioPreset,
  profile: ProfileForAdjustments
): { preset: PortfolioPreset; warnings: AdjustmentWarning[]; info: AdjustmentResult["info"] } {
  const { mix, warnings, info } = getAdjustedMix(preset.mix, profile);

  return {
    preset: { ...preset, mix },
    warnings,
    info,
  };
}
