/**
 * Asset Minimums - Realistické minimálne investície pre každé aktívum
 * 
 * PR-12: Zamedziť nereálnym alokáciám pri malých vkladoch bez blokovania výberu.
 * Pravidlo: Ak aktívum nespĺňa minimum, presunúť jeho % do ETF/hotovosti.
 */

import type { MixItem } from "../mix/mix.service";

/**
 * Minimálne investície pre jednotlivé aktíva
 * 
 * lumpMin: Minimálna jednorazová investícia (EUR)
 * monthlyMin: Minimálny mesačný vklad (EUR), 0 = mesačný vklad nepostačuje
 */
export const ASSET_MINIMUMS = {
  etf:     { lumpMin: 0,      monthlyMin: 20  },   // EIC bez vstupu, mesačne od ~20 €
  gold:    { lumpMin: 0,      monthlyMin: 50  },   // zlaté sporenie od ~50 €/mes
  bonds:   { lumpMin: 2500,   monthlyMin: 0   },   // nákup dlhopisu 2 500 €
  bond3y9: { lumpMin: 2500,   monthlyMin: 0   },   // rovnaké
  dyn:     { lumpMin: 500,    monthlyMin: 100 },   // PR-34: Zníž z 1000→500, monthly od 100 (realistické pre 600/mes vklad)
  cash:    { lumpMin: 0,      monthlyMin: 0   },   // vždy OK
  crypto:  { lumpMin: 100,    monthlyMin: 50  },   // praktické minimum
  real:    { lumpMin: 300000, monthlyMin: 0   },   // ostáva filter príjem≥3500 alebo lump≥300k
} as const;

/**
 * Fallback map - Kam presúvať nedostupné alokácie
 * 
 * Formát: [target asset, % ratio]
 * Súčet ratios by mal byť 100 (pre jednoduchosť)
 * 
 * PR-13: Risk-aware fallback pre konzervativny profil
 */
export const FALLBACKS: Record<
  string,
  Array<[keyof typeof ASSET_MINIMUMS, number]>
> = {
  bonds:   [["etf", 70], ["cash", 30]],
  bond3y9: [["etf", 70], ["cash", 30]],
  dyn:     [["etf", 100]],
  real:    [["etf", 70], ["cash", 30]],
  crypto:  [["etf", 100]],
  gold:    [["etf", 60], ["cash", 40]],
  // etf/cash vždy dostupné – fallback netreba
};

/**
 * Risk-aware fallback pre konzervativny profil
 * Namiesto ETF-heavy, presúvaj do gold+cash (50:50)
 */
export const CONSERVATIVE_FALLBACKS: Record<
  string,
  Array<[keyof typeof ASSET_MINIMUMS, number]>
> = {
  bonds:   [["gold", 50], ["cash", 50]],
  bond3y9: [["gold", 50], ["cash", 50]],
  dyn:     [["gold", 50], ["cash", 50]],
  real:    [["gold", 50], ["cash", 50]],
  crypto:  [["etf", 100]], // crypto ostáva do ETF
  gold:    [["cash", 100]], // gold už nemôže ísť do gold
};

/**
 * Profil používateľa pre overenie dostupnosti
 */
export interface AssetAvailabilityProfile {
  lumpSumEur: number;
  monthlyEur: number;
  monthlyIncome?: number;  // Pre reality filter
}

/**
 * Over, či je aktívum dostupné pre daný profil
 * 
 * @param assetKey - Kľúč aktíva (etf, gold, bonds, ...)
 * @param profile - Profil používateľa
 * @returns true ak je aktívum dostupné
 */
export function isAssetAvailable(
  assetKey: keyof typeof ASSET_MINIMUMS,
  profile: AssetAvailabilityProfile
): boolean {
  const min = ASSET_MINIMUMS[assetKey];
  
  // Špeciálny prípad: reality vyžaduje príjem ≥ 3500 alebo lump ≥ 300k
  if (assetKey === "real") {
    return (
      profile.lumpSumEur >= min.lumpMin ||
      (profile.monthlyIncome !== undefined && profile.monthlyIncome >= 3500)
    );
  }
  
  // Štandardná logika:
  // - Ak má lumpMin > 0 a monthlyMin = 0 → vyžaduje sa len lump (napr. bonds, dyn)
  // - Ak má lumpMin = 0 a monthlyMin > 0 → vyžaduje sa len monthly (napr. etf, gold)
  // - Ak má oboje > 0 → postačuje jeden (napr. crypto)
  
  const meetsLump = profile.lumpSumEur >= min.lumpMin;
  const meetsMonthly = profile.monthlyEur >= min.monthlyMin;
  
  // Ak je monthlyMin = 0, monthly vklad nepostačuje (vyžaduje sa lump)
  if (min.monthlyMin === 0 && min.lumpMin > 0) {
    return meetsLump;
  }
  
  // Ak je lumpMin = 0, lump nepostačuje (vyžaduje sa monthly)
  if (min.lumpMin === 0 && min.monthlyMin > 0) {
    return meetsMonthly;
  }
  
  // Oboje sú > 0 → OR (postačuje jeden)
  return meetsLump || meetsMonthly;
}

/**
 * Získaj info o minimálnych požiadavkách pre UI
 */
export function getAssetMinimumInfo(
  assetKey: keyof typeof ASSET_MINIMUMS
): {
  lumpMin: number;
  monthlyMin: number;
  requiresLumpOnly: boolean;
} {
  const min = ASSET_MINIMUMS[assetKey];
  return {
    lumpMin: min.lumpMin,
    monthlyMin: min.monthlyMin,
    requiresLumpOnly: min.monthlyMin === 0 && min.lumpMin > 0,
  };
}
