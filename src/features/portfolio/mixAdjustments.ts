/**
 * Mix Adjustments Orchestrator - Kombinuje všetky scaling logiky
 * 
 * Flow:
 * 1. Lump sum scaling (caps risky, boost safe)
 * 2. Monthly scaling (500 EUR cap na dyn+crypto)
 * 3. Cash reserve optimization (dynamická rezerva)
 * 4. Bond minimum handling (2500 EUR threshold)
 * 5. Stage-aware caps enforcement (PR-8: adaptive policy)
 * 
 * Export: Adjusted preset + warnings array pre UI
 */

import type { MixItem } from "../mix/mix.service";
import type { PortfolioPreset } from "./presets";
import type { ReserveProfile } from "./cashReserve";
import type { RiskPref } from "../mix/assetModel";
import type { Stage } from "../policy/stage";

import { normalize } from "../mix/mix.service";
import { riskScore0to10 } from "../mix/assetModel";
import { scaleMixByLumpSum, getLumpSumTierInfo } from "./lumpSumScaling";
import { scaleMixByMonthly, getMonthlyCappingInfo } from "./monthlyScaling";
import { adjustMixForCashReserve, getCashReserveInfo } from "./cashReserve";
import { applyBondMinimum, getBondMinimumInfo } from "./bondMinimum";
import { enforceStageCaps } from "./presets";
import { detectStage } from "../policy/stage";
import { applyMinimums } from "../policy/applyMinimums";
import { getAssetCaps, getDynCryptoComboCap } from "../policy/caps";
import { getAdaptiveRiskCap } from "../policy/risk";
import { isAssetAvailable, type AssetAvailabilityProfile } from "../policy/assetMinimums";

/**
 * PR-13 ULTIMATE: Target Bands - Cieľové rizikové pásma pre každý profil
 * Definujú min-max ako percento z adaptívneho capu
 */
const TARGET_BANDS: Record<RiskPref, { min: number; max: number }> = {
  konzervativny: { min: 0.90, max: 1.00 }, // 90-100% z cap (napr. 4.05-4.5 pri STARTER)
  vyvazeny:      { min: 0.95, max: 1.00 }, // 95-100% z cap (napr. 6.17-6.5 pri STARTER)
  rastovy:       { min: 0.98, max: 1.00 }, // 98-100% z cap (napr. 7.84-8.0 pri STARTER)
};

/**
 * PR-13 ULTIMATE: Max Total Adjustment - Ochrana pred "pumpovaním"
 * Maximálny celkový posun v percentuálnych bodoch pre UP-TUNE
 */
const MAX_TOTAL_ADJUSTMENT: Record<RiskPref, number> = {
  konzervativny: 6,   // Max 6 p.b. celkovo
  vyvazeny: 12,       // Max 12 p.b.
  rastovy: 18,        // Max 18 p.b.
};

/**
 * PR-13 ULTIMATE: Tune Tolerance - Hysteréza pre bi-directional tuner
 * Zabraňuje oscilácii medzi DOWN/UP tune
 */
const TUNE_TOLERANCE = {
  downThreshold: 0.2,  // Štartuj DOWN pri cap + 0.2
  upThreshold: 0.1,    // Štartuj UP pri targetMin - 0.1
};

export interface ProfileForAdjustments {
  lumpSumEur: number;
  monthlyEur: number;
  horizonYears: number;
  // Reserve data
  monthlyIncome: number;
  fixedExpenses: number;
  variableExpenses: number;
  reserveEur: number;
  reserveMonths: number;
  // Goal for stage detection (PR-8)
  goalAssetsEur?: number;
  // Risk preference for stage caps
  riskPref?: RiskPref;
}

export type AdjustmentWarning =
  | "bond-minimum"
  | "lump-sum-scaling"
  | "monthly-capping"
  | "cash-reserve-low"
  | "cash-reserve-high"
  | "risk-target-limited"; // PR-13 ULTIMATE: UP-TUNE nenašiel dostatok rizika

