/**
 * Adaptive Risk Cap Module
 * 
 * Poskytuje adaptívne rizikové limity podľa investičnej fázy.
 * Baseline z assetModel.ts ± 0.5 bodu podľa stage.
 */

import { RISK_CAPS } from "../mix/assetModel";
import type { Stage } from "./stage";
import type { RiskPref } from "../mix/assetModel";

/**
 * Získaj adaptívny risk cap pre daný profil a fázu
 * 
 * Baseline capy (z assetModel.ts):
 * - konzervativny: 4.0
 * - vyvazeny: 6.0
 * - rastovy: 7.5
 * 
 * Úpravy podľa stage:
 * - STARTER: +0.5 (viac priestoru na rast)
 * - CORE: baseline (žiadna zmena)
 * - LATE: -0.5 (viac konzervatívne, ochrana kapitálu)
 * 
 * @param pref - Rizikový profil (konzervativny/vyvazeny/rastovy)
 * @param stage - Investičná fáza (STARTER/CORE/LATE)
 * @returns Adaptívny risk cap (0-10 škála)
 */
export function getAdaptiveRiskCap(pref: RiskPref, stage: Stage): number {
  const base = RISK_CAPS[pref];
  
  if (stage === "STARTER") return base + 0.5; // Viac priestoru na rast
  if (stage === "LATE")    return base - 0.5; // Viac konzervatívne
  
  return base; // CORE - baseline
}
