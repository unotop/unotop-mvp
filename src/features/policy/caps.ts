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
 * Baseline (CORE):
 * - etf: 40%, dyn: 15%, crypto: 6%, gold: 40%, bonds: 40%, bond3y9: 40%, cash: 40%, real: 20%
 * - konzervativny: bonds max 35% (výnimka)
 * 
 * STARTER úpravy:
 * - etf: 50% (+10 p.b.) - povoliť rastové ťahúne
 * - dyn: +3 p.b. (max 18%) - viac dynamického riadenia
 * - combo dyn+crypto: max 25%
 * 
 * LATE úpravy:
 * - etf: 35% (-5 p.b.) - znížiť volatilitu
 * - dyn: -5 p.b. (min 8%) - menej dynamického riadenia
 * - combo dyn+crypto: max 18%
 * 
 * @param pref - Rizikový profil
 * @param stage - Investičná fáza
 * @returns Caps objekt s limitmi pre každé aktívum
 */
export function getAssetCaps(pref: RiskPref, stage: Stage): Caps {
  // Baseline (pôvodné správanie): 40% na väčšinu aktív
  const base: Caps = {
    etf: 40,
    dyn: 15,
    crypto: 6,
    gold: 40,
    bonds: 40,
    bond3y9: 40,
    cash: 40,
    real: 20,
  };

  // Výnimka: v konzervatívnom profilu "bonds" max 35%
  if (pref === "konzervativny") {
    base.bonds = 35;
  }

  // STARTER: povoľ rastové ťahúne, ale drž rozum v dynamike
  if (stage === "STARTER") {
    base.etf = 50;  // +10 p.b.
    base.dyn = Math.min((base.dyn ?? 15) + 3, 18); // +3 p.b., max 18
  }

  // LATE: jemne ukrojiť volatilitu, chrániť kapitál
  if (stage === "LATE") {
    base.etf = 35;  // -5 p.b.
    base.dyn = Math.max((base.dyn ?? 15) - 5, 8); // -5 p.b., min 8
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
