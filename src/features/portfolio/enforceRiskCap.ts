/**
 * Risk Cap Enforcement Module
 * 
 * PR-28: Finálna tvrdá brzda pre riziko portfólia.
 * PR-34: Profile-aware RISK_SINKS (B/G: bonds/IAD primárne, zlato secondary s cap checks)
 * 
 * Aplikuje sa ako posledný krok (STEP 8) po všetkých policy adjustments.
 * 
 * Algoritmus:
 * 1. Skontroluj, či riskScore <= riskMax
 * 2. Ak nie, iteratívne znižuj najrizikovejšie assety (max 10 krokov)
 * 3. Redistribuj do bezpečných assetov podľa profilu (RISK_SINKS)
 * 4. Iteration 9-10: Direct cut mode (dyn/crypto/real/ETF → bonds/IAD, BEZ nafukovania zlata)
 * 
 * Rizikovosť assetov (od najvyššej):
 * - Crypto (9)
 * - Dynamické riadenie (8-9)
 * - Reality (4-5)
 * - Dlhopis 9% (2)
 * - Dlhopis 7,5% (2)
 * - ETF (5-6)
 * - Zlato (2-3)
 * - Cash (2)
 * 
 * PR-34: Profile-aware sinks (Conservative: viac zlata OK, B/G: menej zlata, viac bonds/IAD)
 */

import type { MixItem } from "../mix/mix.service";
import type { RiskPref } from "../mix/assetModel";
import { normalize } from "../mix/mix.service";
import { riskScore0to10 } from "../mix/assetModel";
import { getRiskMax } from "../policy/risk";
import { getGoldPolicy } from "../policy/profileAssetPolicy"; // PR-34: Gold policy caps

/**
 * PR-34: Profile-Aware Risk Sinks
 * 
 * Definuje, kam sa má presúvať riziko pri znižovaní risk score.
 * - Conservative: môže mať viac zlata (bezpečný pilier)
 * - Balanced: primárne bonds/IAD, zlato len do 20% (hard cap)
 * - Growth: primárne bonds/IAD/real, zlato len do 15% (hard cap)
 * 
 * maxPct: Ak definované, sink sa považuje za "full" pri dosiahnutí limitu
 */
const RISK_SINKS: Record<RiskPref, Array<{ key: MixItem["key"]; weight: number; maxPct?: number }>> = {
  konzervativny: [
    { key: "bonds", weight: 0.30 },         // Primárne bonds (bond5 + bondShort)
    { key: "bond3y9", weight: 0.25 },       // bond9 (IAD substitute pre alias compatibility)
    { key: "gold", weight: 0.35 },          // Zlato OK (až do 40% cap z GOLD_POLICY)
    { key: "cash", weight: 0.10 },          // IAD DK
  ],
  vyvazeny: [
    { key: "bonds", weight: 0.40 },         // Primárne bonds
    { key: "bond3y9", weight: 0.30 },       // bond9 (vyššia váha než Conservative)
    { key: "gold", weight: 0.20, maxPct: 20 }, // KEY: zlato len do 20% (hard cap)!
    { key: "cash", weight: 0.10 },          // IAD DK
  ],
  rastovy: [
    { key: "bonds", weight: 0.35 },         // Primárne bonds
    { key: "bond3y9", weight: 0.30 },       // bond9
    { key: "real", weight: 0.20 },          // Reality (nízke riziko, vyšší yield ako gold)
    { key: "gold", weight: 0.10, maxPct: 15 }, // KEY: zlato len do 15% (hard cap)!
    { key: "cash", weight: 0.05 },          // IAD DK (minimálne)
  ],
};

/**
 * Rizikovosť assetov (zoradené od najvyššieho rizika)
 * 
 * PR-31: Poradie škrtania podľa advisor špecifikácie:
 * dyn → crypto → real → ETF → bond3y9 → bonds → gold → cash
 * 
 * Poznámka: bonds sú risk asset (môžu byť škrtané), ale sú nízko v poradí
 */