export interface AdjustmentResult {
  mix: MixItem[];
  warnings: AdjustmentWarning[];
  info: {
    lumpSumTier?: ReturnType<typeof getLumpSumTierInfo>;
    monthlyCapping?: ReturnType<typeof getMonthlyCappingInfo>;
    cashReserve?: ReturnType<typeof getCashReserveInfo>;
    bondMinimum?: ReturnType<typeof getBondMinimumInfo>;
  };
}

/**
 * Aplikuj všetky adjustments na preset mix
 */
export function getAdjustedMix(
  baseMix: MixItem[],
  profile: ProfileForAdjustments
): AdjustmentResult {
  let mix = [...baseMix];
  const warnings: AdjustmentWarning[] = [];
  const info: AdjustmentResult["info"] = {};

  // === STEP 1: Bond minimum handling (FIRST!) ===
  // Musí byť prvý, aby sme vedeli reálnu alokáciu pred scaling
  const { mix: mixAfterBonds, bondWarning } = applyBondMinimum(
    mix,
    profile.lumpSumEur,
    profile.monthlyEur,
    profile.horizonYears
  );
  mix = mixAfterBonds;

  if (bondWarning) {
    warnings.push("bond-minimum");
    const bondInfo = getBondMinimumInfo(
      profile.lumpSumEur,
      profile.monthlyEur
    );
    if (bondInfo) {
      info.bondMinimum = bondInfo;
    }
  }

  // === STEP 2: Lump sum scaling ===
  mix = scaleMixByLumpSum(mix, profile.lumpSumEur);
  const lumpSumTier = getLumpSumTierInfo(profile.lumpSumEur);
  if (lumpSumTier?.applied) {
    warnings.push("lump-sum-scaling");
    info.lumpSumTier = lumpSumTier;
  }

  // === STEP 3: Monthly scaling ===
  const baseMixBeforeMonthly = [...mix];
  mix = scaleMixByMonthly(mix, profile.monthlyEur);
  const monthlyCapping = getMonthlyCappingInfo(
    baseMixBeforeMonthly,
    profile.monthlyEur
  );
  if (monthlyCapping?.applied) {
    warnings.push("monthly-capping");
    info.monthlyCapping = monthlyCapping;
  }

  // === STEP 4: Cash reserve optimization ===
  const baseMixBeforeCash = [...mix];
  mix = adjustMixForCashReserve(
    mix,
    {
      monthlyIncome: profile.monthlyIncome,
      fixedExpenses: profile.fixedExpenses,
      variableExpenses: profile.variableExpenses,
      reserveEur: profile.reserveEur,
      reserveMonths: profile.reserveMonths,
    },
    profile.lumpSumEur,
    profile.monthlyEur,
    profile.horizonYears
  );

  const totalPortfolioEur =
    profile.lumpSumEur + profile.monthlyEur * 12 * profile.horizonYears;
  const currentCashPct = baseMixBeforeCash.find((m) => m.key === "cash")?.pct || 0;
  const cashReserveInfo = getCashReserveInfo(
    {
      monthlyIncome: profile.monthlyIncome,
      fixedExpenses: profile.fixedExpenses,
      variableExpenses: profile.variableExpenses,
      reserveEur: profile.reserveEur,
      reserveMonths: profile.reserveMonths,
    },
    totalPortfolioEur,
    currentCashPct
  );

  if (cashReserveInfo.needsAdjustment) {
    if (cashReserveInfo.current < cashReserveInfo.optimal) {
      warnings.push("cash-reserve-low");
    } else {
      warnings.push("cash-reserve-high");
    }
    info.cashReserve = cashReserveInfo;
  }

  // === STEP 5: Apply asset minimums (PR-12/PR-13) ===
  // Presunie nedostupné aktíva do ETF/hotovosti (alebo gold/cash pre konzervativny)
  const riskPref = profile.riskPref || "vyvazeny"; // fallback
  const { mix: mixAfterMinimums } = applyMinimums(mix, {
    lumpSumEur: profile.lumpSumEur,
    monthlyEur: profile.monthlyEur,
    monthlyIncome: profile.monthlyIncome,
  }, riskPref);
  mix = mixAfterMinimums;

  // === STEP 5.5: Bi-directional Risk Tuner (PR-13 ULTIMATE) ===
  // A) DOWN-TUNE: Zníži riziko pod cap, ak je príliš vysoké
  // B) UP-TUNE: Zvýši riziko k cieľovému pásmu, ak je príliš nízke
  
  const stage = detectStage(
    profile.lumpSumEur,
    profile.monthlyEur,
    profile.horizonYears,
    profile.goalAssetsEur
  );
  const riskCap = getAdaptiveRiskCap(riskPref, stage);
  const stageCaps = getAssetCaps(riskPref, stage);
  
  // Konvertuj Caps na Record<string, number> pre tuner
  const stageCapsMap: Record<string, number> = {};
  for (const [key, val] of Object.entries(stageCaps)) {
    if (val !== undefined) stageCapsMap[key] = val;
  }
  
  // Vypočítaj cieľové pásmo
  const targetBand = TARGET_BANDS[riskPref];
  const targetMin = riskCap * targetBand.min;
  const targetMax = riskCap * targetBand.max;
  
  // Aktuálne riziko pred tuningom
  let currentRisk = riskScore0to10(mix, riskPref);
  
  // STEP 5.5A: DOWN-TUNE (ak risk > cap + tolerance)
  if (currentRisk > riskCap + TUNE_TOLERANCE.downThreshold) {
    mix = downTuneRisk(mix, riskCap, riskPref, stageCapsMap);
    currentRisk = riskScore0to10(mix, riskPref); // Refresh
  }
  
  // STEP 5.5B: UP-TUNE (ak risk < targetMin - tolerance)
  if (currentRisk < targetMin - TUNE_TOLERANCE.upThreshold) {
    const maxAdjustment = MAX_TOTAL_ADJUSTMENT[riskPref];
    mix = upTuneRisk(mix, targetMin, riskPref, stage, stageCapsMap, profile, maxAdjustment);
    currentRisk = riskScore0to10(mix, riskPref); // Refresh
    
    // Ak stále pod targetMin → info chip
    if (currentRisk < targetMin) {
      warnings.push("risk-target-limited");
    }
  }

  // === STEP 6: Stage-aware caps enforcement (PR-8) ===
  // Detekuj stage a aplikuj adaptive caps
  mix = enforceStageCaps(mix, riskPref, stage);

  return { mix: normalize(mix), warnings, info };
}

