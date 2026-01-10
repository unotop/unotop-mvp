/**
 * Risk Cap Enforcement Module
 * 
 * PR-28: Finálna tvrdá brzda pre riziko portfólia.
 * PR-34: Profile-aware RISK_SINKS (B/G: bonds/IAD primárne, zlato secondary s cap checks)
 * PR-36 STEP 1: Remove DIRECT CUT MODE (catastrophic 50% cuts removed)
 * PR-36 STEP 2: cap+1.0 stop condition (risk <= riskMax + 1.0 je OK)
 * PR-36 STEP 3: tryRedistribute() helper (clean, testovateľné)
 * PR-36 STEP 4: Exponential step-down (2.0 → 0.125 p.b., 5 pokusov)
 * 
 * Aplikuje sa ako posledný krok (STEP 8) po všetkých policy adjustments.
 * 
 * Algoritmus:
 * 1. Skontroluj, či riskScore <= riskMax + 1.0 (PR-36 STEP 2: +1.0 tolerancia)
 * 2. Ak nie, iteratívne znižuj najrizikovejšie assety (max 10 krokov)
 * 3. Redistribuj do bezpečných assetov podľa profilu (RISK_SINKS)
 * 4. PR-36 STEP 4: Ak redistribúcia zlyhá → exponential step-down (rollback + menší step)
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
 * PR-36 STEP 3: Helper funkcia pre redistribúciu
 * 
 * Distribuuje reduction do risk sinks podľa váh a kapacít.
 * Čistá funkcia (no side effects) pre jednoduchšie unit testy.
 * 
 * @param mix - Mix (bude mutovaný)
 * @param reduction - Počet p.b. na redistribúciu
 * @param riskSinks - Zoznam sinks s váhami a maxPct
 * @param stageCaps - Fallback caps (ak sink.maxPct nie je definované)
 * @returns Počet p.b., ktoré sa nepodarilo redistribuovať
 */
