/**
 * PR-31: Yield Optimizer
 * 
 * Zvyšuje očakávaný výnos portfólia (expectedReturnPa) v rámci risk budgetu.
 * 
 * Logika:
 * - Ak riskScore < riskMax - 0.5, máme priestor na zvýšenie výnosu
 * - Presúvame z low-yield → high-yield aktív (bonds → bond9, gold → ETF, cash → bonds)
 * - Iteratívne (max 3 kroky), stop ak riskScore >= riskMax - 0.2
 * - PR-31 FIX: Validuje profile asset caps (bond9 max 25% pre Conservative atď.)
 * 
 * Cieľ: V rámci risk manažmentu (riskMax nedotknuteľný) hľadať MAX výnos.
 */

import type { MixItem } from "../mix/mix.service";
import type { RiskPref } from "../mix/assetModel";
import { normalize } from "../mix/mix.service";
import { riskScore0to10, approxYieldAnnualFromMix, ASSET_PARAMS } from "../mix/assetModel";
import { getRiskMax } from "../policy/risk";
import { getProfileAssetCaps } from "../policy/profileAssetPolicy";

/**
 * Yield optimization moves (od low-yield → high-yield)
 * 
 * Pravidlá:
 * - Každý move presunie fixnú čiastku (napr. 2 p.b.)
 * - Kontrolujeme, či risk stále < riskMax
 * - Vyberiame move s najvyšším yield impact
 * 
 * PR-31 FIX: Znížené z 5 → 2 p.b. (menšie kroky, viac flexibility)
 * Dôvod: Growth profil môže mať málo cash/bonds po enforceRiskCap (škrtanie dyn),
 * takže 5 p.b. move zlyhá (nedostatok zdroja).
 */
const YIELD_MOVES: Array<{
  from: MixItem["key"];
  to: MixItem["key"];
  amount: number; // Percentuálne body na presun
  description: string;
}> = [
  // High-impact moves (veľký nárast yield)
  { from: "cash", to: "bond3y9", amount: 2, description: "IAD DK → Bond 9%" },
  { from: "gold", to: "bond3y9", amount: 2, description: "Zlato → Bond 9%" },
  { from: "bonds", to: "bond3y9", amount: 2, description: "Bond 7.5% → Bond 9%" },
  
  // Medium-impact moves (stredný nárast yield)
  { from: "cash", to: "bonds", amount: 2, description: "IAD DK → Bond 7.5%" },
  { from: "gold", to: "etf", amount: 2, description: "Zlato → ETF" },
  { from: "cash", to: "etf", amount: 2, description: "IAD DK → ETF" },
  
  // Conservative moves (malý nárast yield, malé riziko)
  { from: "cash", to: "gold", amount: 2, description: "IAD DK → Zlato" },
];

export interface YieldOptimizerResult {
  mix: MixItem[];
  applied: boolean;
  moves: string[];
  initialYield: number;
  finalYield: number;
  initialRisk: number;
  finalRisk: number;
}

/**
 * PR-31 FIX: Max boost caps pre profile hierarchy
 * 
 * Conservative nesmie dostať väčší boost ako Growth.
 * Zistené: Pri 500 EUR/m dostával Conservative +1.37% vs Growth +0.32%,
 * čo Conservative posunulo nad Growth (7.86% > 7.54%).
 * 
 * UPDATE: Growth zvýšený na 2.0% (z 1.5%), aby mal dosť priestoru aj
 * keď starting risk je tesne pod/nad riskMax po enforceRiskCap.
 */
const MAX_BOOST_BY_PROFILE = {
  konzervativny: 0.008, // max +0.8% boost
  vyvazeny: 0.012,      // max +1.2% boost
  rastovy: 0.020,       // max +2.0% boost (zvýšené z 1.5%)
};

/**
 * Optimalizuj mix pre MAX výnos v rámci risk budgetu
 * 
 * @param mix - Mix aktív (mutable)
 * @param riskPref - Rizikový profil
 * @param effectivePlanVolume - Effective plan volume (pre profile asset caps)
 * @param maxIterations - Max počet presunov (default 3)
 * @returns Result s upravený mix + info o moves
 */
