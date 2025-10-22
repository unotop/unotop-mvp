/**
 * Centrálna validačná logika pre BASIC režim
 * Postupné odomykanie krokov (step-by-step workflow)
 */

import type { MixItem } from "../features/mix/mix.service";

export interface ValidationState {
  // Step 1: Cashflow (príjmy a výdavky)
  hasIncome: boolean;
  hasFixedExpenses: boolean;
  hasVariableExpenses: boolean;
  cashflowComplete: boolean;

  // Step 2: Investment settings
  hasLumpSumOrMonthly: boolean; // Aspoň jedno musí byť > 0
  hasHorizon: boolean;
  hasGoal: boolean;
  investmentComplete: boolean;

  // Step 3: Portfolio profile
  hasPortfolioProfile: boolean;

  // Step 4: Ready to share
  canShare: boolean;

  // Helpers
  freeCash: number; // Voľné prostriedky
  monthlyVkladMax: number; // Max mesačný vklad (nesmie prekročiť freeCash)
  hasPositiveFreeCash: boolean; // Či má aspoň 1€ voľné prostriedky (pre monthly vklad)
  isLosingMoney: boolean; // Či výdavky > príjem (warning)
}

export interface ValidationInput {
  monthlyIncome: number;
  fixedExp: number;
  varExp: number;
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  goalAssetsEur: number;
  mix: MixItem[];
}

/**
 * Vypočíta validation state pre BASIC režim
 */
export function validateBasicWorkflow(input: ValidationInput): ValidationState {
  // Step 1: Cashflow
  const hasIncome = input.monthlyIncome > 0;
  const hasFixedExpenses = input.fixedExp >= 0; // Môže byť 0 (ok)
  const hasVariableExpenses = input.varExp >= 0; // Môže byť 0 (ok)
  // Cashflow je kompletný, keď má príjem A aspoň jeden výdavok je vyplnený (nie default 0)
  const hasAtLeastOneExpense = input.fixedExp > 0 || input.varExp > 0;
  const cashflowComplete = hasIncome && hasAtLeastOneExpense;

  // Free cash calculation
  const freeCash = input.monthlyIncome - input.fixedExp - input.varExp;
  const monthlyVkladMax = Math.max(0, freeCash);
  const hasPositiveFreeCash = freeCash > 0;
  const isLosingMoney = freeCash < 0;

  // Step 2: Investment settings
  const hasLumpSumOrMonthly = input.lumpSumEur > 0 || input.monthlyVklad > 0;
  const hasHorizon = input.horizonYears > 0;
  const hasGoal = input.goalAssetsEur > 0;
  const investmentComplete =
    cashflowComplete && hasLumpSumOrMonthly && hasHorizon && hasGoal;

  // Step 3: Portfolio profile (aspoň jeden asset > 0)
  const hasMixSet = input.mix.some((item) => item.pct > 0);
  const mixSum = input.mix.reduce((sum, item) => sum + item.pct, 0);
  const mixIsNormalized = Math.abs(mixSum - 100) < 0.1; // Tolerancia 0.1%
  const hasPortfolioProfile = investmentComplete && hasMixSet && mixIsNormalized;

  // Step 4: Ready to share (všetko hotové)
  const canShare = hasPortfolioProfile;

  return {
    hasIncome,
    hasFixedExpenses,
    hasVariableExpenses,
    cashflowComplete,
    hasLumpSumOrMonthly,
    hasHorizon,
    hasGoal,
    investmentComplete,
    hasPortfolioProfile,
    canShare,
    freeCash,
    monthlyVkladMax,
    hasPositiveFreeCash,
    isLosingMoney,
  };
}

/**
 * Vracia user-friendly správu prečo nie je možné pokračovať
 */
export function getValidationMessage(state: ValidationState): string | null {
  if (!state.hasIncome) {
    return "Najprv nastavte mesačný príjem";
  }
  if (!state.cashflowComplete) {
    return "Vyplňte aspoň jeden typ výdavkov (fixné alebo variabilné)";
  }
  if (!state.hasLumpSumOrMonthly) {
    return "Nastavte jednorazovú investíciu alebo mesačný vklad";
  }
  if (!state.hasHorizon) {
    return "Nastavte investičný horizont";
  }
  if (!state.hasGoal) {
    return "Nastavte cieľ majetku";
  }
  if (!state.hasPortfolioProfile) {
    return "Vyberte investičný profil";
  }
  if (state.canShare) {
    return null; // Všetko ok
  }
  return "Dokončite všetky kroky";
}
