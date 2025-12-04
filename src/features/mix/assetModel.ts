/**
 * assetModel.ts - Centrálny zdroj pravdy pre výnosy a riziká aktív
 * 
 * PR-29 ASSET POLICY UPDATE:
 * - Jednotná tabuľka ASSET_PARAMS (expectedReturnPa + riskScore)
 * - Asset parametre SÚ NEZÁVISLÉ od profilu (Conservative/Balanced/Growth)
 * - Profil ovplyvňuje len MIX (váhy aktív), nie ich base yield/risk
 * - IAD depozitné konto (cash): 2% yield / 2 risk (nie 0% hotovosť)
 * 
 * PR-33 FIX C: YIELD CALIBRATION (návrat k UNOTOP výnosom 15-18% p.a.)
 * - ETF: 9% → 11% (baseline svet – aktívne)
 * - dyn: 24% → 36% (dynamické riadenie – hlavný driver rastu)
 * - crypto: 15% → 20% (kryptomeny – volatilné, ale vysoký yield)
 * - bond9: 9% → 9.5% (mierne zvýšenie garantovaných)
 * - Cieľ: Balanced 2600/300/30 → 15-16%, Growth 98100/600/23 → 18-19%
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
 * 
 * PR-33 CALIBRATION: Yields upravené podľa reference scenarios
 */
export const ASSET_PARAMS: Record<
  AssetKey,
  { expectedReturnPa: number; riskScore: number; label: string }
> = {
  cash: {
    expectedReturnPa: 0.03,   // 3% p.a. (↑ z 2% – PR-36: IAD depozitné konto brutto)
    riskScore: 2,             // Fiat + inflácia + inštitúcia (nie 0 riziko!)
    label: "Pracujúca rezerva – IAD depozitné konto",
  },
  gold: {
    expectedReturnPa: 0.07,   // 7% p.a. (↑ z 5% – PR-36: stabilizátor s dlhodobým rastom)
    riskScore: 3,
    label: "Zlato (fyzické)",
  },
  bonds: {
    expectedReturnPa: 0.075,  // 7.5% p.a. (garantovaný dlhopis 5r – nezmenené)
    riskScore: 2,
    label: "Dlhopis 7,5%",
  },
  bond3y9: {
    expectedReturnPa: 0.09,   // 9% p.a. (PR-36: garantovaný dlhopis 3r)
    riskScore: 3,
    label: "Dlhopis 9%",
  },
  etf: {
    expectedReturnPa: 0.12,   // 12% p.a. (↑ z 11% – PR-36: ETF World aktívne spravované)
    riskScore: 6,
    label: "ETF svet – aktívne",
  },
  real: {
    expectedReturnPa: 0.10,   // 10% p.a. (PR-36: Reality / projekt)
    riskScore: 5,
    label: "Reality / projekt",
  },
  crypto: {
    expectedReturnPa: 0.35,   // 35% p.a. (↑ z 20% – PR-36: KRITICKÝ DRIVER pre Growth)
    riskScore: 8,
    label: "Kryptomeny",
  },
  dyn: {
    expectedReturnPa: 0.60,   // 60% p.a. (↑ z 45% – PR-36: ~4% p.m. net, HLAVNÝ DRIVER)
    riskScore: 8,             // PR-34: Rovnaké ako crypto (dyn nie je rizikovejší)
    label: "Dynamické riadenie",
  },
};

/**
 * DEPRECATED: Legacy profile-dependent tables (will be removed after migration)
 * PR-33 FIX C: Yields aktualizované podľa ASSET_PARAMS (11%, 20%, 36%, 9.5%)
 * Kept temporarily for backward compatibility during transition.
 */
export const ASSET_YIELDS: Record<AssetKey, { konzervativny: number; vyvazeny: number; rastovy: number }> = {
  etf: { konzervativny: 0.12, vyvazeny: 0.12, rastovy: 0.12 },      // ↑ z 11% – PR-36
  gold: { konzervativny: 0.07, vyvazeny: 0.07, rastovy: 0.07 },     // ↑ z 5% – PR-36
  crypto: { konzervativny: 0.35, vyvazeny: 0.35, rastovy: 0.35 },   // ↑ z 20% – PR-36
  dyn: { konzervativny: 0.60, vyvazeny: 0.60, rastovy: 0.60 },      // ↑ z 45% – PR-36
  bonds: { konzervativny: 0.075, vyvazeny: 0.075, rastovy: 0.075 },
  bond3y9: { konzervativny: 0.09, vyvazeny: 0.09, rastovy: 0.09 },  // PR-36: 9%
  cash: { konzervativny: 0.03, vyvazeny: 0.03, rastovy: 0.03 },     // ↑ z 2% – PR-36
  real: { konzervativny: 0.10, vyvazeny: 0.10, rastovy: 0.10 },     // PR-36: 10%
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
 * PR-36: Plan Strength Multiplier (sila vášho plánu)
 * 
 * Multiplikátor pre base yields z ASSET_PARAMS.
 * Umožňuje ukázať full potenciál portfólia pri 100% sile plánu.
 * 
 * Hodnoty:
 * - 50%: 0.9× base (konzervatívny scenár)
 * - 75%: 1.0× base (DEFAULT, realistický)
 * - 100%: 1.2× base (VIP / full power scenár)
 * 
 * Používa sa v approxYieldAnnualFromMix() a approxVipYieldFromMix().
 */
export type PlanStrength = 50 | 75 | 100;

export function getPlanStrengthMultiplier(strength: PlanStrength): number {
  switch (strength) {
    case 50:
      return 0.9; // Conservative (bezpečná rezerva)
    case 75:
      return 1.0; // Default (realistický scenár)
    case 100:
      return 1.2; // VIP (full power, agresívne optimalizované)
  }
}

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
 * PR-36: Pridáva planStrength multiplikátor (50% / 75% / 100%).
 * 
 * @param mix - Mix aktív s percentami
 * @param _riskPref - DEPRECATED (kept for backward compatibility, not used)
 * @param planStrength - Sila plánu (50 | 75 | 100), default 75% = 1.0×
 * @returns Ročný výnos ako desatinné číslo (napr. 0.12 = 12%)
 */
export function approxYieldAnnualFromMix(
  mix: MixItem[],
  _riskPref?: RiskPref,
  planStrength: PlanStrength = 75
): number {
  if (!Array.isArray(mix) || mix.length === 0) return 0.04;

  const totalPct = mix.reduce((sum, m) => sum + m.pct, 0);
  if (totalPct < 1) return 0.04; // Nulový mix → fallback

  // PR-36: Aplikuj plan strength multiplikátor
  const multiplier = getPlanStrengthMultiplier(planStrength);

  let weightedYield = 0;
  for (const item of mix) {
    const assetParams = ASSET_PARAMS[item.key];
    if (assetParams) {
      weightedYield += (item.pct / 100) * assetParams.expectedReturnPa;
    }
  }

  return weightedYield * multiplier;
}

/**
 * PR-36: VIP yield = plan strength 100% (1.2× base yields)
 * 
 * Alias pre approxYieldAnnualFromMix(mix, undefined, 100).
 * Ukáže maximálny potenciál portfólia (full power scenár).
 * 
 * @param mix - Mix aktív s percentami
 * @returns VIP ročný výnos ako desatinné číslo (napr. 0.24 = 24%)
 */
export function approxVipYieldFromMix(mix: MixItem[]): number {
  return approxYieldAnnualFromMix(mix, undefined, 100);
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
