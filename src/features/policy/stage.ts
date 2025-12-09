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
 * P1.5 FIX: Mapuje effective plan volume na stage
 * 
 * Zodpovedá volume bands v profileAssetPolicy.ts:
 * - STARTER: < 50k EUR
 * - CORE: 50k - 100k EUR
 * - LATE: >= 100k EUR
 * 
 * @param effectivePlanVolume - Lump + Monthly × 12 × Years
 * @returns Stage (STARTER/CORE/LATE)
 */
export function volumeToStage(effectivePlanVolume: number): Stage {
  if (effectivePlanVolume < 50_000) return "STARTER";
  if (effectivePlanVolume < 100_000) return "CORE";
  return "LATE";
}

/**
 * Detekuj investičnú fázu používateľa
 * 
 * Pravidlá (PR-14.A - úzky CORE gap):
 * - STARTER: lump < 30k AND monthly < 800 AND years >= 8, alebo coverage < 35%
 * - LATE: lump >= 40k OR monthly >= 800 OR years <= 7, alebo coverage >= 80%
 * - CORE: všetko ostatné (malý gap - len stredné scenáre)
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

  // STARTER: malý kapitál a dlhší čas (ROZŠÍRENÉ pravidlá - pokryje viac edge cases)
  // PR-14.A: Rozšírená definícia - lump < 30k (namiesto 20k), monthly < 800 (namiesto <= 500)
  const isSmall = lump < 30_000 && monthly < 800 && years >= 8;
  const isLowCoverage = coverage !== undefined && coverage < 0.35;

  // LATE: veľký kapitál alebo veľký mesačný vklad, alebo „cieľ skoro splnený"
  // PR-14.A: lump >= 40k OR monthly >= 800 (zachované z PR-14.1)
  const isBig = lump >= 40_000 || monthly >= 800 || years <= 7;
  const isHighCoverage = coverage !== undefined && coverage >= 0.80;

  if (isBig || isHighCoverage) return "LATE";
  if (isSmall || isLowCoverage) return "STARTER";
  return "CORE"; // Malý gap: napr. 30k-40k lump, 800€ monthly presne, 8-10 rokov
}