const RISK_ORDERED_KEYS: MixItem["key"][] = [
  "dyn",      // 8-9 (najrizikovejšie)
  "crypto",   // 8
  "real",     // 5
  "etf",      // 5-6
  "bond3y9",  // 3 (vyššia sadzba než bonds, ale stále bezpečnejšie ako ETF)
  "bonds",    // 2 (PR-31: bonds sú risk asset, škrtajú sa pred gold/cash)
  "gold",     // 2-3 (nízke riziko, nešktá sa okrem extrémov)
  "cash",     // 2 (najnižšie riziko, last resort)
];

export interface EnforceRiskCapResult {
  mix: MixItem[];
  applied: boolean;
  iterations: number;
  initialRisk: number;
  finalRisk: number;
  warning: string | null; // Warning ak risk stále nad riskMax (ale blízko)
}

/**
 * Aplikuj hard risk cap na mix
 * 
 * PR-34: Profile-aware RISK_SINKS (B/G: bonds/IAD primárne, zlato secondary s maxPct)
 * Iteratívne znižuje najrizikovejšie assety, kým riskScore <= riskMax.
 * Max 10 iterácií (PR-34: znížené z 15):
 *   - Iteration 1-8: Normal redistribution using RISK_SINKS
 *   - Iteration 9-10: Direct cut mode (force cut high-risk → bonds/bond9 ONLY, NO gold)
 * 
 * @param baseMix - Mix pred aplikáciou risk cap
 * @param riskPref - Rizikový profil
 * @param stageCaps - Stage caps (gold, cash limity) - used as fallback if RISK_SINKS.maxPct undefined
 * @param maxIterations - Max počet iterácií (default 10)
 * @returns Upravený mix + info o risk enforcement
 */