export function optimizeYield(
  mix: MixItem[],
  riskPref: RiskPref,
  effectivePlanVolume: number,
  maxIterations = 3
): YieldOptimizerResult {
  const riskMax = getRiskMax(riskPref);
  const initialRisk = riskScore0to10(mix);
  const initialYield = approxYieldAnnualFromMix(mix);
  
  // PR-31 FIX: Získaj profile asset caps
  const profileCaps = getProfileAssetCaps(riskPref, effectivePlanVolume);
  
  // PR-31 FIX: SKIP yield optimizer pre malé plány (< 100k EUR)
  // Dôvod: Pri STARTER/CORE plánoch je riskRoom často negatívny (po ensureHierarchy)
  // a yield optimization môže narušiť hierarchy invarianty
  if (effectivePlanVolume < 100000) {
    console.log(
      `[YieldOptimizer] SKIP: Malý plán (${effectivePlanVolume.toLocaleString()} EUR < 100k)`
    );
    return {
      mix,
      applied: false,
      moves: [],
      initialYield: approxYieldAnnualFromMix(mix),
      finalYield: approxYieldAnnualFromMix(mix),
      initialRisk: riskScore0to10(mix),
      finalRisk: riskScore0to10(mix),
    };
  }
  
  // Podmienka: Ak risk >= riskMax - 0.2, nemáme priestor na optimalizáciu
  // PR-31 FIX: Znížené z 0.5 → 0.2 (aby Balanced mal šancu pri PREMIUM plánoch)
  // PR-31 FIX2: Ak je risk MIERNE nad riskMax (do +0.5), stále optimalizuj
  //  - enforceRiskCap môže nechať risk tesne nad riskMax (advisor verdikt: OK ak < +0.3)
  //  - Yield optimizer môže pomôcť znížiť risk (napr. bond9 má nižší risk ako dyn)
  const riskRoom = riskMax - initialRisk;
  if (riskRoom < -0.5) {
    console.log(
      `[YieldOptimizer] SKIP: Risk významne nad limitom (${initialRisk.toFixed(2)} > ${riskMax.toFixed(1)} + 0.5)`
    );
    return {
      mix,
      applied: false,
      moves: [],
      initialYield,
      finalYield: initialYield,
      initialRisk,
      finalRisk: initialRisk,
    };
  }
  
  console.log(
    `[YieldOptimizer] START: Risk ${initialRisk.toFixed(2)} / ${riskMax.toFixed(1)}, ` +
    `Yield ${(initialYield * 100).toFixed(2)}%, Room ${riskRoom.toFixed(2)}`
  );
  
  const appliedMoves: string[] = [];
  let iterations = 0;
  
  // PR-31 FIX: Sleduj celkový yield boost (pre max boost cap)
  const maxBoost = MAX_BOOST_BY_PROFILE[riskPref] ?? 0.012;
  let totalBoost = 0;
  
  // Iteratívne hľadaj najlepší move
  while (iterations < maxIterations) {
    const currentRisk = riskScore0to10(mix);
    const currentYield = approxYieldAnnualFromMix(mix);
    
    // PR-31 FIX: Stop ak sme dosiahli max boost pre profil
    if (totalBoost >= maxBoost) {
      console.log(
        `[YieldOptimizer] STOP: Max boost ${(maxBoost * 100).toFixed(1)}% dosiahnutý ` +
        `(celkový boost ${(totalBoost * 100).toFixed(2)}%)`
      );
      break;
    }
    
    // Stop ak sme VÝZNAMNE nad riskMax (nechceme pridať ešte viac risk)
    // PR-31 FIX2: Ak je risk tesne nad riskMax (do +0.5), stále optimalizuj
    //  - Yield moves môžu ZNÍŽIŤ risk (napr. bonds → bond9 má nižší risk)
    //  - enforceRiskCap môže nechať risk tesne nad riskMax (advisor verdikt OK)
    if (currentRisk > riskMax + 0.5) {
      console.log(
        `[YieldOptimizer] STOP: Risk významne nad limitom (${currentRisk.toFixed(2)} > ${riskMax.toFixed(1)} + 0.5)`
      );
      break;
    }
    
    // Nájdi najlepší move (najvyšší yield gain bez prekročenia riskMax)
    let bestMove: typeof YIELD_MOVES[0] | null = null;
    let bestYieldGain = 0;
    let bestMixAfterMove: MixItem[] | null = null;
    
    for (const move of YIELD_MOVES) {
      // Skúsime tento move
      const testMix = JSON.parse(JSON.stringify(mix)) as MixItem[];
      const fromItem = testMix.find((m) => m.key === move.from);
      const toItem = testMix.find((m) => m.key === move.to);
      
      if (!fromItem || !toItem || fromItem.pct < move.amount) {
        continue; // Nedostatok zdrojového aktíva
      }
      
      // Aplikuj move
      fromItem.pct -= move.amount;
      toItem.pct += move.amount;
      normalize(testMix);
      
      // PR-31 FIX: Validuj profile caps pre TARGET asset
      const targetCap = profileCaps[move.to as keyof typeof profileCaps];
      if (targetCap !== undefined && toItem.pct > targetCap) {
        // console.log(
        //   `[YieldOptimizer] SKIP move ${move.from} → ${move.to}: ` +
        //   `would exceed cap (${toItem.pct.toFixed(1)}% > ${targetCap}%)`
        // );
        continue; // Prekročili by sme profile cap
      }
      
      // Skontroluj risk
      const testRisk = riskScore0to10(testMix);
      if (testRisk > riskMax) {
        continue; // Prekročili by sme riskMax
      }
      
      // Vypočítaj yield gain
      const testYield = approxYieldAnnualFromMix(testMix);
      const yieldGain = testYield - currentYield;
      
      if (yieldGain > bestYieldGain) {
        bestYieldGain = yieldGain;
        bestMove = move;
        bestMixAfterMove = testMix;
      }
    }
    
    // Ak sme našli dobrý move, aplikuj ho
    if (bestMove && bestMixAfterMove && bestYieldGain > 0.0001) {
      // PR-31 FIX: Check max boost PRED aplikovaním move
      if (totalBoost + bestYieldGain > maxBoost) {
        console.log(
          `[YieldOptimizer] STOP: Next move by prekročil max boost ` +
          `(${(totalBoost * 100).toFixed(2)}% + ${(bestYieldGain * 100).toFixed(2)}% > ${(maxBoost * 100).toFixed(1)}%)`
        );
        break;
      }
      
      mix.length = 0;
      mix.push(...bestMixAfterMove);
      
      appliedMoves.push(bestMove.description);
      totalBoost += bestYieldGain; // PR-31 FIX: Sleduj celkový boost
      iterations++;
      
      console.log(
        `[YieldOptimizer] Move ${iterations}: ${bestMove.description} ` +
        `(+${(bestYieldGain * 100).toFixed(2)}% yield, risk ${riskScore0to10(mix).toFixed(2)})`
      );
    } else {
      console.log(`[YieldOptimizer] No beneficial move found, stopping`);
      break;
    }
  }
  
  const finalRisk = riskScore0to10(mix);
  const finalYield = approxYieldAnnualFromMix(mix);
  
  if (appliedMoves.length > 0) {
    console.log(
      `[YieldOptimizer] DONE: ${appliedMoves.length} moves applied, ` +
      `Yield ${(initialYield * 100).toFixed(2)}% → ${(finalYield * 100).toFixed(2)}% ` +
      `(+${((finalYield - initialYield) * 100).toFixed(2)}%), ` +
      `Risk ${initialRisk.toFixed(2)} → ${finalRisk.toFixed(2)}`
    );
  }
  
  return {
    mix,
    applied: appliedMoves.length > 0,
    moves: appliedMoves,
    initialYield,
    finalYield,
    initialRisk,
    finalRisk,
  };
}
