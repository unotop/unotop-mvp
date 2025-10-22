/**
 * Projection Engine - Type Definitions
 * Simuluje investičnú trajektóriu + amortizáciu dlhov s extra splátkami
 */

export type DebtKind = "mortgage" | "consumer";

/**
 * Jednorazová mimoriadna splátka
 */
export interface ExtraPayment {
  month: number; // 0-based index mesiaca od "teraz"
  amount: number; // € (kladné číslo)
}

/**
 * Opakovaná mesačná extra splátka (napr. +100 €/mes od mesiaca X)
 */
export interface RecurringExtra {
  startMonth: number; // od ktorého mesiaca
  amount: number; // € mesačne
}

/**
 * Vstup pre jeden dlh (hypotéka/spotrebák)
 */
export interface DebtInput {
  id: string;
  kind: DebtKind;
  principal: number; // P (istina v €)
  annualRate: number; // p.a. v %, napr. 4 = 4%
  termMonths: number; // n (zvyšná splatnosť v mesiacoch)
  // Voliteľné mimoriadne splátky:
  oneOffExtras?: ExtraPayment[]; // jednorazové
  recurringExtra?: RecurringExtra; // mesačné +amount od startMonth
}

/**
 * Investičné parametre
 */
export interface InvestInput {
  startLumpSum: number; // jednorazový vklad na začiatku (t=0)
  monthly: number; // mesačný vklad
  annualYieldPct: number; // p.a. výnos v %, napr. z approxYieldAnnualFromMix(mix)
}

/**
 * Parametre simulácie
 */
export interface SimulationParams {
  horizonMonths: number; // koľko mesiacov simulovať (napr. 360 = 30 rokov)
  debts: DebtInput[];
  invest: InvestInput;
}

/**
 * Jeden bod v čase (mesiac)
 */
export interface SimulationPoint {
  month: number; // t (0-based)
  investValue: number; // V_t (hodnota investícií)
  totalDebtBalance: number; // Σ zostávajúcich dlhov
  perDebtBalance: Record<string, number>; // zostatok pre každý debt.id
}

/**
 * Výsledok simulácie
 */
export interface SimulationResult {
  series: SimulationPoint[]; // dĺžka = horizonMonths+1 (vrátane t=0)
  crossoverMonth: number | null; // prvý t, kde investValue >= totalDebtBalance (null ak nenastane)
  finalInvestValue: number; // hodnota investícií na konci horizontu
  finalDebtBalance: number; // zostatok dlhov na konci horizontu
}
