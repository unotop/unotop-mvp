/**
 * assetModel.ts - Centrálny zdroj pravdy pre výnosy a riziká aktív
 * Všetky výnosy sú p.a. (per annum), riziko je 0-10 škála
 */

import type { MixItem } from "./mix.service";

export type RiskPref = "konzervativny" | "vyvazeny" | "rastovy";
export type AssetKey = MixItem["key"];

/**
 * Výnosy p.a. pre každé aktívum × profil
 * Formát: { konzervativny, vyvazeny, rastovy }
 */
const ASSET_YIELDS: Record<AssetKey, { konzervativny: number; vyvazeny: number; rastovy: number }> = {
  etf: { konzervativny: 0.09, vyvazeny: 0.14, rastovy: 0.18 },
  gold: { konzervativny: 0.07, vyvazeny: 0.095, rastovy: 0.11 },
  crypto: { konzervativny: 0.12, vyvazeny: 0.20, rastovy: 0.35 },
  // Dynamické riadenie: mesačne 2/3/4 % → anualizované ((1+m)^12 - 1)
  dyn: {
    konzervativny: Math.pow(1 + 0.02, 12) - 1, // ~26.82 %
    vyvazeny: Math.pow(1 + 0.03, 12) - 1,      // ~42.58 %
    rastovy: Math.pow(1 + 0.04, 12) - 1,       // ~60.10 %
  },
  bonds: { konzervativny: 0.075, vyvazeny: 0.075, rastovy: 0.075 }, // Garantovaný 7.5 %
  cash: { konzervativny: 0.0, vyvazeny: 0.0, rastovy: 0.0 },
  real: { konzervativny: 0.075, vyvazeny: 0.087, rastovy: 0.095 },
  other: { konzervativny: 0.04, vyvazeny: 0.05, rastovy: 0.06 }, // Default conservative estimate
};

/**
 * Riziko 0-10 pre každé aktívum × profil
 * Niektoré aktíva majú konštantné riziko, iné sa líšia podľa profilu
 */
const ASSET_RISKS: Record<AssetKey, { konzervativny: number; vyvazeny: number; rastovy: number }> = {
  etf: { konzervativny: 5, vyvazeny: 5, rastovy: 6 },
  gold: { konzervativny: 2, vyvazeny: 2, rastovy: 3 },
  crypto: { konzervativny: 9, vyvazeny: 9, rastovy: 9 },
  dyn: { konzervativny: 8, vyvazeny: 9, rastovy: 9 },
  bonds: { konzervativny: 2, vyvazeny: 2, rastovy: 2 },
  cash: { konzervativny: 2, vyvazeny: 2, rastovy: 2 },
  real: { konzervativny: 4, vyvazeny: 4, rastovy: 5 },
  other: { konzervativny: 3, vyvazeny: 4, rastovy: 5 },
};

/**
 * Risk cap podľa preferencie (max prípustné riziko)
 */
export const RISK_CAPS: Record<RiskPref, number> = {
  konzervativny: 4.0,
  vyvazeny: 6.0,
  rastovy: 7.5,
};

/**
 * Získaj ročný výnos pre dané aktívum a profil
 */
export function getAssetYield(key: AssetKey, riskPref: RiskPref): number {
  return ASSET_YIELDS[key]?.[riskPref] ?? 0.04; // fallback 4 %
}

/**
 * Získaj riziko 0-10 pre dané aktívum a profil
 * @param crisisBias - Zvýšenie rizika pri kríze (default 0; napr. +1 pre crypto/dyn)
 */
export function getAssetRisk(key: AssetKey, riskPref: RiskPref, crisisBias = 0): number {
  const baseRisk = ASSET_RISKS[key]?.[riskPref] ?? 5;
  // Crisis bias sa aplikuje len na volatilné aktíva (crypto, dyn)
  if (crisisBias > 0 && (key === "crypto" || key === "dyn")) {
    return Math.min(10, baseRisk + crisisBias);
  }
  return baseRisk;
}

/**
 * Vypočítaj vážený ročný výnos z mixu
 * @returns Ročný výnos ako desatinné číslo (napr. 0.12 = 12 %)
 */
export function approxYieldAnnualFromMix(mix: MixItem[], riskPref: RiskPref): number {
  if (!Array.isArray(mix) || mix.length === 0) return 0.04;

  const totalPct = mix.reduce((sum, m) => sum + m.pct, 0);
  if (totalPct < 1) return 0.04; // Nulový mix → fallback

  let weightedYield = 0;
  for (const item of mix) {
    const weight = item.pct / 100; // percent → decimal
    const yield_pa = getAssetYield(item.key, riskPref);
    weightedYield += weight * yield_pa;
  }

  return weightedYield;
}

/**
 * Vypočítaj vážené riziko 0-10 z mixu
 * @param crisisBias - Pridaj penalizáciu (napr. +1 ak dyn+crypto > 22 %)
 * @returns Rizikové skóre 0-10
 */
export function riskScore0to10(mix: MixItem[], riskPref: RiskPref, crisisBias = 0): number {
  if (!Array.isArray(mix) || mix.length === 0) return 5.0;

  const totalPct = mix.reduce((sum, m) => sum + m.pct, 0);
  if (totalPct < 1) return 5.0;

  // Penalty: ak dyn+crypto > 22 %, pridaj +1 crisis bias
  const dynPct = mix.find((m) => m.key === "dyn")?.pct ?? 0;
  const cryptoPct = mix.find((m) => m.key === "crypto")?.pct ?? 0;
  const penalty = dynPct + cryptoPct > 22 ? 1 : 0;
  const effectiveBias = crisisBias + penalty;

  let weightedRisk = 0;
  for (const item of mix) {
    const weight = item.pct / 100;
    const risk = getAssetRisk(item.key, riskPref, effectiveBias);
    weightedRisk += weight * risk;
  }

  return Math.min(10, Math.max(0, weightedRisk));
}

/**
 * Helper: získaj risk cap pre daný profil
 */
export function getRiskCap(riskPref: RiskPref): number {
  return RISK_CAPS[riskPref];
}
