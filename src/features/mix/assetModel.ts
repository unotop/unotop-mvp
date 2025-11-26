/**
 * assetModel.ts - Centrálny zdroj pravdy pre výnosy a riziká aktív
 * 
 * PR-29 ASSET POLICY UPDATE:
 * - Jednotná tabuľka ASSET_PARAMS (expectedReturnPa + riskScore)
 * - Asset parametre SÚ NEZÁVISLÉ od profilu (Conservative/Balanced/Growth)
 * - Profil ovplyvňuje len MIX (váhy aktív), nie ich base yield/risk
 * - IAD depozitné konto (cash): 2% yield / 2 risk (nie 0% hotovosť)
 */

import type { MixItem } from "./mix.service";

export type RiskPref = "konzervativny" | "vyvazeny" | "rastovy";
export type AssetKey = MixItem["key"];

/**
 * ASSET_PARAMS - Single Source of Truth pre všetky aktíva
 * 
 * Každé aktívum má:
 * - expectedReturnPa: Očakávaný nominálny výnos p.a. (pred infláciou)
 * - riskScore: Riziko 0-10 (vstupuje do risk výpočtu)
 * - label: Názov v UI (pre IAD DK, Reality, atď.)
 * 
 * ADVISOR VERDIKT PR-29:
 * - Yield a risk SÚ FIXNÉ pre každé aktívum
 * - Profil/stage ovplyvňuje MIX, nie asset params
 * - Garantuje monotónnosť: viac risky assets → vyšší yield
 */
export const ASSET_PARAMS: Record<
  AssetKey,
  { expectedReturnPa: number; riskScore: number; label: string }
> = {
  cash: {
    expectedReturnPa: 0.02,   // 2% p.a. (IAD depozitné konto brutto)
    riskScore: 2,             // Fiat + inflácia + inštitúcia (nie 0 riziko!)
    label: "Pracujúca rezerva – IAD depozitné konto",
  },
  gold: {
    expectedReturnPa: 0.05,   // 5% p.a.
    riskScore: 3,
    label: "Zlato (fyzické)",
  },
  bonds: {
    expectedReturnPa: 0.075,  // 7.5% p.a. (garantovaný dlhopis 5r)
    riskScore: 2,
    label: "Dlhopis 7,5%",
  },
  bond3y9: {
    expectedReturnPa: 0.09,   // 9% p.a. (dlhopis 3r s mesačným CF)
    riskScore: 3,
    label: "Dlhopis 9%",
  },
  etf: {
    expectedReturnPa: 0.09,   // 9% p.a. (ETF svet – aktívne)
    riskScore: 6,
    label: "ETF svet – aktívne",
  },
  real: {
    expectedReturnPa: 0.11,   // 11% p.a. (Reality / projekt)
    riskScore: 5,
    label: "Reality / projekt",
  },
  crypto: {
    expectedReturnPa: 0.15,   // 15% p.a. (Kryptomeny)
    riskScore: 8,
    label: "Kryptomeny",
  },
  dyn: {
    expectedReturnPa: 0.24,   // 24% p.a. (Dynamické riadenie – anualizované)
    riskScore: 9,
    label: "Dynamické riadenie",
  },
};

/**
 * DEPRECATED: Legacy profile-dependent tables (will be removed after migration)
 * Kept temporarily for backward compatibility during transition.
 */
export const ASSET_YIELDS: Record<AssetKey, { konzervativny: number; vyvazeny: number; rastovy: number }> = {
  etf: { konzervativny: 0.09, vyvazeny: 0.09, rastovy: 0.09 },
  gold: { konzervativny: 0.05, vyvazeny: 0.05, rastovy: 0.05 },
  crypto: { konzervativny: 0.15, vyvazeny: 0.15, rastovy: 0.15 },
  dyn: { konzervativny: 0.24, vyvazeny: 0.24, rastovy: 0.24 },
  bonds: { konzervativny: 0.075, vyvazeny: 0.075, rastovy: 0.075 },
  bond3y9: { konzervativny: 0.09, vyvazeny: 0.09, rastovy: 0.09 },
  cash: { konzervativny: 0.02, vyvazeny: 0.02, rastovy: 0.02 },
  real: { konzervativny: 0.11, vyvazeny: 0.11, rastovy: 0.11 },
};

