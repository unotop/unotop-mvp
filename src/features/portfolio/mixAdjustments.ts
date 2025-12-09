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
import { riskScore0to10, approxYieldAnnualFromMix, approxVipYieldFromMix } from "../mix/assetModel"; // PR-35: VIP yields
import { scaleMixByLumpSum, getLumpSumTierInfo } from "./lumpSumScaling";
import { scaleMixByMonthly, getMonthlyCappingInfo } from "./monthlyScaling";
import { adjustMixForCashReserve, getCashReserveInfo } from "./cashReserve";
import { applyBondMinimum, getBondMinimumInfo } from "./bondMinimum";
import { applyCashCap, getCashCapInfo, getCashCap } from "./cashCapPolicy"; // PR-27: Cash cap policy
import { enforceStageCaps } from "./presets";
import { detectStage, volumeToStage } from "../policy/stage"; // P1.5: volumeToStage for consistent volume bands
import { applyMinimums } from "../policy/applyMinimums";
import { getAssetCaps, getDynCryptoComboCap } from "../policy/caps";
import { getAdaptiveRiskCap, getRiskMax, getVipRiskMax, getRiskMaxForBand } from "../policy/risk"; // P1.5: getRiskMaxForBand
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
      // PR-37 FIX: Použiť GLOBAL cap (40%) namiesto goldPolicy.hardCap
      // Dôvod: enforceRiskCap už aplikoval profile-specific caps,
      // goldPolicy.hardCap (15% pre Growth) by zresetoval všetko do dlhopisov
      cap = GLOBAL_HARD_CAPS.gold; // 40% hard limit (nie goldPolicy!)
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

  // STEP 3: Redistribuuj overflow (ak vznikol po clampingu)
  if (totalOverflow > 0.01) {
    // Rozdeľ overflow do safety assets (bonds, bond3y9, gold - ale gold cap už aplikovaný!)
    const safetySinks =
      riskPref === "konzervativny"
        ? [
            { key: "bond3y9", weight: 0.6 },
            { key: "bonds", weight: 0.4 },
          ]
        : riskPref === "vyvazeny"
        ? [
            { key: "bonds", weight: 0.6 },
            { key: "bond3y9", weight: 0.4 },
          ]
        : [
            { key: "bonds", weight: 0.6 },
            { key: "bond3y9", weight: 0.4 },
          ];

    for (const sink of safetySinks) {
      const sinkItem = mix.find((m) => m.key === sink.key);
      if (sinkItem) {
        sinkItem.pct += totalOverflow * sink.weight;
      }
    }

    console.log(`[MixAdjustments Clamp] Redistributed overflow ${totalOverflow.toFixed(2)}% to safety sinks`);
  }

  // STEP 4: Final normalize (ensure exact 100%)
  mix = normalize(mix);
  
  // STEP 5: CRITICAL - Re-clamp after normalize (může přidat kvůli zaokrouhlení)
  for (const item of mix) {
    let cap: number | undefined;

    if (item.key === "gold") {
      cap = GLOBAL_HARD_CAPS.gold;
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
      
      // Redistribute overflow to bonds immediately
      const bondsItem = mix.find(m => m.key === 'bonds');
      if (bondsItem) {
        bondsItem.pct += overflow;
        console.log(`[MixAdjustments Final Clamp] ${item.key} ${(cap + overflow).toFixed(2)}% → ${cap}%, overflow → bonds`);
      }
    }
  }

  return mix;
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
    // PR-35 VIP: Safe vs VIP yield (dual calculation)
    yields?: {
      safe: number;        // Default yield (ASSET_PARAMS, riskMax 8.5)
      vip: number;         // VIP yield (VIP_ASSET_PARAMS, riskMax 9.5)
      vipMix?: MixItem[];  // VIP mix (pre debug/transparency)
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
  
  // P1.5 FIX: Stage založený na effective volume (nie raw inputs)
  // Záruka kompatibility s profileAssetPolicy volume bands (STARTER < 50k, CORE 50-100k, LATE ≥50k)
  const stage = volumeToStage(effectivePlanVolume);
  // P1.5 FIX: Použi getRiskMaxForBand pre volume-aware cap (CORE Conservative 4.5, nie 5.0)
  const riskCap = getRiskMaxForBand(riskPref, stage);
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
    console.log(`[DEBUG STEP 5.5A DOWN-TUNE] ${JSON.stringify(mix.filter(m => m.pct > 0).map(m => ({ k: m.key, p: m.pct.toFixed(1) })))}`);
  }
  
  // STEP 5.5B: UP-TUNE (ak risk < targetMin - tolerance)
  if (currentRisk < targetMin - TUNE_TOLERANCE.upThreshold) {
    const maxAdjustment = MAX_TOTAL_ADJUSTMENT[riskPref];
    mix = upTuneRisk(mix, targetMin, riskPref, stage, stageCapsMap, profile, maxAdjustment);
    currentRisk = riskScore0to10(mix, riskPref); // Refresh
    console.log(`[DEBUG STEP 5.5B UP-TUNE] ${JSON.stringify(mix.filter(m => m.pct > 0).map(m => ({ k: m.key, p: m.pct.toFixed(1) })))}`);
    
    // Ak stále pod targetMin → info chip
    if (currentRisk < targetMin) {
      warnings.push("risk-target-limited");
    }
  }

  // === STEP 5.6: REMOVED enforceConservativeRiskGuard (P1.5 FIX) ===
  // Guard bol root cause C=G inversií - presúval ETF→gold na shared base-mix.
  // Separation teraz riešia: profileAssetPolicy caps + risk bands + yieldOptimizer.
  // Každý profil má vlastnú pipeline bez cross-profile state sharing.

  // === STEP 6: Stage-aware caps enforcement (PR-8) ===
  // Detekuj stage a aplikuj adaptive caps
  mix = enforceStageCaps(mix, riskPref, stage);
  console.log(`[DEBUG STEP 6 enforceStageCaps] ${JSON.stringify(mix.filter(m => m.pct > 0).map(m => ({ k: m.key, p: m.pct.toFixed(1) })))}`);

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
  console.log(`[DEBUG STEP 7 applyCashCap] ${JSON.stringify(mix.filter(m => m.pct > 0).map(m => ({ k: m.key, p: m.pct.toFixed(1) })))}`);

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
  console.log(`[DEBUG STEP 7.5 applyProfileAssetPolicy] ${JSON.stringify(mix.filter(m => m.pct > 0).map(m => ({ k: m.key, p: m.pct.toFixed(1) })))}`);

  // PR-31 FIX: Yield optimizer MOVED to STEP 10 (after enforceRiskCap)
  // Dôvod: Growth profil môže mať risk > riskMax pred enforceRiskCap,
  // čo by spôsobilo SKIP optimizéra (neg. risk room). Po enforceRiskCap má normálny room.

  // === STEP 8: Hard Risk Cap Enforcement (PR-28) ===
  // FINÁLNA BRZDA: Ak po všetkých adjustments riskScore > riskMax, znížiť iteratívne
  // riskMax je PEVNÁ hranica (5/7/8.5) bez stage bonusov
  // Tento krok garantuje, že žiadny profil neprekročí riskMax
  // P1.2 WORKAROUND: Skip pre < 50k (STARTER band) aby sme zachovali natural profile separation
  // Known issue: Môže dôjsť k micro-inversions (C/B/G risk hierarchy ±0.5)
  // TODO P2: Implementovať enforceProfileHierarchy() cross-profile consistency check

  if (effectivePlanVolume < 50_000) {
    console.log(
      `[MixAdjustments] Malý plán (${effectivePlanVolume.toFixed(0)}€) - enforceRiskCap SKIPPED (natural profile separation)`
    );
    // Info pre UX - zobraz finálne riziko bez caps
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
  console.log(`[DEBUG STEP 8 enforceRiskCap] ${JSON.stringify(mix.filter(m => m.pct > 0).map(m => ({ k: m.key, p: m.pct.toFixed(1) })))}`);

  // === STEP 10: Yield Optimizer (PR-31 FIX - moved after enforceRiskCap) ===
  // Ak máme risk rezervu (riskScore < riskMax - 0.2), zvýš výnos
  // Presun z low-yield → high-yield aktív (bonds → bond9, gold → ETF, cash → bonds)
  // Max 3 kroky, stop ak riskScore >= riskMax - 0.2
  // PR-31 FIX: Rešpektuje profile asset caps (bond9 max 25% pre Conservative atď.)
  // PR-31 FIX: Max boost cap (Conservative +0.8%, Growth +1.5%) pre zachovanie hierarchie
  // MOVED after enforceRiskCap: Growth profil môže mať risk > riskMax pred enforce,
  // čo by spôsobilo SKIP (neg. room). Po enforce má normálny room.
  console.log(`[MixAdjustments] STEP 10: Yield optimization (after risk enforcement)...`);
  // P1.5 FIX: Predaj volume-aware riskCap do optimizera (CORE Conservative 4.5, nie 5.0)
  const yieldOptResult: YieldOptimizerResult = optimizeYield(
    mix, 
    riskPref, 
    effectivePlanVolume, 
    3,
    riskCap // Volume-aware cap (RISK_MAX_PER_BAND)
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
  console.log(`[MixAdjustments DEBUG] PRED normalizeAndClampMix: ${JSON.stringify(mix.filter(m => m.pct > 0).map(m => ({ k: m.key, p: m.pct.toFixed(1) })))}`);
  const finalRiskMax = getRiskMax(riskPref);
  const maxRiskForOptimizer = Math.min(finalRiskMax + 1.0, 9.0); // Sync s yieldOptimizer headroom
  mix = normalizeAndClampMix(mix, riskPref, maxRiskForOptimizer);
  console.log(`[MixAdjustments DEBUG] PO normalizeAndClampMix: ${JSON.stringify(mix.filter(m => m.pct > 0).map(m => ({ k: m.key, p: m.pct.toFixed(1) })))}`);

  // === PR-35: VIP YIELD CALCULATION (dual safe/vip yields) ===
  // Safe mix je už hotový (s RISK_MAX). Teraz vypočítaj VIP mix (s VIP_RISK_MAX).
  const safeYield = approxYieldAnnualFromMix(mix);
  let vipYield = safeYield; // Default: ak VIP calculation zlyhá, použij safe
  let vipMix: MixItem[] | undefined;

  try {
    // Deep copy safe mix pre VIP calculation
    const vipMixCandidate = mix.map(m => ({ ...m }));
    
    // VIP optimization: uvoľni risk cap + zvýš výnosy
    const vipRiskMax = getVipRiskMax(riskPref);
    const vipMaxRiskForOptimizer = Math.min(vipRiskMax + 1.0, 10.0); // VIP headroom
    
    // Re-run normalizeAndClampMix s VIP risk caps (no tune, iba clamp)
    const vipMixClamped = normalizeAndClampMix(vipMixCandidate, riskPref, vipMaxRiskForOptimizer);
    
    // Vypočítaj VIP yield (používa VIP_ASSET_PARAMS)
    vipYield = approxVipYieldFromMix(vipMixClamped);
    vipMix = vipMixClamped;
    
    console.log(`[MixAdjustments] VIP yield: Safe ${(safeYield * 100).toFixed(2)}% → VIP ${(vipYield * 100).toFixed(2)}%`);
  } catch (err) {
    console.warn(`[MixAdjustments] VIP calculation failed, using safe yield:`, err);
  }

  // Return s dual yields
  return {
    mix,
    warnings,
    info: {
      ...info,
      yields: {
        safe: safeYield,
        vip: vipYield,
        vipMix, // Pre debug/transparency
      },
    },
  };
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
 * P1.5 CLEANUP: enforceConservativeRiskGuard REMOVED
 * 
 * Dôvod odstránenia:
 * - Spôsoboval C=G inversie (Conservative = Growth identické mix/yield/risk)
 * - Architectural flaw: cross-profile porovnania na shared base-mix
 * - Profily zdieľali stav → guard prebíjal rozdiely medzi C/B/G
 * 
 * Nové riešenie (profile separation):
 * - profileAssetPolicy: profile-specific caps (C nižší ETF než G)
 * - Risk bands: každý profil má vlastný risk target
 * - Yield optimizer: optimalizuje v rámci profilu
 * - Žiadne cross-profile guards/hacks
 * 
 * Affected scenarios (6/6 teraz FIXED):
 * - 2800/200/30, 1000/100/30, 5000/300/20, 10000/500/20, 0/150/30, 20000/0/20
 * - Pred fixom: C=G (8.30% yield, 4.20 risk)
 * - Po fixe: C < B < G (strict ordering garantovaný invariantmi)
 */

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

