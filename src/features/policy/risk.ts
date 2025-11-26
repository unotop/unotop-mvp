/**
 * Adaptive Risk Cap Module
 * 
 * PR-28: Rozdelenie riskTarget (ideálny cieľ) vs riskMax (tvrdá hranica).
 * Stage bonusy ovplyvňujú riskTarget, NIE riskMax.
 * 
 * riskTarget: Baseline z assetModel.ts ± 0.5 bodu podľa stage
 * riskMax: Pevná STOP hranica bez stage úprav (5 / 7 / 8.5)
 */

import { RISK_CAPS } from "../mix/assetModel";
import type { Stage } from "./stage";
import type { RiskPref } from "../mix/assetModel";

/**
 * Tvrdé maximálne riziko podľa profilu (bez stage bonusov)
 * 
 * PR-28 FIX: Stage bonusy NESMÚ posúvať riskMax vyššie.
 * enforceRiskCap používa tieto pevné hodnoty ako STOP hranicu.
 */
export const RISK_MAX: Record<RiskPref, number> = {
  konzervativny: 5.0,  // Konzervatívny max 5.0 (target 4.0)
  vyvazeny: 7.0,       // Vyvážený max 7.0 (target 6.0)
  rastovy: 8.5,        // Rastový max 8.5 (target 7.5)
};

/**
 * Získaj adaptívny risk target (cieľ) pre daný profil a fázu
 * 
 * Baseline (z assetModel.ts):
 * - konzervativny: 4.0
 * - vyvazeny: 6.0
 * - rastovy: 7.5
 * 
 * Úpravy podľa stage (pre DOWN-TUNE / UP-TUNE):
 * - STARTER: +0.5 (viac priestoru na rast)
 * - CORE: baseline (žiadna zmena)
 * - LATE: -0.5 (viac konzervatívne, ochrana kapitálu)
 * 
 * POZOR: Táto funkcia vracia riskTarget, nie riskMax!
 * riskMax je pevná hranica (5 / 7 / 8.5) bez stage bonusov.
 * 
 * @param pref - Rizikový profil (konzervativny/vyvazeny/rastovy)
 * @param stage - Investičná fáza (STARTER/CORE/LATE)
 * @returns Adaptívny risk target (0-10 škála)
 */
export function getAdaptiveRiskCap(pref: RiskPref, stage: Stage): number {
  const base = RISK_CAPS[pref]; // riskTarget baseline
  
  if (stage === "STARTER") return base + 0.5; // Viac priestoru na rast
  if (stage === "LATE")    return base - 0.5; // Viac konzervatívne
  
  return base; // CORE - baseline
}

/**
 * Získaj tvrdé max riziko (pre enforceRiskCap)
 * 
 * Vracia RISK_MAX bez ohľadu na stage.
 * Stage bonusy ovplyvňujú len riskTarget (getAdaptiveRiskCap), nie riskMax.
 * 
 * @param pref - Rizikový profil
 * @returns riskMax (5 / 7 / 8.5)
 */
export function getRiskMax(pref: RiskPref): number {
  return RISK_MAX[pref];
}