const ASSET_RISKS: Record<AssetKey, { konzervativny: number; vyvazeny: number; rastovy: number }> = {
  etf: { konzervativny: 6, vyvazeny: 6, rastovy: 6 },
  gold: { konzervativny: 3, vyvazeny: 3, rastovy: 3 },
  crypto: { konzervativny: 8, vyvazeny: 8, rastovy: 8 },
  dyn: { konzervativny: 9, vyvazeny: 9, rastovy: 9 },
  bonds: { konzervativny: 2, vyvazeny: 2, rastovy: 2 },
  bond3y9: { konzervativny: 3, vyvazeny: 3, rastovy: 3 },
  cash: { konzervativny: 2, vyvazeny: 2, rastovy: 2 },
  real: { konzervativny: 5, vyvazeny: 5, rastovy: 5 },
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
 * PR-29: Získaj ročný výnos pre dané aktívum (PROFILE-INDEPENDENT)
 * 
 * BREAKING CHANGE: riskPref parameter je DEPRECATED (kept for compatibility)
 * Asset yield je FIXNÝ, nie profilovo-závislý.
 * 
 * @param key - Asset key (gold, etf, crypto, ...)
 * @param _riskPref - DEPRECATED (kept for backward compatibility, not used)
 * @returns Očakávaný nominálny výnos p.a. (decimal, 0.09 = 9%)
 */
export function getAssetYield(key: AssetKey, _riskPref?: RiskPref): number {
  return ASSET_PARAMS[key]?.expectedReturnPa ?? 0.04; // fallback 4%
}

/**
 * PR-29: Získaj riziko pre dané aktívum (PROFILE-INDEPENDENT)
 * 
 * BREAKING CHANGE: riskPref parameter je DEPRECATED (kept for compatibility)
 * Asset risk je FIXNÝ, nie profilovo-závislý.
 * 
 * @param key - Asset key (gold, etf, crypto, ...)
 * @param _riskPref - DEPRECATED (kept for backward compatibility, not used)
 * @param crisisBias - Zvýšenie rizika pri kríze (default 0; napr. +1 pre crypto/dyn)
 * @returns Risk score 0-10
 */
export function getAssetRisk(key: AssetKey, _riskPref?: RiskPref, crisisBias = 0): number {
  const baseRisk = ASSET_PARAMS[key]?.riskScore ?? 5;
  // Crisis bias sa aplikuje len na volatilné aktíva (crypto, dyn)
  if (crisisBias > 0 && (key === "crypto" || key === "dyn")) {
    return Math.min(10, baseRisk + crisisBias);
  }
  return baseRisk;
}

/**
 * Škálovanie rizika pri vysokej alokácii (diverzifikačná ochrana)
 * 
 * Pravidlá:
 * 
 * **Dynamické riadenie** (prísnejšie limity):
 * - 0-11%:   base risk
 * - 11-21%:  base risk + 2
 * - 21-31%:  base risk + 4
 * - 31%+:    base risk + 4 + exponenciálny rast
 * 
 * **Ostatné aktíva**:
 * - 0-30%:   base risk
 * - 30-40%:  base risk + 2 (high concentration warning)
 * - 40%+:    base risk + 4 + exponenciálny rast
 * 
 * @param assetKey - Kľúč aktíva
 * @param allocationPct - Alokácia v % (0-100)
 * @param baseRisk - Základné riziko aktíva
 * @returns Škálované riziko (max 15)
 */
export function getScaledRisk(
  assetKey: AssetKey,
  allocationPct: number,
  baseRisk: number
): number {
  // Dynamické riadenie má prísnejšie pásma
  if (assetKey === "dyn") {
    if (allocationPct <= 11) return baseRisk;
    if (allocationPct <= 21) return baseRisk + 2;
    if (allocationPct <= 31) return baseRisk + 4;
    // 31%+: exponenciálne
    const excess = allocationPct - 31;
    return Math.min(15, baseRisk + 4 + excess * 0.5);
  }

  // Všetky ostatné aktíva
  if (allocationPct <= 30) return baseRisk;
  if (allocationPct <= 40) return baseRisk + 2;
  // 40%+: exponenciálne
  const excess = allocationPct - 40;
  return Math.min(15, baseRisk + 4 + excess * 0.3);
}

/**
 * PR-29: Vypočítaj vážený ročný výnos z mixu (PROFILE-INDEPENDENT)
 * 
 * BREAKING CHANGE: riskPref parameter je DEPRECATED (kept for compatibility)
 * Výnos je čisto z mixu (Σ weight × ASSET_PARAMS.expectedReturnPa).
 * 
 * @param mix - Mix aktív s percentami
 * @param _riskPref - DEPRECATED (kept for backward compatibility, not used)
 * @returns Ročný výnos ako desatinné číslo (napr. 0.12 = 12%)
 */
export function approxYieldAnnualFromMix(mix: MixItem[], _riskPref?: RiskPref): number {
  if (!Array.isArray(mix) || mix.length === 0) return 0.04;

  const totalPct = mix.reduce((sum, m) => sum + m.pct, 0);
  if (totalPct < 1) return 0.04; // Nulový mix → fallback

  let weightedYield = 0;
  for (const item of mix) {
    const weight = item.pct / 100; // percent → decimal
    const yield_pa = getAssetYield(item.key); // PR-29: No riskPref needed
    weightedYield += weight * yield_pa;
  }

  return weightedYield;
}

/**
 * PR-29: Vypočítaj vážené riziko 0-10 z mixu (PROFILE-INDEPENDENT)
 * 
 * BREAKING CHANGE: riskPref parameter je DEPRECATED (kept for compatibility)
 * Riziko je čisto z mixu (Σ weight × ASSET_PARAMS.riskScore + scaling).
 * 
 * @param mix - Mix aktív s percentami
 * @param _riskPref - DEPRECATED (kept for backward compatibility, not used)
 * @param crisisBias - Pridaj penalizáciu (napr. +1 ak dyn+crypto > 22%)
 * @returns Rizikové skóre 0-10
 */
export function riskScore0to10(mix: MixItem[], _riskPref?: RiskPref, crisisBias = 0): number {
  if (!Array.isArray(mix) || mix.length === 0) return 5.0;

  const totalPct = mix.reduce((sum, m) => sum + m.pct, 0);
  if (totalPct < 1) return 5.0;

  // Penalty: ak dyn+crypto > 22%, pridaj +1 crisis bias
  const dynPct = mix.find((m) => m.key === "dyn")?.pct ?? 0;
  const cryptoPct = mix.find((m) => m.key === "crypto")?.pct ?? 0;
  const penalty = dynPct + cryptoPct > 22 ? 1 : 0;
  const effectiveBias = crisisBias + penalty;

  let weightedRisk = 0;
  for (const item of mix) {
    const weight = item.pct / 100;
    const baseRisk = getAssetRisk(item.key, undefined, effectiveBias); // PR-29: No riskPref
    // Aplikuj škálovanie rizika pri vysokej alokácii
    const scaledRisk = getScaledRisk(item.key, item.pct, baseRisk);
    weightedRisk += weight * scaledRisk;
  }

  return Math.min(10, Math.max(0, weightedRisk));
}

/**
 * Helper: získaj risk cap pre daný profil
 */
export function getRiskCap(riskPref: RiskPref): number {
  return RISK_CAPS[riskPref];
}
