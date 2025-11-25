/**
 * PR-27: Inflation configuration
 * 
 * Centrálna konfigurácia pre infláciu a zhodnotenie (nominálne vs. reálne)
 */

/**
 * Predpokladaná dlhodobá inflácia pre eurozónu
 * Použitie: prepočet nominálnych hodnot na reálne (v dnešných cenách)
 */
export const INFLATION_BASE = 0.025; // 2.5% p.a.

/**
 * Default režim zhodnotenia
 * 'real' = zhodnotenie po odpočítaní inflácie (default)
 * 'nominal' = nominálne zhodnotenie (bez odpočtu inflácie)
 */
export const DEFAULT_VALUATION_MODE: 'real' | 'nominal' = 'real';

/**
 * Label pre UI
 */
export const VALUATION_MODE_LABELS = {
  real: 'Zhodnotenie po odpočítaní inflácie',
  nominal: 'Nominálne zhodnotenie',
} as const;

/**
 * Caption text pre inflation rate
 */
export const INFLATION_CAPTION = `Predpokladaná inflácia: ${(INFLATION_BASE * 100).toFixed(1)} % p.a. (dlhodobý odhad pre eurozónu).`;