/**
 * PR-13 ULTIMATE: UP-TUNE - Zvýši riziko mixu k cieľovému pásmu
 * 
 * Stratégia (inverz k DOWN-TUNE):
 * 1. Ber z: cash → bonds → gold (bezpečné aktíva, priority 1→2→3)
 * 2. Daj do: ETF → dyn → real (rizikové aktíva s vyšším výnosom, priority 1→2→3)
 * 3. Krokuj po 0.5 p.b., prepočítaj risk po každom kroku
 * 4. Zastav pri: risk >= targetMin || totalMoved >= maxAdjustment || niet odkiaľ brať
 * 
 * Guardrails:
 * - dyn: dostupný len ak lump >= 1000 && dyn+crypto < combo cap
 * - real: dostupný len ak lump >= 300k || income >= 3500
 * - ETF: vždy dostupný
 * - Rešpektuj stage capy pre všetky aktíva
 * 
 * @param baseMix - Mix po downTuneRisk (ak bol aplikovaný)
 * @param targetMin - Dolná hranica cieľového pásma
 * @param riskPref - Rizikový profil pre výpočet risk score
 * @param stage - Investičný stage (pre combo cap a asset availability)
 * @param stageCaps - Stage capy (pre kontrolu room)
 * @param profile - Profil investora (pre asset availability)
 * @param maxAdjustment - Max celkový posun v p.b. (anti-pumping)
 * @returns Mix s risk ≈ targetMin (ak možné)
 */
