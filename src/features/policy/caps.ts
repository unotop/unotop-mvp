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
  // PR-14.B: CORE baseline zmäkčený (stred medzi STARTER/LATE) - menej redistribution conflicts
  const base: Caps = {
    etf: 45,   // 45% (bolo 40%) - stred medzi STARTER 50% a LATE 35%
    dyn: 13,   // 13% (bolo 15%) - stred medzi STARTER 15% a LATE 12%
    crypto: 6,
    gold: 40,
    bonds: 40,
    bond3y9: 40,
    cash: 35,  // 35% (bolo 40%) - stred medzi STARTER 50% a LATE 30%
    real: 20,
  };

  // Výnimka: v konzervatívnom profilu "bonds" max 35%
  if (pref === "konzervativny") {
    base.bonds = 35;
  }

  // STARTER: povoľ rastové ťahúne, ale drž rozum v dynamike
  if (stage === "STARTER") {
    base.etf = 50;   // +5 p.b. z CORE 45%
    base.dyn = 15;   // +2 p.b. z CORE 13%
    base.cash = 50;  // +15 p.b. z CORE 35%
  }

  // LATE: jemne ukrojiť volatilitu, chrániť kapitál
  if (stage === "LATE") {
    base.etf = 35;   // -10 p.b. z CORE 45%
    base.dyn = 12;   // -1 p.b. z CORE 13%
    base.cash = 30;  // -5 p.b. z CORE 35%
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
