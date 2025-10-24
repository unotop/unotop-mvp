/**
 * Cash Reserve Optimization - Dynamická úprava hotovosti podľa potrieb
 * 
 * Logika:
 * - Krátkodobá rezerva: 6 mesiacov výdavkov
 * - Strednodobá rezerva: Max 24 mesiacov výdavkov
 * - Caps pri veľkých portfóliách: 20k/30k/50k EUR (kapitál má pracovať)
 * 
 * Cash nie je investičný nástroj - len buffer na likviditu.
 */

import type { MixItem } from "../mix/mix.service";
import { normalize } from "../mix/mix.service";

export interface ReserveProfile {
  monthlyIncome: number;
  fixedExpenses: number;
  variableExpenses: number;
  reserveEur: number; // Už nasporená rezerva
  reserveMonths: number;
}

type ReserveType = "short" | "medium";

/**
 * Vypočítaj optimálnu cash % v portfóliu
 */
export function calculateOptimalCashPct(
  profile: ReserveProfile,
  totalPortfolioEur: number,
  reserveType: ReserveType = "short"
): number {
  // 1. Vypočítaj mesačné výdavky (fallback na 70% príjmu)
  const monthlyExpenses = profile.fixedExpenses + profile.variableExpenses;
  const monthlyBase =
    monthlyExpenses > 0 ? monthlyExpenses : profile.monthlyIncome * 0.7;

  // 2. Potrebná rezerva v EUR
  const shortTermMonths = 6;
  const mediumTermMonths = 24;
  const targetMonths =
    reserveType === "short" ? shortTermMonths : mediumTermMonths;

  let targetReserveEur = monthlyBase * targetMonths;

  // 3. Caps pri veľkých portfóliách (kapitál má pracovať, nie ležať)
  if (totalPortfolioEur >= 1_000_000) {
    targetReserveEur = Math.min(targetReserveEur, 50_000);
  } else if (totalPortfolioEur >= 500_000) {
    targetReserveEur = Math.min(targetReserveEur, 30_000);
  } else if (totalPortfolioEur >= 250_000) {
    targetReserveEur = Math.min(targetReserveEur, 20_000);
  }

  // 4. Už má nasporenú rezervu? Odráť ju
  const existingReserveEur = profile.reserveEur || 0;
  const neededReserveEur = Math.max(0, targetReserveEur - existingReserveEur);

  // 5. Aké % portfólia je to?
  if (totalPortfolioEur === 0) return 0;
  const cashPct = (neededReserveEur / totalPortfolioEur) * 100;

  // 6. Min 3%, max 15% (aby to bolo rozumné)
  return Math.max(3, Math.min(cashPct, 15));
}

/**
 * Upraví mix tak, aby cash bola optimálna
 */
export function adjustMixForCashReserve(
  baseMix: MixItem[],
  profile: ReserveProfile,
  lumpSumEur: number,
  monthlyEur: number,
  horizonYears: number
): MixItem[] {
  // Odhadni celkový portfólio value
  const totalPortfolioEur = lumpSumEur + monthlyEur * 12 * horizonYears;

  // Vypočítaj optimálnu cash %
  const optimalCashPct = calculateOptimalCashPct(
    profile,
    totalPortfolioEur,
    "short"
  );

  const currentCashPct = baseMix.find((m) => m.key === "cash")?.pct || 0;

  // Ak je rozdiel malý (< 2%), nechaj ako je
  if (Math.abs(currentCashPct - optimalCashPct) < 2) {
    return baseMix;
  }

  const delta = optimalCashPct - currentCashPct;

  // Redistribúcia:
  // - Ak delta > 0: Potrebujeme viac cash → uber z ETF/bonds/gold proporcionálne
  // - Ak delta < 0: Máme veľa cash → pridaj do ETF/bonds/gold proporcionálne
  const liquidAssets = ["etf", "bonds", "bond3y9", "gold"];
  const liquidTotal = baseMix
    .filter((m) => liquidAssets.includes(m.key))
    .reduce((sum, m) => sum + m.pct, 0);

  const result = baseMix.map((item) => {
    if (item.key === "cash") {
      return { ...item, pct: optimalCashPct };
    }

    // Redistribuj delta proporcionálne z/do liquid assets
    if (liquidAssets.includes(item.key)) {
      const weight = liquidTotal > 0 ? item.pct / liquidTotal : 0;
      return { ...item, pct: item.pct - delta * weight };
    }

    return item;
  });

  return normalize(result);
}

/**
 * Získaj info o cash reserve stave (pre UI feedback)
 */
export function getCashReserveInfo(
  profile: ReserveProfile,
  totalPortfolioEur: number,
  currentCashPct: number
): {
  optimal: number;
  current: number;
  needsAdjustment: boolean;
  message: string;
} {
  const optimalCashPct = calculateOptimalCashPct(
    profile,
    totalPortfolioEur,
    "short"
  );
  const needsAdjustment = Math.abs(currentCashPct - optimalCashPct) >= 2;

  const monthlyExpenses = profile.fixedExpenses + profile.variableExpenses;
  const monthlyBase =
    monthlyExpenses > 0 ? monthlyExpenses : profile.monthlyIncome * 0.7;

  let message = "";
  if (currentCashPct < optimalCashPct - 2) {
    message = `Odporúčame zvýšiť hotovostnú rezervu na ${optimalCashPct.toFixed(1)}% (${Math.round((optimalCashPct / 100) * totalPortfolioEur).toLocaleString("sk-SK")} EUR). To zabezpečí 6 mesačných výdavkov (${Math.round(monthlyBase * 6).toLocaleString("sk-SK")} EUR).`;
  } else if (currentCashPct > optimalCashPct + 2) {
    message = `Máte nadmernú hotovosť (${currentCashPct.toFixed(1)}%). Optimálne je ${optimalCashPct.toFixed(1)}% – zvyšok môže pracovať v aktívach s výnosom.`;
  } else {
    message = `Vaša hotovostná rezerva je optimálna (${currentCashPct.toFixed(1)}%).`;
  }

  return {
    optimal: optimalCashPct,
    current: currentCashPct,
    needsAdjustment,
    message,
  };
}
