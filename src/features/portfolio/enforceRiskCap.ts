/**
 * Risk Cap Enforcement Module
 * 
 * PR-28: Finálna tvrdá brzda pre riziko portfólia.
 * Aplikuje sa ako posledný krok (STEP 8) po všetkých policy adjustments.
 * 
 * Algoritmus:
 * 1. Skontroluj, či riskScore <= riskMax
 * 2. Ak nie, iteratívne znižuj najrizikovejšie assety (max 15 krokov)
 * 3. Redistribuj do bezpečných assetov podľa profilu
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
 * Bezpečné targety (podľa profilu):
 * - Konzervatívny: Gold → Dlhopis 7,5% → ETF
 * - Vyvážený: Gold + ETF + Dlhopis 7,5%
 * - Rastový: ETF → Gold → Dlhopis 7,5%
 */

import type { MixItem } from "../mix/mix.service";
import type { RiskPref } from "../mix/assetModel";
import { normalize } from "../mix/mix.service";
import { riskScore0to10 } from "../mix/assetModel";
import { getRiskMax } from "../policy/risk";

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

/**
 * Bezpečné assety pre redistribúciu (podľa profilu)
 * 
 * PR-28 FIX v2: PRIMARY + FALLBACK targets
 * PRIMARY = gold + cash (preferované, najnižšie riziko)
 * FALLBACK = bonds (ak gold+cash na limite, riešime deadlock)
 * 
 * SAFE TARGETS = assety, ktoré sa NIKDY neznižujú v enforceRiskCap
 * → Len GOLD a CASH (najnižšie riziko)
 */
const SAFE_TARGETS_PRIMARY: Record<RiskPref, { key: MixItem["key"]; weight: number }[]> = {
  konzervativny: [
    { key: "gold", weight: 0.70 },   // 70% do zlata
    { key: "cash", weight: 0.30 },   // 30% do cash
  ],
  vyvazeny: [
    { key: "gold", weight: 0.60 },   // 60% do zlata
    { key: "cash", weight: 0.40 },   // 40% do cash
  ],
  rastovy: [
    { key: "gold", weight: 0.50 },   // 50% do zlata
    { key: "cash", weight: 0.50 },   // 50% do cash
  ],
};

/**
 * FALLBACK targets pre deadlock scenáre (gold+cash plné)
 * PR-33 FIX B: ODSTRÁNENÝ ETF (predchádza cap overflow), pridaný IAD
 * Bonds ~1.5-2.0 risk, IAD (bond9) ~1.0 risk – bezpečnejšie než ETF
 */
const SAFE_TARGETS_FALLBACK: Record<RiskPref, { key: MixItem["key"]; weight: number }[]> = {
  konzervativny: [
    { key: "bonds", weight: 0.60 },  // bond5 + bondShort
    { key: "iad", weight: 0.40 },    // bond9 (garantované, cap 15%)
  ],
  vyvazeny: [
    { key: "bonds", weight: 0.60 },
    { key: "iad", weight: 0.40 },
  ],
  rastovy: [
    { key: "bonds", weight: 0.60 },
    { key: "iad", weight: 0.40 },
  ],
};

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
 * Iteratívne znižuje najrizikovejšie assety, kým riskScore <= riskMax.
 * Max 15 iterácií, v každej iterácii odoberie 2-5 p.b. z najrizikovejšieho assetu.
 * 
 * PR-28 CRITICAL FIX: Rešpektuje stage caps (gold max 40%) pri redistribúcii!
 * Ak gold nemá room → všetko do cash.
 * Ak ani cash nemá room → STOP (validation fail je lepšie než infinite loop).
 * 
 * @param baseMix - Mix pred aplikáciou risk cap
 * @param riskPref - Rizikový profil
 * @param stageCaps - Stage caps (gold, cash limity) - REQUIRED!
 * @param maxIterations - Max počet iterácií (default 15)
 * @returns Upravený mix + info o risk enforcement
 */
