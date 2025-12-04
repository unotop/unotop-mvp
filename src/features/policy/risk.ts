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
 * P1.5: Volume-based risk caps (VIP headroom)
 * 
 * STARTER/CORE/PREMIUM majú rôzne caps pre ďalšiu separáciu profilov.
 * Conservative CORE/PREMIUM má znížený cap (4.5) pre strict C < B ordering.
 */
export const RISK_MAX_PER_BAND: Record<'STARTER' | 'CORE' | 'PREMIUM', Record<RiskPref, number>> = {
  STARTER: {
    konzervativny: 5.0,
    vyvazeny: 7.0,
    rastovy: 8.5, // Standard cap
  },
  CORE: {
    konzervativny: 4.5, // P1.5 FIX: Znížené z 5.0 → 4.5 (strict C < B ordering)
    vyvazeny: 7.0,
    rastovy: 9.0, // +0.5 headroom
  },
  PREMIUM: {
    konzervativny: 4.5, // P1.5 FIX: Znížené z 5.0 → 4.5
    vyvazeny: 7.0,
    rastovy: 9.5, // +1.0 headroom (VIP)
  },
};

/**
 * PR-35 VIP: VIP Risk Max (pre VIP yield calculation)
 * 
 * Uvoľnené capy pre maximálny potenciál scenár.
 * Používa sa len pre VIP yield výpočet, NIE pre default mix odporúčanie.
 * 
 * Growth VIP môže ísť až na risk ~9.5 (dyn 35-40%, crypto 10%, ETF 35-40%).
 */
export const VIP_RISK_MAX: Record<RiskPref, number> = {
  konzervativny: 5.5,  // VIP Conservative (mierne uvoľnené, +0.5)
  vyvazeny: 8.0,       // VIP Balanced (+1.0)
  rastovy: 9.5,        // VIP Growth (+1.0, KEY CHANGE pre 24% yield)
};

/**
 * P1.5: Získaj volume-aware riskMax pre daný profil a stage
 * 
 * Používa RISK_MAX_PER_BAND namiesto base RISK_MAX.
 * Táto hodnota je HARD LIMIT pre yieldOptimizer a validateRiskBand.
 * 
 * @param pref - Rizikový profil
 * @param stage - Volume band (STARTER/CORE/LATE)
 * @returns Volume-aware riskMax
 */
export function getRiskMaxForBand(pref: RiskPref, stage: Stage): number {
  // P1.5: Stage LATE → VolumeBand PREMIUM mapping
  const band = (stage === 'LATE' ? 'PREMIUM' : stage) as 'STARTER' | 'CORE' | 'PREMIUM';
  return RISK_MAX_PER_BAND[band][pref];
}

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

/**
 * PR-35: Získaj VIP max riziko (pre VIP yield calculation)
 * 
 * Vracia VIP_RISK_MAX - uvoľnené capy pre maximálny potenciál scenár.
 * Používa sa len pre VIP yield výpočet, NIE pre default mix odporúčanie.
 * 
 * Umožňuje agresívnejšie mixe (napr. Growth dyn 35% + crypto 10% = risk ~9.0-9.5).
 * 
 * @param pref - Rizikový profil
 * @returns vipRiskMax (5.5 / 8.0 / 9.5)
 */
export function getVipRiskMax(pref: RiskPref): number {
  return VIP_RISK_MAX[pref];
}
