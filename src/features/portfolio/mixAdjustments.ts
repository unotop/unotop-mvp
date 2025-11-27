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
import { applyCashCap, getCashCapInfo, getCashCap } from "./cashCapPolicy"; // PR-27: Cash cap policy
import { enforceStageCaps } from "./presets";
import { detectStage } from "../policy/stage";
import { applyMinimums } from "../policy/applyMinimums";
import { getAssetCaps, getDynCryptoComboCap } from "../policy/caps";
import { getAdaptiveRiskCap, getRiskMax } from "../policy/risk"; // PR-28: riskMax
import { isAssetAvailable, type AssetAvailabilityProfile } from "../policy/assetMinimums";
import { 
  calculateEffectivePlanVolume, 
  applyAssetMinima, 
  type AssetMinimaResult 
} from "./assetMinima"; // PR-28: Asset minima policy
import { enforceRiskCap, type EnforceRiskCapResult } from "./enforceRiskCap"; // PR-28: Risk cap enforcement
import { ensureProfileHierarchy } from "./ensureProfileHierarchy"; // PR-30: Profile hierarchy
import { applyProfileAssetPolicy } from "../policy/profileAssetPolicy"; // PR-31: Profile asset policy
import { optimizeYield, type YieldOptimizerResult } from "./yieldOptimizer"; // PR-31: Yield optimizer
import { getGoldPolicy } from "../policy/profileAssetPolicy"; // PR-34: Gold policy caps

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

/**
 * PR-34: Global hard caps (musí byť sync s yieldOptimizer.ts)
 */
const GLOBAL_HARD_CAPS: Record<string, number> = {
  gold: 40,
  etf: 50,
  dyn: 22,
  crypto: 8,
};

/**
 * PR-34: Finálny normalize & clamp krok (posledná obrana pred validáciou)
 * 
 * Kroky:
 * 1. Zaokrúhli všetky váhy na 2 des. miesta
 * 2. Clamp všetky assets ktoré presahujú caps:
 *    - gold ≤ min(GOLD_POLICY.hardCap, GLOBAL_HARD_CAPS.gold)
 *    - ETF ≤ GLOBAL_HARD_CAPS.etf
 *    - dyn ≤ GLOBAL_HARD_CAPS.dyn
 *    - crypto ≤ GLOBAL_HARD_CAPS.crypto
 * 3. Fix súčet:
 *    - Ak < 100%: doplň do IAD/bonds podľa profilu
 *    - Ak > 100%: uberie z najrizikovejších (dyn, crypto, ETF)
 */
