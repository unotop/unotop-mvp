/**
 * PR-27: Inflation helpers for valuation mode
 * 
 * Poskytuje funkcie na prepočet nominálnych hodnôt na reálne (po inflácii)
 * a naopak. Používa sa len ako VIEW LAYER - engine zostáva v nominálnom svete.
 */

import { INFLATION_BASE } from '../config/inflation.config';

/**
 * Prepočíta nominálnu budúcu hodnotu (FV) na reálnu hodnotu (v dnešných cenách)
 * 
 * Formula: FV_real = FV_nominal / (1 + inflation)^years
 * 
 * @param nominalFV - Nominálna budúca hodnota (z projekcie)
 * @param years - Počet rokov do budúcnosti
 * @param inflationRate - Ročná miera inflácie (default: INFLATION_BASE)
 * @returns Reálna hodnota v dnešných cenách
 * 
 * @example
 * ```ts
 * const nominalFV = 100000; // 100k€ o 20 rokov
 * const realFV = toRealValue(nominalFV, 20); // ~61k€ v dnešných cenách
 * ```
 */
export function toRealValue(
  nominalFV: number,
  years: number,
  inflationRate: number = INFLATION_BASE
): number {
  if (years === 0) return nominalFV;
  return nominalFV / Math.pow(1 + inflationRate, years);
}

/**
 * Prepočíta nominálny výnos p.a. na reálny výnos (po inflácii)
 * 
 * Formula: r_real = ((1 + r_nominal) / (1 + inflation)) - 1
 * 
 * @param nominalYield - Nominálny ročný výnos (napr. 0.07 = 7%)
 * @param inflationRate - Ročná miera inflácie (default: INFLATION_BASE)
 * @returns Reálny výnos po odpočítaní inflácie
 * 
 * @example
 * ```ts
 * const nominalYield = 0.07; // 7% p.a.
 * const realYield = toRealYield(nominalYield); // ~4.4% p.a. (po inflácii 2.5%)
 * ```
 */
export function toRealYield(
  nominalYield: number,
  inflationRate: number = INFLATION_BASE
): number {
  return ((1 + nominalYield) / (1 + inflationRate)) - 1;
}

/**
 * Prepočíta reálny cieľ (zadaný v dnešných cenách) na nominálny cieľ
 * 
 * Formula: goal_nominal = goal_real * (1 + inflation)^years
 * 
 * Použitie: V nominálnom móde potrebujeme prepočítať cieľ do budúcich cien,
 * aby % progresu dávalo zmysel (porovnáme nominálne FV vs nominálny goal).
 * 
 * @param realGoal - Cieľ v dnešných cenách (ako ho zadal užívateľ)
 * @param years - Počet rokov do budúcnosti (horizont)
 * @param inflationRate - Ročná miera inflácie (default: INFLATION_BASE)
 * @returns Nominálny cieľ v budúcich cenách
 * 
 * @example
 * ```ts
 * const realGoal = 100000; // Chcem mať 100k€ v dnešných cenách
 * const nominalGoal = toNominalGoal(realGoal, 20); // ~164k€ v budúcich cenách
 * ```
 */
export function toNominalGoal(
  realGoal: number,
  years: number,
  inflationRate: number = INFLATION_BASE
): number {
  if (years === 0) return realGoal;
  return realGoal * Math.pow(1 + inflationRate, years);
}

/**
 * Zistí režim zhodnotenia z profilu (s fallback na default)
 * 
 * @param profile - Profil užívateľa (alebo undefined)
 * @returns 'real' | 'nominal'
 */
export function getValuationMode(profile?: { valuationMode?: 'real' | 'nominal' }): 'real' | 'nominal' {
  return profile?.valuationMode || 'real';
}

/**
 * Pomocná funkcia pre formátovanie hodnoty podľa režimu
 * 
 * @param nominalValue - Nominálna hodnota
 * @param years - Počet rokov
 * @param mode - Režim zhodnotenia
 * @returns Hodnota podľa režimu (reálna alebo nominálna)
 */
export function formatValueByMode(
  nominalValue: number,
  years: number,
  mode: 'real' | 'nominal'
): number {
  return mode === 'real' ? toRealValue(nominalValue, years) : nominalValue;
}

/**
 * Helper pre tooltip - vráti obe hodnoty (reálnu aj nominálnu)
 * 
 * @param nominalValue - Nominálna hodnota
 * @param years - Počet rokov
 * @returns { real: number, nominal: number }
 */
export function getBothValues(nominalValue: number, years: number): { real: number; nominal: number } {
  return {
    real: toRealValue(nominalValue, years),
    nominal: nominalValue,
  };
}
