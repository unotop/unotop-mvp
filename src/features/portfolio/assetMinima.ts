/**
 * Asset Minima Policy Module
 * 
 * PR-28: Jednotné minimálne vstupy pre celý plán (effectivePlanVolume).
 * Assety, ktoré nesplňajú minimum, sa vynulujú a prerozdelí do gold/ETF.
 * 
 * Pravidlá:
 * - Gold: >= 0 € (vždy dostupné)
 * - ETF: >= 0 € (vždy dostupné)
 * - Dynamické riadenie: >= 1 000 €
 * - Dlhopis 7,5%: >= 2 500 €
 * - Dlhopis 9%: >= 10 000 €
 * - Krypto: >= 0 € (vždy dostupné)
 * - Reality: >= 50 000 €
 * - Cash: >= 0 € (vždy dostupné)
 * 
 * Reallokácia locked assetov:
 * - Konzervatívny: 70% → zlato, 30% → ETF
 * - Vyvážený: 50% → zlato, 50% → ETF
 * - Rastový: 30% → zlato, 70% → ETF
 */

import type { MixItem } from "../mix/mix.service";
import type { RiskPref } from "../mix/assetModel";
import { normalize } from "../mix/mix.service";

/**
 * Minimálne objemy pre jednotlivé assety (EUR)
 */
export const ASSET_MINIMA: Record<string, number> = {
  gold: 0,       // Vždy dostupné
  etf: 0,        // Vždy dostupné
  dyn: 1_000,    // Dynamické riadenie
  bonds: 2_500,  // Dlhopis 7,5%
  bond3y9: 10_000, // Dlhopis 9%
  crypto: 0,     // Vždy dostupné
  real: 50_000,  // Reality
  cash: 0,       // Vždy dostupné
};

/**
 * Reallokačné ratio pre locked assety (zlato vs ETF)
 */
const REALLOC_RATIOS: Record<RiskPref, { gold: number; etf: number }> = {
  konzervativny: { gold: 0.70, etf: 0.30 }, // 70% zlato, 30% ETF
  vyvazeny: { gold: 0.50, etf: 0.50 },      // 50/50
  rastovy: { gold: 0.30, etf: 0.70 },       // 30% zlato, 70% ETF
};

/**
 * Levely plánu pre UX ("Sila vášho plánu" box)
 */
export type PlanLevel = "Mini" | "Štart" | "Štandard" | "Silný" | "Prémiový";

export const PLAN_LEVEL_TIERS: { min: number; max: number; level: PlanLevel; description: string }[] = [
  { min: 0, max: 5_000, level: "Mini", description: "skôr symbolické sporenie." },
  { min: 5_000, max: 20_000, level: "Štart", description: "rozumný začiatok budovania majetku." },
  { min: 20_000, max: 50_000, level: "Štandard", description: "plán, ktorý už vie výrazne pomôcť." },
  { min: 50_000, max: 100_000, level: "Silný", description: "plne využívate naše nástroje." },
  { min: 100_000, max: Infinity, level: "Prémiový", description: "pracujete s kapitálom ako investor." },
];

export interface AssetEligibility {
  key: string;
  eligible: boolean;
  minVolume: number;
  currentVolume: number;
}

export interface AssetMinimaResult {
  mix: MixItem[];
  applied: boolean;
  eligibility: AssetEligibility[];
  totalRealloc: number; // Celková redistribúcia (p.b.)
  goldAdded: number;    // Pridané do zlata (p.b.)
  etfAdded: number;     // Pridané do ETF (p.b.)
}

/**
 * Vypočítaj effectivePlanVolume = lumpSum + monthly * horizonYears * 12
 * 
 * @param lumpSum - Jednorazová investícia (EUR)
 * @param monthly - Mesačný vklad (EUR)
 * @param horizonYears - Investičný horizont (roky)
 * @returns Celkový objem plánu (EUR)
 */
export function calculateEffectivePlanVolume(
  lumpSum: number,
  monthly: number,
  horizonYears: number
): number {
  return lumpSum + monthly * horizonYears * 12;
}

/**
 * Získaj level plánu podľa effectivePlanVolume
 * 
 * @param volume - effectivePlanVolume (EUR)
 * @returns Tier objekt { min, max, level, description }
 */
export function getPlanLevel(volume: number): typeof PLAN_LEVEL_TIERS[number] {
  return PLAN_LEVEL_TIERS.find((tier) => volume >= tier.min && volume < tier.max) || PLAN_LEVEL_TIERS[0];
}

