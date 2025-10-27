/**
 * PR-16.A: Right Panel State Machine
 * 
 * Detekuje 3 stavy pravého panelu:
 * - ZERO: Žiadne investičné vstupy (lump=0, monthly=0, years=0)
 * - PARTIAL: Základné vstupy OK, ale chýba profil/cieľ
 * - ACTIVE: Všetko vyplnené, plnohodnotné metriky
 * 
 * Gating logika:
 * - ZERO: Skeleton loading UI + "Začnite vyplnením parametrov"
 * - PARTIAL: Čiastočné metriky (projekcia OK, výnos/riziko "—") + badge "Vyplňte profil pre presnejšie metriky"
 * - ACTIVE: Plné metriky + konkrétne rady
 */

export type RightPanelState = "ZERO" | "PARTIAL" | "ACTIVE";

export interface ValidationState {
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  goalAssetsEur: number;
  monthlyIncome: number;
  reserveEur: number;
  reserveMonths: number;
}

/**
 * Detekuj stav pravého panelu
 */
export function detectRightPanelState(state: ValidationState): RightPanelState {
  const { lumpSumEur, monthlyVklad, horizonYears, goalAssetsEur, monthlyIncome, reserveEur, reserveMonths } = state;

  // ZERO: žiadne investičné vstupy
  const hasInvestmentInputs = lumpSumEur > 0 || monthlyVklad > 0 || horizonYears > 0;
  if (!hasInvestmentInputs) {
    return "ZERO";
  }

  // ACTIVE: minimálne investment + profile OK
  // Profile OK = goal ALEBO (income + reserve)
  const hasGoal = goalAssetsEur > 0;
  const hasProfile = monthlyIncome > 0 && (reserveEur > 0 || reserveMonths > 0);
  
  if (hasGoal || hasProfile) {
    return "ACTIVE";
  }

  // PARTIAL: investment vstupy OK, ale chýba profil
  return "PARTIAL";
}

/**
 * Získaj copy pre state badge
 */
export function getStateBadgeCopy(state: RightPanelState): string | null {
  switch (state) {
    case "ZERO":
      return "Začnite vyplnením investičných parametrov";
    case "PARTIAL":
      return "Vyplňte profil pre presnejšie metriky";
    case "ACTIVE":
      return null; // No badge
    default:
      return null;
  }
}

/**
 * Či zobrazovať výnos/riziko metriky (gated)
 */
export function shouldShowYieldRisk(state: RightPanelState): boolean {
  return state === "ACTIVE";
}

/**
 * Či zobrazovať konkrétne rady (gated)
 */
export function shouldShowConcreteAdvice(state: RightPanelState): boolean {
  return state === "ACTIVE";
}
