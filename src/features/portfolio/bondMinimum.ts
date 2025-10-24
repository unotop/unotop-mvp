/**
 * Bond Minimum Handling - Dlhopisy možno kupovať od 2500 EUR
 * 
 * Logika:
 * - Ak prvý rok investovania < 2500 EUR → bonds unavailable
 * - Presun bond allocation: 70% do cash (bezpečné), 30% do ETF (rast)
 * - Return warning flag pre UI
 */

import type { MixItem } from "../mix/mix.service";
import { normalize } from "../mix/mix.service";

const BOND_MINIMUM_EUR = 2500;

/**
 * Skontroluj, či je dostatok kapitálu na nákup dlhopisov
 */
export function canPurchaseBonds(
  lumpSumEur: number,
  monthlyEur: number
): boolean {
  const totalFirstYear = lumpSumEur + monthlyEur * 12;
  return totalFirstYear >= BOND_MINIMUM_EUR;
}

/**
 * Aplikuj bond minimum - ak nedosahuje, presun do cash/ETF
 */
export function applyBondMinimum(
  mix: MixItem[],
  lumpSumEur: number,
  monthlyEur: number,
  horizonYears: number
): { mix: MixItem[]; bondWarning: boolean } {
  const totalFirstYear = lumpSumEur + monthlyEur * 12;

  // Má dosť na dlhopisy?
  if (totalFirstYear >= BOND_MINIMUM_EUR) {
    return { mix, bondWarning: false };
  }

  // Nemá dosť → presun bonds do cash (70%) a ETF (30%)
  // PRE KONZERVATIVNY PROFIL: 100% do cash (aby sme nezvýšili riziko)
  const bondsTotal = mix.find((m) => m.key === "bonds")?.pct || 0;
  const bond3y9Total = mix.find((m) => m.key === "bond3y9")?.pct || 0;
  const totalBondsPct = bondsTotal + bond3y9Total;

  if (totalBondsPct === 0) {
    // Žiadne bonds v mixe, nič nerobiť
    return { mix, bondWarning: false };
  }

  // Detekcia profilu: ak má ETF < 25% a gold > 15%, je to konzervativny
  const etfPct = mix.find((m) => m.key === "etf")?.pct || 0;
  const goldPct = mix.find((m) => m.key === "gold")?.pct || 0;
  const dynPct = mix.find((m) => m.key === "dyn")?.pct || 0;
  const isKonzervativny = etfPct < 25 && goldPct > 15;

  // Redistribúcia:
  // - Konzervativny: 70% gold (risk 0), 30% cash (risk 0) → udržíme nízke riziko
  // - Iné profily: 70% cash, 30% ETF
  const cashRatio = isKonzervativny ? 0.3 : 0.7;
  const goldRatio = isKonzervativny ? 0.7 : 0.0;
  const etfRatio = isKonzervativny ? 0.0 : 0.3;

  const adjustedMix = mix.map((item) => {
    if (item.key === "bonds" || item.key === "bond3y9") {
      return { ...item, pct: 0 };
    }
    if (item.key === "cash") {
      return { ...item, pct: item.pct + totalBondsPct * cashRatio };
    }
    if (item.key === "gold") {
      return { ...item, pct: item.pct + totalBondsPct * goldRatio };
    }
    if (item.key === "etf") {
      return { ...item, pct: item.pct + totalBondsPct * etfRatio };
    }
    return item;
  });

  return {
    mix: normalize(adjustedMix),
    bondWarning: true,
  };
}

/**
 * Získaj info o bond minimum (pre UI feedback)
 */
export function getBondMinimumInfo(
  lumpSumEur: number,
  monthlyEur: number
): {
  canPurchase: boolean;
  totalFirstYear: number;
  missingAmount: number;
  monthsToReach: number | null;
  message: string;
} {
  const totalFirstYear = lumpSumEur + monthlyEur * 12;
  const canPurchase = totalFirstYear >= BOND_MINIMUM_EUR;
  const missingAmount = Math.max(0, BOND_MINIMUM_EUR - totalFirstYear);

  let monthsToReach: number | null = null;
  if (!canPurchase && monthlyEur > 0) {
    monthsToReach = Math.ceil(missingAmount / monthlyEur);
  }

  let message = "";
  if (canPurchase) {
    message = `Máte dostatok kapitálu na nákup dlhopisov (${totalFirstYear.toLocaleString("sk-SK")} EUR v prvom roku).`;
  } else if (monthsToReach !== null) {
    message = `Dlhopisy možno zakúpiť od ${BOND_MINIMUM_EUR.toLocaleString("sk-SK")} EUR. Pri mesačnom vklade ${monthlyEur.toLocaleString("sk-SK")} EUR to dosiahnete za ${monthsToReach} ${monthsToReach === 1 ? "mesiac" : monthsToReach < 5 ? "mesiace" : "mesiacov"}. Dovtedy investujeme do hotovosti a ETF.`;
  } else {
    message = `Dlhopisy možno zakúpiť od ${BOND_MINIMUM_EUR.toLocaleString("sk-SK")} EUR. Zvýšte jednorazovú investíciu alebo mesačný vklad.`;
  }

  return {
    canPurchase,
    totalFirstYear,
    missingAmount,
    monthsToReach,
    message,
  };
}