/**
 * Získaj ďalší level (pre motivačný nudge)
 * 
 * @param currentVolume - effectivePlanVolume (EUR)
 * @returns Ďalší tier alebo null (ak už je Prémiový)
 */
export function getNextPlanLevel(currentVolume: number): typeof PLAN_LEVEL_TIERS[number] | null {
  const currentTier = getPlanLevel(currentVolume);
  const currentIndex = PLAN_LEVEL_TIERS.indexOf(currentTier);
  return PLAN_LEVEL_TIERS[currentIndex + 1] || null;
}

/**
 * Skontroluj, ktoré assety sú eligible podľa effectivePlanVolume
 * 
 * @param volume - effectivePlanVolume (EUR)
 * @returns Pole AssetEligibility objektov
 */
export function checkAssetEligibility(volume: number): AssetEligibility[] {
  return Object.entries(ASSET_MINIMA).map(([key, minVolume]) => ({
    key,
    eligible: volume >= minVolume,
    minVolume,
    currentVolume: volume,
  }));
}

/**
 * Aplikuj asset minima na mix
 * 
 * Assety, ktoré nesplňajú minimum, sa vynulujú.
 * Ich podiel sa prerozdelí do gold/ETF podľa profilu.
 * 
 * @param baseMix - Mix pred aplikáciou asset minima
 * @param riskPref - Rizikový profil
 * @param effectivePlanVolume - Celkový objem plánu (EUR)
 * @returns Upravený mix + info o realloce
 */
export function applyAssetMinima(
  baseMix: MixItem[],
  riskPref: RiskPref,
  effectivePlanVolume: number
): AssetMinimaResult {
  const mix = [...baseMix];
  const ratio = REALLOC_RATIOS[riskPref];
  const eligibility = checkAssetEligibility(effectivePlanVolume);

  let totalRealloc = 0;
  let goldAdded = 0;
  let etfAdded = 0;

  // Prejdi všetky assety a vynuluj locked
  for (const asset of eligibility) {
    if (!asset.eligible) {
      const assetIndex = mix.findIndex((m) => m.key === asset.key);
      if (assetIndex !== -1 && mix[assetIndex].pct > 0) {
        const lockedPct = mix[assetIndex].pct;
        mix[assetIndex].pct = 0;
        totalRealloc += lockedPct;

        console.log(
          `[AssetMinima] Locked ${asset.key}: ${lockedPct.toFixed(2)}% (min ${asset.minVolume} €, current ${effectivePlanVolume.toFixed(0)} €)`
        );
      }
    }
  }

  // Ak bola nejaká reallokácia, prerozdeľ do gold/ETF
  if (totalRealloc > 0) {
    const goldTarget = totalRealloc * ratio.gold;
    const etfTarget = totalRealloc * ratio.etf;

    const goldIndex = mix.findIndex((m) => m.key === "gold");
    const etfIndex = mix.findIndex((m) => m.key === "etf");

    if (goldIndex !== -1) {
      mix[goldIndex].pct += goldTarget;
      goldAdded = goldTarget;
    }

    if (etfIndex !== -1) {
      mix[etfIndex].pct += etfTarget;
      etfAdded = etfTarget;
    }

    console.log(
      `[AssetMinima] Realloc ${totalRealloc.toFixed(2)}% → gold +${goldAdded.toFixed(2)}%, ETF +${etfAdded.toFixed(2)}%`
    );
  }

  return {
    mix: normalize(mix),
    applied: totalRealloc > 0,
    eligibility,
    totalRealloc,
    goldAdded,
    etfAdded,
  };
}

/**
 * Vypočítaj delta do ďalšieho levelu + extra monthly potrebný
 * 
 * @param currentVolume - effectivePlanVolume (EUR)
 * @param horizonYears - Investičný horizont (roky)
 * @returns { deltaEur, extraMonthly } alebo null (ak už je Prémiový)
 */
export function calculateDeltaToNextLevel(
  currentVolume: number,
  horizonYears: number
): { deltaEur: number; extraMonthly: number; nextLevel: PlanLevel } | null {
  const nextTier = getNextPlanLevel(currentVolume);
  if (!nextTier) return null; // Už je Prémiový

  const deltaEur = nextTier.min - currentVolume;
  const extraMonthly = horizonYears > 0 ? deltaEur / (horizonYears * 12) : 0;

  return {
    deltaEur,
    extraMonthly: Math.ceil(extraMonthly / 5) * 5, // Zaokrúhli na 5 € hore
    nextLevel: nextTier.level,
  };
}