function upTuneRisk(
  baseMix: MixItem[],
  targetMin: number,
  riskPref: RiskPref,
  stage: Stage,
  stageCaps: Record<string, number>,
  profile: ProfileForAdjustments,
  maxAdjustment: number
): MixItem[] {
  let mix = [...baseMix];
  let risk = riskScore0to10(mix, riskPref);

  // Už splnené → skip
  if (risk >= targetMin) return mix;

  // Poradie zdrojov (bezpečné aktíva)
  const sources: Array<MixItem["key"]> = ["cash", "bonds", "gold"];
  
  // Poradie cieľov (rizikové aktíva) - overíme dostupnosť
  const potentialTargets: Array<MixItem["key"]> = ["etf", "dyn", "real"];

  // Helper: získaj pct aktíva
  const getPct = (key: MixItem["key"]): number =>
    mix.find((m) => m.key === key)?.pct ?? 0;

  // Helper: nastav pct aktíva
  const setPct = (key: MixItem["key"], val: number) => {
    const idx = mix.findIndex((m) => m.key === key);
    if (idx !== -1) {
      mix[idx] = { ...mix[idx], pct: Math.max(0, Math.min(100, val)) };
    }
  };

  // Helper: získaj voľný priestor v cap
  const getRoomForAsset = (key: MixItem["key"]): number => {
    const currentPct = getPct(key);
    const capLimit = stageCaps[key] ?? 100;
    return Math.max(0, capLimit - currentPct);
  };

  // Helper: overenie dostupnosti cieľového aktíva
  const isTargetAvailable = (key: MixItem["key"]): boolean => {
    if (key === "etf") return true; // ETF vždy dostupný
    
    if (key === "dyn") {
      // UP-TUNE: applyMinimums už aplikoval lump >= 1000 check (STEP 5)
      // Tu len overíme combo cap (dyn+crypto limit podľa stage)
      const comboCap = getDynCryptoComboCap(stage);
      const currentDyn = getPct("dyn");
      const currentCrypto = getPct("crypto");
      return (currentDyn + currentCrypto) < comboCap; // Je priestor?
    }
    
    if (key === "real") {
      // real: lump >= 300k || income >= 3500
      return profile.lumpSumEur >= 300000 || profile.monthlyIncome >= 3500;
    }
    
    return false;
  };

  // Filter dostupných cieľov
  const targets = potentialTargets.filter(isTargetAvailable);
  
  // Ak niet cieľov → skip
  if (targets.length === 0) return mix;

  const STEP = 0.5; // 0.5 p.b. krok
  const MAX_ITERATIONS = 200; // failsafe
  let iterations = 0;
  let totalMoved = 0; // Anti-pumping tracker

  while (risk < targetMin && totalMoved < maxAdjustment && iterations < MAX_ITERATIONS) {
    iterations++;
    let moved = false;

    for (const srcKey of sources) {
      const srcPct = getPct(srcKey);
      if (srcPct < STEP) continue; // Nedostatok zdroja

      const moveAmount = Math.min(STEP, srcPct, maxAdjustment - totalMoved);
      if (moveAmount <= 0) break; // Max adjustment dosiahnutý

      setPct(srcKey, srcPct - moveAmount);

      // Rozdeľ rovnomerne medzi dostupné ciele (proporcionálne podľa room)
      const totalRoom = targets.reduce((sum, key) => sum + getRoomForAsset(key), 0);
      
      if (totalRoom > 0) {
        for (const tgtKey of targets) {
          const room = getRoomForAsset(tgtKey);
          const allocation = (room / totalRoom) * moveAmount;
          const tgtPct = getPct(tgtKey);
          setPct(tgtKey, tgtPct + allocation);
        }
      } else {
        // Žiadny room → vráť späť
        setPct(srcKey, srcPct);
        break;
      }

      // Normalize
      mix = normalize(mix);

      // Prepočítaj risk
      risk = riskScore0to10(mix, riskPref);
      totalMoved += moveAmount;
      moved = true;

      if (risk >= targetMin || totalMoved >= maxAdjustment) break; // Hotovo
    }

    if (!moved) break; // Niet odkiaľ brať → failsafe exit
  }

  return mix;
}

