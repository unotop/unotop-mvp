/**
 * Monthly Scaling - Absolútny cap na dyn+crypto pri vysokých DCA vkladoch
 * 
 * Logika: Pri pravidelných vysokých vkladoch (2000+/mes) nechceme veľké 
 * objemy v volatilných assets. Cap 500 EUR mesačne na dyn+crypto spolu.
 * 
 * Presun prebytku: 50% bonds (25% každý), 30% gold, 20% ETF
 */

import type { MixItem } from "../mix/mix.service";
import { normalize } from "../mix/mix.service";

const MONTHLY_DYN_CRYPTO_CAP_EUR = 500; // Absolútny cap
const MONTHLY_THRESHOLD = 1000; // Začni škálovať od 1000 EUR/mes

/**
 * Aplikuj 500 EUR cap na dyn+crypto pri vysokých mesačných vkladoch
 */
export function scaleMixByMonthly(
  baseMix: MixItem[],
  monthlyEur: number
): MixItem[] {
  if (monthlyEur <= MONTHLY_THRESHOLD) return baseMix;

  // Vypočítaj súčasné alokácie v EUR
  const dynPct = baseMix.find((m) => m.key === "dyn")?.pct || 0;
  const cryptoPct = baseMix.find((m) => m.key === "crypto")?.pct || 0;

  const dynEur = (dynPct / 100) * monthlyEur;
  const cryptoEur = (cryptoPct / 100) * monthlyEur;
  const riskyTotalEur = dynEur + cryptoEur;

  if (riskyTotalEur <= MONTHLY_DYN_CRYPTO_CAP_EUR) {
    return baseMix; // Pod cap, OK
  }

  // Nad cap → preskaluj dyn/crypto proporcionálne na max 500 EUR spolu
  const scaleFactor = MONTHLY_DYN_CRYPTO_CAP_EUR / riskyTotalEur;
  const newDynPct = dynPct * scaleFactor;
  const newCryptoPct = cryptoPct * scaleFactor;

  // Koľko % sme ubrali?
  const freedPct = dynPct + cryptoPct - (newDynPct + newCryptoPct);

  // Redistribúcia: 50% bonds (25% každý), 30% gold, 20% ETF
  const bondsBoost = freedPct * 0.25;
  const bond3y9Boost = freedPct * 0.25;
  const goldBoost = freedPct * 0.3;
  const etfBoost = freedPct * 0.2;

  const result = baseMix.map((item) => {
    switch (item.key) {
      case "dyn":
        return { ...item, pct: newDynPct };
      case "crypto":
        return { ...item, pct: newCryptoPct };
      case "bonds":
        return { ...item, pct: item.pct + bondsBoost };
      case "bond3y9":
        return { ...item, pct: item.pct + bond3y9Boost };
      case "gold":
        return { ...item, pct: item.pct + goldBoost };
      case "etf":
        return { ...item, pct: item.pct + etfBoost };
      default:
        return item;
    }
  });

  return normalize(result);
}

/**
 * Získaj info o aplikovanom cap (pre UI feedback)
 */
export function getMonthlyCappingInfo(
  baseMix: MixItem[],
  monthlyEur: number
): {
  applied: boolean;
  capEur: number;
  originalEur: number;
  message: string;
} | null {
  if (monthlyEur <= MONTHLY_THRESHOLD) return null;

  const dynPct = baseMix.find((m) => m.key === "dyn")?.pct || 0;
  const cryptoPct = baseMix.find((m) => m.key === "crypto")?.pct || 0;
  const riskyTotalEur = ((dynPct + cryptoPct) / 100) * monthlyEur;

  if (riskyTotalEur <= MONTHLY_DYN_CRYPTO_CAP_EUR) return null;

  return {
    applied: true,
    capEur: MONTHLY_DYN_CRYPTO_CAP_EUR,
    originalEur: riskyTotalEur,
    message: `Pri mesačnom vklade ${monthlyEur.toLocaleString("sk-SK")} EUR sme obmedzili dynamické riadenie + krypto na max ${MONTHLY_DYN_CRYPTO_CAP_EUR} EUR (pôvodne ${Math.round(riskyTotalEur)} EUR). Zvyšok presmerovaný do dlhopisov a zlata.`,
  };
}
