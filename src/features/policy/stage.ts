/**
 * Stage Detection Module
 * 
 * Detekuje investičnú fázu používateľa na základě kapitálu, vkladov a horizontu.
 * Využíva sa na adaptívne limity rizika a asset capov.
 * 
 * STARTER: Malý kapitál, dlhý horizont → povoliť agresívnejší rast
 * CORE:    Stredný kapitál → baseline limity
 * LATE:    Veľký kapitál alebo krátky horizont → konzervatívnejšie
 */

export type Stage = "STARTER" | "CORE" | "LATE";

/**
 * Detekuj investičnú fázu používateľa
 * 
 * Pravidlá:
 * - STARTER: lump < 20k AND monthly < 400 AND years >= 10, alebo coverage < 35%
 * - LATE: lump >= 50k OR monthly >= 1000 OR years <= 7, alebo coverage >= 80%
 * - CORE: všetko ostatné (default baseline)
 * 
 * @param lump - Jednorazová investícia (EUR)
 * @param monthly - Mesačný vklad (EUR)
 * @param years - Investičný horizont (roky)
 * @param goal - Cieľ majetku (EUR, optional)
 * @returns Stage (STARTER/CORE/LATE)
 */
export function detectStage(
  lump: number,
  monthly: number,
  years: number,
  goal?: number
): Stage {
  // Počítaj rácio cieľa (ak je zadaný)
  const investable = lump + monthly * 12 * Math.max(years, 0);
  const coverage = goal && goal > 0 ? investable / goal : undefined;

  // STARTER: malý kapitál a dlhší čas
  const isSmall = lump < 20_000 && monthly < 400 && years >= 10;
  const isLowCoverage = coverage !== undefined && coverage < 0.35;

  // LATE: veľký kapitál alebo veľký mesačný vklad, alebo „cieľ skoro splnený"
  const isBig = lump >= 50_000 || monthly >= 1_000 || years <= 7;
  const isHighCoverage = coverage !== undefined && coverage >= 0.80;

  if (isBig || isHighCoverage) return "LATE";
  if (isSmall || isLowCoverage) return "STARTER";
  return "CORE";
}