function normalizeAndClampMix(mix: MixItem[], riskPref: RiskPref, maxRiskForOptimizer: number): MixItem[] {
  const goldPolicy = getGoldPolicy(riskPref);

  // STEP 1: Zaokrúhli na 2 des. miesta
  mix.forEach((item) => {
    item.pct = Math.round(item.pct * 100) / 100;
  });

  // STEP 2: Clamp assets ktoré presahujú caps
  let totalOverflow = 0;

  for (const item of mix) {
    let cap: number | undefined;

    if (item.key === "gold") {
      cap = Math.min(goldPolicy.hardCap, GLOBAL_HARD_CAPS.gold);
    } else if (item.key === "etf") {
      cap = GLOBAL_HARD_CAPS.etf;
    } else if (item.key === "dyn") {
      cap = GLOBAL_HARD_CAPS.dyn;
    } else if (item.key === "crypto") {
      cap = GLOBAL_HARD_CAPS.crypto;
    }

    if (cap !== undefined && item.pct > cap) {
      const overflow = item.pct - cap;
      item.pct = cap;
      totalOverflow += overflow;
      console.log(`[MixAdjustments Clamp] ${item.key} ${(cap + overflow).toFixed(1)}% → ${cap}%`);
    }
  }

  // STEP 3: Fix súčet
  const currentSum = mix.reduce((sum, item) => sum + item.pct, 0);

  if (Math.abs(currentSum - 100) > 0.1) {
    if (currentSum < 100) {
      // Doplň do IAD/bonds
      const deficit = 100 - currentSum;
      const safetySinks =
        riskPref === "konzervativny"
          ? [
              { key: "bond3y9", weight: 0.6 },
              { key: "bonds", weight: 0.4 },
            ]
          : riskPref === "vyvazeny"
          ? [
              { key: "bonds", weight: 0.55 },
              { key: "bond3y9", weight: 0.45 },
            ]
          : [
              { key: "bonds", weight: 0.6 },
              { key: "bond3y9", weight: 0.4 },
            ];

      for (const sink of safetySinks) {
        const sinkItem = mix.find((m) => m.key === sink.key);
        if (sinkItem) {
          sinkItem.pct += deficit * sink.weight;
        }
      }

      console.log(`[MixAdjustments Clamp] Deficit ${deficit.toFixed(2)}% → redistributed to safety sinks`);
    } else {
      // Uberie z najrizikovejších (dyn > crypto > ETF)
      const surplus = currentSum - 100;
      const riskySources = ["dyn", "crypto", "etf"];

      for (const key of riskySources) {
        const item = mix.find((m) => m.key === key);
        if (item && item.pct > 0) {
          const cut = Math.min(surplus, item.pct);
          item.pct -= cut;
          console.log(`[MixAdjustments Clamp] Surplus ${surplus.toFixed(2)}%: cut ${key} -${cut.toFixed(2)}%`);
          break; // Cut from first available risky asset
        }
      }
    }
  }

  // STEP 4: Final normalize (ensure exact 100%)
  return normalize(mix);
}

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
  | "risk-target-limited" // PR-13 ULTIMATE: UP-TUNE nenašiel dostatok rizika
  | "cash-cap-exceeded" // PR-27: Hotovosť presahuje profil limit
  | "conservative-risk-elevated" // PR-27: Konzervatívny profil blízko vyváženého
  | "asset-minima-locked" // PR-28: Assety zamknuté kvôli effectivePlanVolume
  | "risk-cap-enforced"; // PR-28: Riziko znížené na riskMax

