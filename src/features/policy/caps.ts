/**
 * Asset Caps Module
 * 
 * Poskytuje stage-aware limity pre jednotlivé aktíva a kombinácie.
 * Caps sa prispôsobujú investičnej fáze (STARTER/CORE/LATE).
 */

import type { Stage } from "./stage";
import type { RiskPref, AssetKey } from "../mix/assetModel";

export type Caps = Partial<Record<AssetKey, number>>;

/**
 * Získaj asset capy pre daný profil a fázu
 * 
 * Baseline (CORE) - PR-14.B zmäkčené (stred medzi STARTER/LATE):
 * - etf: 45% (zmäkčené z 40%), dyn: 13% (zmäkčené z 15%), crypto: 6%, 
 * - gold: 40%, bonds: 40%, bond3y9: 40%, cash: 35% (zmäkčené z 40%), real: 20%
 * - konzervativny: bonds max 35% (výnimka)
 * 
 * STARTER úpravy:
 * - etf: 50% (+5 p.b. z CORE 45%) - povoliť rastové ťahúne
 * - dyn: 15% (+2 p.b. z CORE 13%) - viac dynamického riadenia
 * - cash: 50% (+15 p.b. z CORE 35%) - viac flexibility
 * - combo dyn+crypto: max 25%
 * 
 * LATE úpravy:
 * - etf: 35% (-10 p.b. z CORE 45%) - znížiť volatilitu
 * - dyn: 12% (-1 p.b. z CORE 13%) - menej dynamického riadenia
 * - cash: 30% (-5 p.b. z CORE 35%) - konzervatívnejšie
 * - combo dyn+crypto: max 18%
 * 
 * @param pref - Rizikový profil
 * @param stage - Investičná fáza
 * @returns Caps objekt s limitmi pre každé aktívum
 */
export function getAssetCaps(pref: RiskPref, stage: Stage): Caps {
  // P1.5 FIX: Profile-specific caps (Conservative < Balanced/Growth)
  const base: Caps = {
    etf: pref === 'konzervativny' ? 30 : 50,  // P1.5: C=30%, B/G=50%
    dyn: pref === 'konzervativny' ? 0 : (pref === 'vyvazeny' ? 15 : 22), // P1.5: C=0%, B=15%, G=22%
    crypto: pref === 'konzervativny' ? 0 : 12, // P1.5: C=0%, B/G=12%
    gold: 40,
    bonds: 40,
    bond3y9: 40,
    cash: 35,
    real: pref === 'konzervativny' ? 5 : 20, // P1.5: C=5%, B/G=20%
  };

  // STARTER: povoľ rastové ťahúne (ale rešpektuj profile separation)
  if (stage === "STARTER") {
    if (pref !== 'konzervativny') {
      base.etf = 55;   // B/G: +5 p.b. boost
      base.dyn = pref === 'vyvazeny' ? 18 : 25; // B=18%, G=25%
    }
    base.cash = 50;
    
    if (pref === "rastovy") {
      base.real = 12;
    }
  }

  // LATE: znížiť volatilitu (ale rešpektuj profile separation)
  if (stage === "LATE") {
    if (pref === 'konzervativny') {
      base.etf = 25;  // C: ešte konzervatívnejšie
    } else {
      base.etf = 50;  // B/G: stále vyššie než C
      base.dyn = pref === 'vyvazeny' ? 16 : 22;
    }
    base.cash = 30;
  }

  return base;
}

/**
 * Získaj kombinovaný limit pre dyn+crypto podľa stage
 * 
 * Pravidlá:
 * - STARTER: 25% (povoliť viac volatility pre rast)
 * - CORE: 22% (baseline, pôvodné správanie)
 * - LATE: 18% (konzervatívnejšie, ochrana kapitálu)
 * 
 * @param stage - Investičná fáza
 * @returns Kombinovaný limit dyn+crypto (%)
 */
export function getDynCryptoComboCap(stage: Stage): number {
  if (stage === "STARTER") return 25;
  if (stage === "LATE")    return 18;
  return 22; // CORE baseline
}