export function enforceRiskCap(
  baseMix: MixItem[],
  riskPref: RiskPref,
  stageCaps?: Record<string, number>, // PR-28 FIX: Pridaný parameter
  maxIterations = 15
): EnforceRiskCapResult {
  const mix = [...baseMix];
  const riskMax = getRiskMax(riskPref);
  const safeTargetsPrimary = SAFE_TARGETS_PRIMARY[riskPref];
  const safeTargetsFallback = SAFE_TARGETS_FALLBACK[riskPref];

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
    let reducedKey: MixItem["key"] | null = null;
    for (const key of RISK_ORDERED_KEYS) {
      const asset = mix.find((m) => m.key === key);
      if (asset && asset.pct > 0) {
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

    // PR-28 FIX v2: Redistribuuj s 2-úrovňovým fallbackom
    // LEVEL 1: Primary targets (gold+cash) s rešpektom ku stage caps
    // LEVEL 2: Fallback targets (bonds/ETF) ak gold+cash plné
    
    const goldCap = stageCaps?.["gold"] ?? 100;
    const cashCap = stageCaps?.["cash"] ?? 100;

    const goldIndex = mix.findIndex((m) => m.key === "gold");
    const cashIndex = mix.findIndex((m) => m.key === "cash");

    const currentGold = goldIndex !== -1 ? mix[goldIndex].pct : 0;
    const currentCash = cashIndex !== -1 ? mix[cashIndex].pct : 0;

    const goldRoom = Math.max(0, goldCap - currentGold);
    const cashRoom = Math.max(0, cashCap - currentCash);

    let remainingReduction = actualReduction;

    // LEVEL 1: Skús primary targets (gold+cash)
    for (const target of safeTargetsPrimary) {
      const targetIndex = mix.findIndex((m) => m.key === target.key);
      if (targetIndex === -1) continue;

      let availableRoom = Infinity;
      if (target.key === "gold") {
        availableRoom = goldRoom;
      } else if (target.key === "cash") {
        availableRoom = cashRoom;
      }

      // Prísna kontrola: pridaj LEN toľko, koľko sa zmestí (zaokrúhľuj dole)
      const targetAllocation = Math.min(
        actualReduction * target.weight,
        availableRoom * 0.97 // 0.97 buffer (advisor verdikt PR-28) - rezerva pre normalizáciu
      );
      
      if (targetAllocation > 0.01) {
        mix[targetIndex].pct += targetAllocation;
        remainingReduction -= targetAllocation;

        console.log(
          `[EnforceRiskCap]   → ${target.key} +${targetAllocation.toFixed(2)} p.b. (weight ${target.weight}, room ${availableRoom.toFixed(1)}%)`
        );
      }
    }

    // LEVEL 2: Ak zostal remainder → FALLBACK na bonds/ETF
    if (remainingReduction > 0.01) {
      console.warn(
        `[EnforceRiskCap]   ⚠️ Primary full (gold ${currentGold.toFixed(1)}%, cash ${currentCash.toFixed(1)}%), using FALLBACK (${remainingReduction.toFixed(2)} p.b.)`
      );

      for (const target of safeTargetsFallback) {
        const targetIndex = mix.findIndex((m) => m.key === target.key);
        if (targetIndex === -1) continue;

        const targetCap = stageCaps?.[target.key] ?? 100;
        const currentPct = mix[targetIndex].pct;
        const targetRoom = Math.max(0, targetCap - currentPct);

        const targetAllocation = Math.min(
          remainingReduction * target.weight,
          targetRoom * 0.97 // 0.97 buffer (advisor verdikt PR-28) - rezerva pre normalizáciu
        );

        if (targetAllocation > 0.01) {
          mix[targetIndex].pct += targetAllocation;
          remainingReduction -= targetAllocation;

          console.log(
            `[EnforceRiskCap]   → ${target.key} +${targetAllocation.toFixed(2)} p.b. (FALLBACK, room ${targetRoom.toFixed(1)}%)`
          );
        }
      }
    }

    // PR-33 FIX B: EMERGENCY FALLBACK po 10 iteráciách (predchádza DEADLOCK)
    if (iterations >= 10 && remainingReduction > 0.05) {
      console.warn(
        `[EnforceRiskCap] EMERGENCY FALLBACK (iteration ${iterations}): Vynulujem rizikovú časť portfólia`
      );

      // NULUJ riziká: dyn, crypto, real
      const emergencyReduction = mix
        .filter(m => ['dyn', 'crypto', 'real'].includes(m.key))
        .reduce((sum, m) => sum + m.pct, 0);

      mix.forEach(m => {
        if (['dyn', 'crypto', 'real'].includes(m.key)) {
          console.log(`[EnforceRiskCap]   → ${m.key} ${m.pct.toFixed(1)}% → 0% (emergency)`);
          m.pct = 0;
        }
      });

      // REDISTRIBUUJ do bezpečných aktív OKREM ETF (predchádza cap overflow)
      // Priorita: IAD (bond9) > bonds (bond5/bondShort) > gold
      const safeTargets = [
        { key: 'iad', weight: 0.50, cap: riskPref === 'konzervativny' ? 15 : 25 },
        { key: 'bonds', weight: 0.30, cap: 30 },
        { key: 'gold', weight: 0.20, cap: 40 }
      ];

      let emergencyRemaining = emergencyReduction;

      for (const target of safeTargets) {
        const targetIndex = mix.findIndex(m => m.key === target.key);
        if (targetIndex === -1) continue;

        const currentPct = mix[targetIndex].pct;
        const targetRoom = Math.max(0, target.cap - currentPct);
        const allocation = Math.min(
          emergencyRemaining * target.weight,
          targetRoom * 0.95
        );

        if (allocation > 0.01) {
          mix[targetIndex].pct += allocation;
          emergencyRemaining -= allocation;
          console.log(
            `[EnforceRiskCap]   → ${target.key} +${allocation.toFixed(2)} p.b. (emergency safe haven)`
          );
        }
      }

      // Ak STÁLE zostalo → akceptuj (lepšie ako infinite loop)
      if (emergencyRemaining > 0.1) {
        console.warn(
          `[EnforceRiskCap] Emergency: Zostalo ${emergencyRemaining.toFixed(2)} p.b. nedistribuovaných (akceptované)`
        );
      }
    } else if (remainingReduction > 0.1) {
      // Normálny DEADLOCK warning (ale pokračuj, nie break)
      console.error(
        `[EnforceRiskCap] DEADLOCK: Cannot redistribute ${remainingReduction.toFixed(2)} p.b. (all targets full: gold ${currentGold.toFixed(1)}%, cash ${currentCash.toFixed(1)}%)`
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

    // Hard stop po 15 iteráciách (aj s emergency fallback)
    if (iterations >= 15) {
      console.error(
        `[EnforceRiskCap] HARD STOP po 15 iteráciách (risk ${currentRisk.toFixed(2)} / ${riskMax.toFixed(1)})`
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