export interface AdjustmentResult {
  mix: MixItem[];
  warnings: AdjustmentWarning[];
  info: {
    lumpSumTier?: ReturnType<typeof getLumpSumTierInfo>;
    monthlyCapping?: ReturnType<typeof getMonthlyCappingInfo>;
    cashReserve?: ReturnType<typeof getCashReserveInfo>;
    bondMinimum?: ReturnType<typeof getBondMinimumInfo>;
    assetMinima?: {
      effectivePlanVolume: number;
      eligibility: AssetMinimaResult["eligibility"];
      totalRealloc: number;
    };
    riskCapEnforcement?: {
      initialRisk: number;
      finalRisk: number;
      iterations: number;
      riskMax: number;
    };
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

  // === STEP 4: Asset Minima Eligibility (PR-28) ===
  // Aplikuje PRED asset minimums scaling (STEP 5)
  // Assety, ktoré nesplňajú effectivePlanVolume, sa vynulujú a prerozdelí do gold/ETF
  const effectivePlanVolume = calculateEffectivePlanVolume(
    profile.lumpSumEur,
    profile.monthlyEur,
    profile.horizonYears
  );
  
  const riskPref = profile.riskPref || "vyvazeny"; // Definuj riskPref skôr
  
  const assetMinimaResult: AssetMinimaResult = applyAssetMinima(
    mix,
    riskPref,
    effectivePlanVolume
  );
  mix = assetMinimaResult.mix;

  if (assetMinimaResult.applied) {
    console.log(
      `[MixAdjustments] Asset minima applied: ${assetMinimaResult.totalRealloc.toFixed(1)}% reallocated (effectivePlanVolume ${effectivePlanVolume.toFixed(0)} €)`
    );
    warnings.push("asset-minima-locked");
    info.assetMinima = {
      effectivePlanVolume,
      eligibility: assetMinimaResult.eligibility,
      totalRealloc: assetMinimaResult.totalRealloc,
    };
  }

  // === STEP 5: Apply asset minimums (PR-12/PR-13) ===
  // Presunie nedostupné aktíva do ETF/hotovosti (alebo gold/cash pre konzervativny)
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

  // === STEP 5.6: Conservative Risk Guardrail (PR-27) ===
  // Konzervatívny profil NESMIE mať riziko >= vyvážený
  // Tolerancia: max +1.0 bodu nad vyvážený
  if (riskPref === "konzervativny") {
    const guardrailResult = enforceConservativeRiskGuard(
      mix,
      profile,
      stage,
      stageCapsMap
    );
    mix = guardrailResult.mix;

    if (guardrailResult.elevated) {
      warnings.push("conservative-risk-elevated");
    }
  }

  // === STEP 6: Stage-aware caps enforcement (PR-8) ===
  // Detekuj stage a aplikuj adaptive caps
  mix = enforceStageCaps(mix, riskPref, stage);

  // === STEP 7: Final Cash Cap Enforcement (PR-27b) ===
  // KRITICKÝ FIX: Cash cap sa musí aplikovať PO všetkých tuning krokoch
  // Dôvod: UP-TUNE a DOWN-TUNE môžu zvýšiť cash nad limit
  // Tento krok garantuje HARD LIMIT bez ohľadu na predchádzajúce úpravy
  // PR-27b FIX: Predáme stageCapsMap, aby reallokácia rešpektovala gold/ETF limity
  const finalCashCapResult = applyCashCap(mix, riskPref, stageCapsMap);
  mix = finalCashCapResult.mix;

  if (finalCashCapResult.applied) {
    console.log(
      `[MixAdjustments] FINAL Cash cap applied: ${finalCashCapResult.excessCash.toFixed(1)}% reallocated (${finalCashCapResult.goldAdded.toFixed(1)}% gold + ${finalCashCapResult.etfAdded.toFixed(1)}% ETF)`
    );
    // Warning už bol pridaný v STEP 4.5 (ak sa tam aplikoval)
    if (!warnings.includes("cash-cap-exceeded")) {
      warnings.push("cash-cap-exceeded");
    }
  }

  // === STEP 7.5: Profile Asset Policy (PR-31) ===
  // Aplikuj profile-aware asset caps PRED enforceRiskCap
  // Zabezpečuje logické rozdelenie high-yield aktív medzi profily
  // Conservative ≥100k: dyn max 10%, bond9 max 25%
  // Balanced ≥100k: dyn max 10%, crypto max 7%
  // Growth ≥100k: dyn max 20%, crypto max 10%
  console.log(`[MixAdjustments] STEP 7.5: Applying profile asset policy...`);
  const policyResult = applyProfileAssetPolicy(mix, riskPref, effectivePlanVolume);
  mix = policyResult.mix;

  if (policyResult.adjustedAssets.length > 0) {
    console.log(
      `[MixAdjustments] Profile policy applied: ${policyResult.adjustedAssets.join(", ")} capped`
    );
    // Info pre debug (nie warning - je to normálne správanie)
  }

  // PR-31 FIX: Yield optimizer MOVED to STEP 10 (after enforceRiskCap)
  // Dôvod: Growth profil môže mať risk > riskMax pred enforceRiskCap,
  // čo by spôsobilo SKIP optimizéra (neg. risk room). Po enforceRiskCap má normálny room.

  // === STEP 8: Hard Risk Cap Enforcement (PR-28) ===
  // FINÁLNA BRZDA: Ak po všetkých adjustments riskScore > riskMax, znížiť iteratívne
  // riskMax je PEVNÁ hranica (5/7/8.5) bez stage bonusov
  // Tento krok garantuje, že žiadny profil neprekročí riskMax
  // PR-28 ADVISOR VERDIKT: Pre mini plány (< 5000€) SKIP enforceRiskCap
  // Dôvod: Pri malých objemoch je dôležitejšie ukázať "Mini plán", nie optimalizovať risk

  if (effectivePlanVolume < 5000) {
    console.log(
      `[MixAdjustments] Mini plán (${effectivePlanVolume.toFixed(0)}€) - enforceRiskCap SKIPPED (advisor verdikt PR-28)`
    );
    // Info pre UX - zobraz "Sila plánu: Mini plán"
    info.riskCapEnforcement = {
      initialRisk: riskScore0to10(mix),
      finalRisk: riskScore0to10(mix),
      iterations: 0,
      riskMax: getRiskMax(riskPref),
    };
  } else {
    // Normálny plán - aplikuj enforceRiskCap
    // PR-28 FIX: Predáme stageCapsMap, aby redistribúcia rešpektovala gold/cash limity
    const initialRiskBeforeEnforce = riskScore0to10(mix);
    const riskCapResult: EnforceRiskCapResult = enforceRiskCap(mix, riskPref, stageCapsMap);
    mix = riskCapResult.mix;

    if (riskCapResult.applied) {
      console.log(
        `[MixAdjustments] Risk cap enforced: ${riskCapResult.initialRisk.toFixed(2)} → ${riskCapResult.finalRisk.toFixed(2)} (${riskCapResult.iterations} iterations)`
      );
      warnings.push("risk-cap-enforced");
      info.riskCapEnforcement = {
        initialRisk: riskCapResult.initialRisk,
        finalRisk: riskCapResult.finalRisk,
        iterations: riskCapResult.iterations,
        riskMax: getRiskMax(riskPref),
      };

      if (riskCapResult.warning) {
        console.warn(`[MixAdjustments] ${riskCapResult.warning}`);
      }
    }

    // PR-33 FIX: STEP 9 (re-enforce stage caps) REMOVED
    // DÔVOD: Vytváralo LOOP DETECTED cykly a DEADLOCKy
    // RIEŠENIE: Stage caps sa aplikujú len raz (STEP 5.7), enforceRiskCap je finálny arbiter
    // Ak enforceRiskCap posunie asset mierne nad cap (napr. gold 40.2%), je to tolerované
  }

  // === STEP 10: Yield Optimizer (PR-31 FIX - moved after enforceRiskCap) ===
  // Ak máme risk rezervu (riskScore < riskMax - 0.2), zvýš výnos
  // Presun z low-yield → high-yield aktív (bonds → bond9, gold → ETF, cash → bonds)
  // Max 3 kroky, stop ak riskScore >= riskMax - 0.2
  // PR-31 FIX: Rešpektuje profile asset caps (bond9 max 25% pre Conservative atď.)
  // PR-31 FIX: Max boost cap (Conservative +0.8%, Growth +1.5%) pre zachovanie hierarchie
  // MOVED after enforceRiskCap: Growth profil môže mať risk > riskMax pred enforce,
  // čo by spôsobilo SKIP (neg. room). Po enforce má normálny room.
  console.log(`[MixAdjustments] STEP 10: Yield optimization (after risk enforcement)...`);
  const yieldOptResult: YieldOptimizerResult = optimizeYield(
    mix, 
    riskPref, 
    effectivePlanVolume, 
    3
  );
  mix = yieldOptResult.mix;

  if (yieldOptResult.applied) {
    console.log(
      `[MixAdjustments] Yield optimized: ${yieldOptResult.moves.join(", ")} ` +
      `(Yield ${(yieldOptResult.initialYield * 100).toFixed(2)}% → ${(yieldOptResult.finalYield * 100).toFixed(2)}%)`
    );
    // Info (nie warning - je to želaná optimalizácia)
  }

  // === PR-34: FINAL STEP - Normalize & Clamp (posledná obrana) ===
  console.log(`[MixAdjustments] FINAL STEP: normalizeAndClampMix...`);
  const finalRiskMax = getRiskMax(riskPref);
  const maxRiskForOptimizer = Math.min(finalRiskMax + 1.0, 9.0); // Sync s yieldOptimizer headroom
  mix = normalizeAndClampMix(mix, riskPref, maxRiskForOptimizer);

  return { mix, warnings, info };
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

  // PR-27b: Cash cap as hard constraint
  const cashCap = getCashCap(riskPref);

  // Poradie zdrojov (bezpečné aktíva)
  // UPOZORNENIE: cash nesmie ísť pod cash cap (hard limit)
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
      
      // PR-27b: Cash cap hard constraint
      // Ak srcKey === "cash" a už sme na cash cap, nesmieme brať z cash
      if (srcKey === "cash" && srcPct <= cashCap) {
        continue; // Cash je na limite, preskočiť
      }

      // Dostupný buffer = srcPct - cashCap (ak cash), inak celý srcPct
      const availableSource = srcKey === "cash" ? srcPct - cashCap : srcPct;
      
      if (availableSource < STEP) continue; // Nedostatok zdroja

      const moveAmount = Math.min(STEP, availableSource, maxAdjustment - totalMoved);
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

  // PR-27b: Cash cap as hard constraint
  const cashCap = getCashCap(riskPref);

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
        
        // PR-27b: Cash cap hard constraint
        // Ak tgtKey === "cash", room je limitovaný cash capom
        const effectiveRoom = tgtKey === "cash" 
          ? Math.min(room, cashCap - getPct("cash"))
          : room;
        
        const allocation = Math.min(moveAmount * ratio, effectiveRoom);
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
 * PR-27: Conservative Risk Guardrail
 * 
 * Konzervatívny profil nesmie mať riziko >= vyvážený profil.
 * Tolerancia: max +1.0 bodu rozdiel.
 * 
 * Algoritmus:
 * 1. Vypočítaj riskScore_conservative a riskScore_balanced (rovnaký stage)
 * 2. Ak risk_conservative >= risk_balanced:
 *    - Iteratívne presuň 5% z ETF → zlato (max 5 krokov)
 *    - Zastav ak: risk_conservative < risk_balanced alebo ETF < 30%
 * 3. Ak stále risk_conservative >= risk_balanced:
 *    - Kontroluj rozdiel <= +1.0 bodu
 *    - Ak áno → warning chip "conservative-risk-elevated"
 *    - Ak nie → aplikuj mix, ale warning intenzívnejší
 * 
 * @param baseMix - Mix po risk tuner
 * @param profile - Profil investora
 * @param stage - Investičný stage
 * @param stageCaps - Stage capy (pre kontrolu room)
 * @returns Mix + info o elevácii rizika
 */
function enforceConservativeRiskGuard(
  baseMix: MixItem[],
  profile: ProfileForAdjustments,
  stage: Stage,
  stageCaps: Record<string, number>
): { mix: MixItem[]; elevated: boolean } {
  let mix = [...baseMix];

  // Vypočítaj risk pre konzervatívny profil
  const riskConservative = riskScore0to10(mix, "konzervativny");

  // Vypočítaj hypotetický risk pre vyvážený profil (rovnaký stage)
  // (Použijeme rovnaký mix, len zmeníme riskPref parameter pre výpočet)
  const riskBalanced = riskScore0to10(mix, "vyvazeny");

  // Ak konzervatívny je už pod vyváženým → OK, skip
  if (riskConservative < riskBalanced) {
    return { mix: normalize(mix), elevated: false };
  }

  // Guardrail: pokus sa znížiť riziko posunom ETF → zlato
  const MIN_ETF_PCT = 30; // Minimálny ETF podiel (nechceme zničiť výnos)
  const MAX_ITERATIONS = 5;
  const SHIFT_STEP = 5; // Presun 5 p.b. za iteráciu

  let currentRiskCons = riskConservative;
  let currentRiskBal = riskBalanced;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const etfIndex = mix.findIndex((m) => m.key === "etf");
    const goldIndex = mix.findIndex((m) => m.key === "gold");

    if (etfIndex === -1 || goldIndex === -1) break; // Safety

    const etfPct = mix[etfIndex].pct;
    const goldPct = mix[goldIndex].pct;

    // Ak ETF už pod minimom → zastav
    if (etfPct <= MIN_ETF_PCT) break;

    // Presun 5% z ETF → zlato
    const shift = Math.min(SHIFT_STEP, etfPct - MIN_ETF_PCT);
    mix[etfIndex].pct -= shift;
    mix[goldIndex].pct += shift;

    mix = normalize(mix);

    // Prepočítaj riziká
    currentRiskCons = riskScore0to10(mix, "konzervativny");
    currentRiskBal = riskScore0to10(mix, "vyvazeny");

    console.log(
      `[ConservativeGuard] Iteration ${i + 1}: ETF ${etfPct.toFixed(1)}% → ${mix[etfIndex].pct.toFixed(1)}%, Gold ${goldPct.toFixed(1)}% → ${mix[goldIndex].pct.toFixed(1)}%, Risk cons ${currentRiskCons.toFixed(2)} vs bal ${currentRiskBal.toFixed(2)}`
    );

    // Ak už splnené → hotovo
    if (currentRiskCons < currentRiskBal) {
      console.log("[ConservativeGuard] Risk guardrail satisfied");
      return { mix: normalize(mix), elevated: false };
    }
  }

  // Po iteráciách stále risk_conservative >= risk_balanced
  const diff = currentRiskCons - currentRiskBal;

  // Tolerancia: max +1.0 bodu
  const TOLERANCE = 1.0;

  if (diff <= TOLERANCE) {
    console.log(
      `[ConservativeGuard] Risk elevated but within tolerance: diff ${diff.toFixed(2)} <= ${TOLERANCE}`
    );
    return { mix: normalize(mix), elevated: true }; // Warning chip
  } else {
    console.warn(
      `[ConservativeGuard] Risk significantly elevated: diff ${diff.toFixed(2)} > ${TOLERANCE} (mix applied, warning shown)`
    );
    return { mix: normalize(mix), elevated: true }; // Intenzívny warning
  }
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

/**
 * PR-30: Get all 3 adjusted profiles with hierarchy enforcement
 * 
 * Vypočíta Conservative, Balanced, Growth s getAdjustedMix,
 * potom aplikuje ensureProfileHierarchy pre garantovanie poradia.
 * 
 * @param presets - Pole 3 presetov [Conservative, Balanced, Growth]
 * @param profile - Profil pre adjustments (lumpSum, monthly, horizon...)
 * @returns Objekt s 3 upravenými presetmi + combined warnings
 */
export function getAllAdjustedProfiles(
  presets: { conservative: PortfolioPreset; balanced: PortfolioPreset; growth: PortfolioPreset },
  profile: ProfileForAdjustments
): {
  conservative: { preset: PortfolioPreset; warnings: AdjustmentWarning[]; info: AdjustmentResult["info"] };
  balanced: { preset: PortfolioPreset; warnings: AdjustmentWarning[]; info: AdjustmentResult["info"] };
  growth: { preset: PortfolioPreset; warnings: AdjustmentWarning[]; info: AdjustmentResult["info"] };
  hierarchyApplied: boolean;
} {
  // Vypočítaj každý profil independent
  const consResult = getAdjustedMix(presets.conservative.mix, { ...profile, riskPref: "konzervativny" });
  const balResult = getAdjustedMix(presets.balanced.mix, { ...profile, riskPref: "vyvazeny" });
  const growthResult = getAdjustedMix(presets.growth.mix, { ...profile, riskPref: "rastovy" });
  
  // Aplikuj hierarchy enforcement
  const hierarchyResult = ensureProfileHierarchy({
    conservative: consResult.mix,
    balanced: balResult.mix,
    growth: growthResult.mix,
  });
  
  // Vráť adjusted presety s enforced hierarchy
  return {
    conservative: {
      preset: { ...presets.conservative, mix: hierarchyResult.conservative },
      warnings: consResult.warnings,
      info: consResult.info,
    },
    balanced: {
      preset: { ...presets.balanced, mix: hierarchyResult.balanced },
      warnings: balResult.warnings,
      info: balResult.info,
    },
    growth: {
      preset: { ...presets.growth, mix: hierarchyResult.growth },
      warnings: growthResult.warnings,
      info: growthResult.info,
    },
    hierarchyApplied: hierarchyResult.adjustmentsMade,
  };
}