/**
 * PR-13 ULTIMATE: DOWN-TUNE - Zníži riziko mixu pod cap
 * 
 * Stratégia:
 * 1. Ber z: etf → real → gold (rizikovejšie aktíva)
 * 2. Daj do: gold(60%) + cash(40%) (miernejšie aktíva)
 * 3. Krokuj po 0.5 p.b., prepočítaj risk po každom kroku
 * 4. Zastav, keď risk <= cap alebo už niet odkiaľ brať
 * 
 * @param baseMix - Mix po applyMinimums
 * @param cap - Cieľový risk cap
 * @param riskPref - Rizikový profil pre výpočet risk score
 * @param stageCaps - Stage capy (pre kontrolu room)
 * @returns Mix s risk <= cap
 */
function downTuneRisk(
  baseMix: MixItem[],
  cap: number,
  riskPref: RiskPref,
  stageCaps: Record<string, number>
): MixItem[] {
  let mix = [...baseMix];
  let risk = riskScore0to10(mix, riskPref);

  // Už splnené → skip
  if (risk <= cap) return mix;

  // Poradie zdrojov (rizikovejšie)
  const sources: Array<MixItem["key"]> = ["etf", "real", "gold"];
  // Poradie cieľov (miernejšie) + ratio
  const targets: Array<[MixItem["key"], number]> = [
    ["gold", 0.6],
    ["cash", 0.4],
  ];

  // Helper: získaj pct aktíva
  const getPct = (key: MixItem["key"]): number =>
    mix.find((m) => m.key === key)?.pct ?? 0;

  // Helper: nastav pct aktíva
  const setPct = (key: MixItem["key"], val: number) => {
    const idx = mix.findIndex((m) => m.key === key);
    if (idx !== -1) {
      mix[idx] = { ...mix[idx], pct: Math.max(0, Math.min(100, val)) };
    }
  };

  // Helper: získaj voľný priestor v cap
  const getRoomForAsset = (key: MixItem["key"]): number => {
    const currentPct = getPct(key);
    const capLimit = stageCaps[key] ?? 100;
    return Math.max(0, capLimit - currentPct);
  };

  const STEP = 0.5; // 0.5 p.b. krok
  const MAX_ITERATIONS = 200; // failsafe
  let iterations = 0;

  while (risk > cap && iterations < MAX_ITERATIONS) {
    iterations++;
    let moved = false;

    for (const srcKey of sources) {
      const srcPct = getPct(srcKey);
      if (srcPct < STEP) continue; // Nedostatok zdroja

      const moveAmount = Math.min(STEP, srcPct);
      setPct(srcKey, srcPct - moveAmount);

      // Rozdeľ do cieľov
      for (const [tgtKey, ratio] of targets) {
        const room = getRoomForAsset(tgtKey);
        const allocation = Math.min(moveAmount * ratio, room);
        const tgtPct = getPct(tgtKey);
        setPct(tgtKey, tgtPct + allocation);
      }

      // Normalize
      mix = normalize(mix);

      // Prepočítaj risk
      risk = riskScore0to10(mix, riskPref);
      moved = true;

      if (risk <= cap) break; // Hotovo
    }

    if (!moved) break; // Niet odkiaľ brať → failsafe exit
  }

  return mix;
}

/**
 * Wrapper pre ľahšie volanie z presets.ts
 */
export function getAdjustedPreset(
  preset: PortfolioPreset,
  profile: ProfileForAdjustments
): { preset: PortfolioPreset; warnings: AdjustmentWarning[]; info: AdjustmentResult["info"] } {
  const { mix, warnings, info } = getAdjustedMix(preset.mix, profile);

  return {
    preset: { ...preset, mix },
    warnings,
    info,
  };
}
