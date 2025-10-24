/**
 * Lump Sum Scaling - Caps na rizikové assets pri vysokých jednorazových vkladoch
 * 
 * Logika: Čím väčšia suma, tým väčšia potreba ochrany kapitálu.
 * - Dynamické riadenie: Max 10% pri 500k+, max 5% pri 5M+
 * - Krypto: Postupne na 0% pri mega-sumách
 * - Presun do: Bonds > Zlato > ETF (bezpečné assets)
 */

import type { MixItem } from "../mix/mix.service";
import { normalize } from "../mix/mix.service";

interface TierConfig {
  threshold: number;
  caps: Partial<Record<MixItem["key"], number>>;
  boosts: Partial<Record<MixItem["key"], number>>;
}

const LUMP_SUM_TIERS: TierConfig[] = [
  {
    threshold: 5_000_000, // 5M+
    caps: { dyn: 5, crypto: 0 }, // Ultra-safe
    boosts: { bonds: 2.5, bond3y9: 2.5, gold: 2.0, etf: 1.3 },
  },
  {
    threshold: 1_000_000, // 1M - 5M
    caps: { dyn: 8, crypto: 2 }, // Minimálne riziko
    boosts: { bonds: 2.0, bond3y9: 2.0, gold: 1.8, etf: 1.2 },
  },
  {
    threshold: 500_000, // 500k - 1M
    caps: { dyn: 10, crypto: 4 }, // User's cap
    boosts: { bonds: 1.6, bond3y9: 1.6, gold: 1.5, etf: 1.15 },
  },
  {
    threshold: 250_000, // 250k - 500k
    caps: { dyn: 14, crypto: 5 },
    boosts: { bonds: 1.4, bond3y9: 1.4, gold: 1.3, etf: 1.1 },
  },
  {
    threshold: 100_000, // 100k - 250k
    caps: { dyn: 16, crypto: 6 },
    boosts: { bonds: 1.2, bond3y9: 1.2, gold: 1.2, etf: 1.05 },
  },
];

/**
 * Aplikuj caps a boosts podľa výšky lump sum investície
 */
export function scaleMixByLumpSum(
  baseMix: MixItem[],
  lumpSumEur: number
): MixItem[] {
  if (lumpSumEur < 100_000) return baseMix; // Pod 100k bez zmeny

  // Nájdi aplikovateľný tier (prvý, kde lumpSum >= threshold)
  const tier = LUMP_SUM_TIERS.find((t) => lumpSumEur >= t.threshold);
  if (!tier) return baseMix;

  let result = baseMix.map((item) => {
    const cap = tier.caps[item.key];
    const boost = tier.boosts[item.key];

    // Aplikuj cap na rizikové assets
    if (cap !== undefined) {
      return { ...item, pct: Math.min(item.pct, cap) };
    }

    // Aplikuj boost na safe assets
    if (boost !== undefined) {
      return { ...item, pct: item.pct * boost };
    }

    return item;
  });

  // Normalize na 100%
  return normalize(result);
}

/**
 * Získaj info o aplikovanom tier (pre UI feedback)
 */
export function getLumpSumTierInfo(lumpSumEur: number): {
  applied: boolean;
  threshold: number;
  message: string;
} | null {
  if (lumpSumEur < 100_000) return null;

  const tier = LUMP_SUM_TIERS.find((t) => lumpSumEur >= t.threshold);
  if (!tier) return null;

  return {
    applied: true,
    threshold: tier.threshold,
    message: `Pri investícii ${(lumpSumEur / 1_000_000).toFixed(1)}M EUR sme upravili portfólio pre maximálnu ochranu kapitálu (dyn ≤ ${tier.caps.dyn}%, crypto ≤ ${tier.caps.crypto || 0}%).`,
  };
}