function tryRedistribute(
  mix: MixItem[],
  reduction: number,
  riskSinks: Array<{ key: MixItem["key"]; weight: number; maxPct?: number }>,
  stageCaps?: Record<string, number>
): number {
  let remaining = reduction;

  for (const sink of riskSinks) {
    const sinkItem = mix.find(m => m.key === sink.key);
    if (!sinkItem) continue;

    // Skip ak sink už plný (maxPct cap)
    if (sink.maxPct && sinkItem.pct >= sink.maxPct) {
      continue;
    }

    // Calculate available room
    let room = Infinity;
    if (sink.maxPct) {
      room = Math.max(0, sink.maxPct - sinkItem.pct);
    } else if (stageCaps?.[sink.key]) {
      room = Math.max(0, stageCaps[sink.key] - sinkItem.pct);
    }

    // Allocate weighted portion, but not more than room
    const allocation = Math.min(
      remaining * sink.weight,
      room * 0.97 // 0.97 buffer pre normalizáciu
    );

    if (allocation > 0.01) {
      sinkItem.pct += allocation;
      remaining -= allocation;
    }
  }

  return remaining;
}

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
  maxIterations = 10, // PR-34: Znížené z 15 → 10 (iteration 9-10 = direct cut mode)
  customRiskMax?: number // PR-37: Override riskMax (pre malé plány)
): EnforceRiskCapResult {
  const mix = [...baseMix];
  const riskMax = customRiskMax ?? getRiskMax(riskPref); // PR-37: Use custom if provided
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

    // PR-36 STEP 4: Exponential step-down s rollback
    // Ak redistribúcia zlyhá (remaining > threshold), skús menší step
    const MIN_STEP = 0.125; // Minimálny step (p.b.)
    const MAX_STEP_ATTEMPTS = 5; // Max pokusov (2.0 → 1.0 → 0.5 → 0.25 → 0.125)
    const REDISTRIBUTION_THRESHOLD = 1.0; // Ak zostane > 1.0 p.b., považuj za fail

    let baseStep = Math.min(5, Math.max(2, currentPct * 0.2)); // Štandardný step (2-5 p.b.)
    let attemptedStep = baseStep;
    let remainingReduction = Infinity;
    let stepAttempts = 0;
    let finalReductionStep = 0;

    // Exponential step-down loop
    while (stepAttempts < MAX_STEP_ATTEMPTS && attemptedStep >= MIN_STEP) {
      stepAttempts++;

      // Pokus o cut
      const reducedPct = Math.max(0, currentPct - attemptedStep);
      const actualReduction = currentPct - reducedPct;
      
      // Dočasný cut (rollback ak zlyhá)
      const originalPct = mix[assetIndex].pct;
      mix[assetIndex].pct = reducedPct;

      // Skús redistribúciu
      remainingReduction = tryRedistribute(mix, actualReduction, riskSinks, stageCaps);

      // Check: Podarilo sa redistribuovať aspoň väčšinu?
      if (remainingReduction <= REDISTRIBUTION_THRESHOLD) {
        // ✓ SUCCESS: Redistribúcia OK (alebo akceptovateľný zvyšok)
        finalReductionStep = actualReduction;
        console.log(
          `[EnforceRiskCap] Iteration ${iterations}: ${reducedKey} ${currentPct.toFixed(2)}% → ${reducedPct.toFixed(2)}% (-${actualReduction.toFixed(2)} p.b., attempt ${stepAttempts})`
        );
        
        if (remainingReduction < 0.01) {
          console.log(`[EnforceRiskCap]   ✓ Redistribúcia OK (${actualReduction.toFixed(2)} p.b. presunutých do sinks)`);
        } else {
          console.warn(`[EnforceRiskCap]   ⚠️ Čiastočná redistribúcia (${remainingReduction.toFixed(2)} p.b. nezaradených, akceptovateľné)`);
        }
        break; // Exit step-down loop, pokračuj ďalšou iteráciou
      } else {
        // ✗ FAIL: Rollback + skús menší step
        mix[assetIndex].pct = originalPct; // Rollback cut
        console.warn(
          `[EnforceRiskCap]   → ROLLBACK ${reducedKey} -${actualReduction.toFixed(2)} p.b. (${remainingReduction.toFixed(2)} p.b. nemohol byť redistribuovaný)`
        );

        // Exponential step-down
        attemptedStep = attemptedStep / 2;
        
        if (attemptedStep >= MIN_STEP) {
          console.log(`[EnforceRiskCap]   → Pokúšam sa s menším stepom: ${attemptedStep.toFixed(3)} p.b. (attempt ${stepAttempts + 1}/${MAX_STEP_ATTEMPTS})`);
        } else {
          console.error(`[EnforceRiskCap]   → Minimálny step ${MIN_STEP} dosiahnutý, nemôžem ďalej znižovať`);
          break;
        }
      }
    }

    // Ak všetky pokusy zlyhali → HARD STOP (mix je v pôvodnom stave po rollbackoch)
    if (remainingReduction > REDISTRIBUTION_THRESHOLD && stepAttempts >= MAX_STEP_ATTEMPTS) {
      console.error(
        `[EnforceRiskCap] ✗ Redistribúcia zlyhal po ${MAX_STEP_ATTEMPTS} pokusoch (sinks full alebo cap limit). Ukončujem enforcement.`
      );
      break; // Exit main while loop
    }

    // Normalizuj a prepočítaj risk
    const normalized = normalize(mix);
    for (let i = 0; i < mix.length; i++) {
      mix[i].pct = normalized[i].pct;
    }

    currentRisk = riskScore0to10(mix, riskPref, 0);
    console.log(`[EnforceRiskCap] After iteration ${iterations}: risk ${currentRisk.toFixed(2)}`);

    // PR-36 STEP 2: Early exit ak sme pod riskMax + 1.0 (tolerancia)
    const CAP_TOLERANCE = 1.0;
    if (currentRisk <= riskMax + CAP_TOLERANCE) {
      console.log(`[EnforceRiskCap] ✓ Risk OK (${currentRisk.toFixed(2)} <= ${(riskMax + CAP_TOLERANCE).toFixed(1)})`);
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

  // PR-36 STEP 2: Warning len ak prekročil cap+1.0 (už nie pri miernych overshootoch)
  let warning: string | null = null;
  const CAP_TOLERANCE = 1.0; // PR-36: Konzistentná tolerancia
  const WARN_THRESHOLD = 0.5; // Extra buffer pre warning (cap+1.5)

  if (currentRisk > riskMax + CAP_TOLERANCE && currentRisk <= riskMax + CAP_TOLERANCE + WARN_THRESHOLD) {
    warning = `⚠️ Risk mierne nad cap+1.0 (${currentRisk.toFixed(1)} / ${(riskMax + CAP_TOLERANCE).toFixed(1)})`;
    console.warn(`[EnforceRiskCap] ${warning}`);
  } else if (currentRisk > riskMax + CAP_TOLERANCE + WARN_THRESHOLD) {
    warning = `⚠️ CRITICAL: Risk výrazne prekročil cap+1.0 po ${iterations} iteráciách (${currentRisk.toFixed(1)} / ${(riskMax + CAP_TOLERANCE).toFixed(1)})`;
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