export function enforceRiskCap(
  baseMix: MixItem[],
  riskPref: RiskPref,
  stageCaps?: Record<string, number>,
  maxIterations = 10 // PR-34: Znížené z 15 → 10 (iteration 9-10 = direct cut mode)
): EnforceRiskCapResult {
  const mix = [...baseMix];
  const riskMax = getRiskMax(riskPref);
  const riskSinks = RISK_SINKS[riskPref]; // PR-34: Profile-aware sinks
  const goldPolicy = getGoldPolicy(riskPref); // PR-34: Gold caps

  const initialRisk = riskScore0to10(mix, riskPref, 0);
  let currentRisk = initialRisk;
  let iterations = 0;

  console.log(`[EnforceRiskCap] Initial risk: ${initialRisk.toFixed(2)} / max ${riskMax.toFixed(2)}`);

  // Ak už pod riskMax → skip
  if (currentRisk <= riskMax) {
    return {
      mix: normalize(mix),
      applied: false,
      iterations: 0,
      initialRisk,
      finalRisk: currentRisk,
      warning: null,
    };
  }

  // Iteratívne znižovanie rizika
  while (currentRisk > riskMax && iterations < maxIterations) {
    iterations++;

    // Nájdi najrizikovejší asset, ktorý má > 0 %
    // PR-34 FIX: Preskočiť assety, ktoré sú už NA alebo POD profile cap
    // (napr. Balanced dyn 10% je už na profile cap, nemôže sa ďalej škrtať)
    let reducedKey: MixItem["key"] | null = null;
    for (const key of RISK_ORDERED_KEYS) {
      const asset = mix.find((m) => m.key === key);
      if (asset && asset.pct > 0) {
        // PR-34: Hardcoded check pre dyn (profile asset policy caps)
        // Balanced: dyn cap = 10%, Conservative: dyn cap = 10%, Growth: dyn cap = 20%
        if (key === "dyn") {
          const dynProfileCap = riskPref === "rastovy" ? 20 : 10; // B/C: 10%, G: 20%
          if (asset.pct <= dynProfileCap * 1.05) {
            // dyn je <= profile cap (+5% tolerance) → preskočiť (už capped v STEP 7.5)
            console.log(`[EnforceRiskCap] dyn ${asset.pct.toFixed(1)}% <= profile cap ${dynProfileCap}%, skip škrtania`);
            continue;
          }
        }
        
        reducedKey = key;
        break;
      }
    }

    if (!reducedKey) {
      console.warn(`[EnforceRiskCap] Iteration ${iterations}: Žiadny rizikovejší asset na zníženie`);
      break;
    }

    const assetIndex = mix.findIndex((m) => m.key === reducedKey);
    const currentPct = mix[assetIndex].pct;

    // Znížiť o 2-5 p.b. (proporcionálne k veľkosti assetu)
    const reductionStep = Math.min(5, Math.max(2, currentPct * 0.2)); // 20% z current alebo min 2 p.b.
    const reducedPct = Math.max(0, currentPct - reductionStep);
    const actualReduction = currentPct - reducedPct;

    mix[assetIndex].pct = reducedPct;

    console.log(
      `[EnforceRiskCap] Iteration ${iterations}: ${reducedKey} ${currentPct.toFixed(2)}% → ${reducedPct.toFixed(2)}% (-${actualReduction.toFixed(2)} p.b.)`
    );

    // PR-34: Profile-aware RISK_SINKS redistribution
    // Iteration 1-8: Normal redistribution using RISK_SINKS
    // Iteration 9-10: Direct cut mode (force cut high-risk assets → bonds/bond9 only, NO gold inflation)
    
    let remainingReduction = actualReduction;

    if (iterations < 9) {
      // NORMAL MODE: Redistribute using profile-aware RISK_SINKS
      for (const sink of riskSinks) {
        const sinkItem = mix.find(m => m.key === sink.key);
        if (!sinkItem) continue;

        // PR-34: Ak sink.maxPct definovaný a current % >= maxPct → sink je "full", skip
        if (sink.maxPct && sinkItem.pct >= sink.maxPct) {
          console.log(`[EnforceRiskCap]   → ${sink.key} FULL (${sinkItem.pct.toFixed(1)}% >= ${sink.maxPct}% cap), skip`);
          continue;
        }

        // Calculate room (use sink.maxPct if defined, else stage caps, else Infinity)
        let room = Infinity;
        if (sink.maxPct) {
          room = Math.max(0, sink.maxPct - sinkItem.pct);
        } else if (stageCaps?.[sink.key]) {
          room = Math.max(0, stageCaps[sink.key] - sinkItem.pct);
        }

        const allocation = Math.min(
          remainingReduction * sink.weight,
          room * 0.97 // 0.97 buffer - rezerva pre normalizáciu
        );

        if (allocation > 0.01) {
          sinkItem.pct += allocation;
          remainingReduction -= allocation;

          console.log(
            `[EnforceRiskCap]   → ${sink.key} +${allocation.toFixed(2)} p.b. (weight ${sink.weight.toFixed(2)}, room ${room.toFixed(1)}%)`
          );
        }
      }

      // Ak všetky sinks full → auto jump to direct cut mode
      const allSinksFull = riskSinks.every(sink => {
        const item = mix.find(m => m.key === sink.key);
        return sink.maxPct && item && item.pct >= sink.maxPct;
      });

      if (allSinksFull && remainingReduction > 0.05) {
        console.warn(`[EnforceRiskCap] All sinks full (${remainingReduction.toFixed(2)} p.b. remaining), jumping to direct cut mode`);
        // Set iterations to 9 to trigger direct cut on next iteration
        // (current iteration už zredukovalo asset, redistribúcia failed)
      }
    } else {
      // DIRECT CUT MODE (iteration 9-10)
      console.warn(`[EnforceRiskCap] DIRECT CUT MODE (iteration ${iterations}): Force cut high-risk assets → bonds/bond9 ONLY`);

      // Cut ALL remaining high-risk assets (dyn/crypto/real/ETF)
      const cutTargets = ["dyn", "crypto", "real", "etf"];
      let totalCut = 0;

      for (const key of cutTargets) {
        const item = mix.find(m => m.key === key);
        if (!item || item.pct < 0.1) continue;

        // Cut 50% (alebo all, ak risk stále vysoký)
        const cutAmount = item.pct * 0.5;
        item.pct -= cutAmount;
        totalCut += cutAmount;

        console.log(`[EnforceRiskCap]   → ${key} -${cutAmount.toFixed(1)}% (direct cut 50%)`);
      }

      // Redistribute CUT amount to bonds/bond9 ONLY (50/50 split, NO gold/cash/ETF!)
      const bondsIdx = mix.findIndex(m => m.key === "bonds");
      const bond9Idx = mix.findIndex(m => m.key === "bond3y9");

      if (bondsIdx >= 0) {
        mix[bondsIdx].pct += totalCut * 0.50;
        console.log(`[EnforceRiskCap]   → bonds +${(totalCut * 0.50).toFixed(1)}% (direct cut redistribution)`);
      }
      if (bond9Idx >= 0) {
        mix[bond9Idx].pct += totalCut * 0.50;
        console.log(`[EnforceRiskCap]   → bond3y9 +${(totalCut * 0.50).toFixed(1)}% (direct cut redistribution)`);
      }

      remainingReduction = 0; // Direct cut handled redistribution
    }

    // Ak STÁLE zostal remainder po normal mode → warning (nie error, pokračuj)
    if (remainingReduction > 0.1 && iterations < 9) {
      console.warn(
        `[EnforceRiskCap] Cannot redistribute ${remainingReduction.toFixed(2)} p.b. (will retry or switch to direct cut)`
      );
    }

    // Normalizuj a prepočítaj risk
    const normalized = normalize(mix);
    for (let i = 0; i < mix.length; i++) {
      mix[i].pct = normalized[i].pct;
    }

    currentRisk = riskScore0to10(mix, riskPref, 0);
    console.log(`[EnforceRiskCap] After iteration ${iterations}: risk ${currentRisk.toFixed(2)}`);

    // Early exit ak sme pod riskMax
    if (currentRisk <= riskMax) {
      break;
    }

    // Hard stop po 10 iteráciách (PR-34: znížené z 15 → 10)
    if (iterations >= maxIterations) {
      console.error(
        `[EnforceRiskCap] HARD STOP po ${maxIterations} iteráciách (risk ${currentRisk.toFixed(2)} / ${riskMax.toFixed(1)})`
      );
      break;
    }
  }

  // Warning ak stále nad riskMax (ale blízko)
  let warning: string | null = null;
  const tolerance = 1.5; // PR-33 FIX B: Zvýšená tolerancia (1.5 vs 0.5) – preferujeme mierny risk overflow vs DEADLOCK

  if (currentRisk > riskMax && currentRisk <= riskMax + tolerance) {
    warning = `⚠️ Risk blízko horného limitu profilu (${currentRisk.toFixed(1)} / ${riskMax.toFixed(1)})`;
    console.warn(`[EnforceRiskCap] ${warning}`);
  } else if (currentRisk > riskMax + tolerance) {
    warning = `⚠️ CRITICAL: Risk prekročil limit aj po ${iterations} iteráciách (${currentRisk.toFixed(1)} / ${riskMax.toFixed(1)})`;
    console.error(`[EnforceRiskCap] ${warning}`);
  }

  console.log(
    `[EnforceRiskCap] Final: ${initialRisk.toFixed(2)} → ${currentRisk.toFixed(2)} (${iterations} iterations)`
  );

  return {
    mix: normalize(mix),
    applied: iterations > 0,
    iterations,
    initialRisk,
    finalRisk: currentRisk,
    warning,
  };
}
