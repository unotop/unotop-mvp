/**
 * copy.ts
 * Centralized microcopy for warning chips and toasts
 * 
 * Purpose: Explain WHY the mix was adjusted (policy enforcement)
 */

import type { Stage } from "../../policy/stage";

/**
 * ETF info for STARTER stage (no error, just info)
 */
export function getETFStarterCopy(): string {
  return "V štarte povoľujeme ETF až do 50 % pre rýchlejší rast. Neskôr zrebalansujeme.";
}

/**
 * GOLD cap warning for CORE/LATE stages
 * @param cap - The enforced cap percentage (e.g., 40)
 * @param stage - Current investment stage
 * @param bucketOrder - Where the excess was redistributed (e.g., "dlhopisy, hotovosť")
 */
export function getGoldCapCopy(cap: number, stage: Stage, bucketOrder: string[]): string {
  const bucketList = bucketOrder.join(", ");
  return `Alokáciu gold sme znížili na ${cap}% (limit pre fázu ${stage}). Prebytok presunutý do ${bucketList}.`;
}

/**
 * Risk exceeds adaptive cap
 * @param actualRisk - Calculated risk score (0-10)
 * @param capRisk - Adaptive risk cap for this profile+stage
 * @param profil - Risk preference (konzervativny/vyvazeny/rastovy)
 * @param stage - Current investment stage
 */
export function getRiskCapCopy(
  actualRisk: number,
  capRisk: number,
  profil: string,
  stage: Stage
): string {
  return `Riziko ${actualRisk.toFixed(1)}/10 prekračovalo limit ${capRisk.toFixed(1)}/10 pre ${profil} – mix upravený podľa fázy ${stage}.`;
}

/**
 * Dyn+Crypto combo exceeds cap
 * @param comboPct - Current dyn+crypto sum
 * @param comboCap - Cap for this stage
 * @param stage - Current investment stage
 */
export function getDynCryptoComboCapCopy(comboPct: number, comboCap: number, stage: Stage): string {
  return `Dynamické riadenie + krypto (${comboPct.toFixed(1)}%) presahujú limit ${comboCap}% pre fázu ${stage}. Mix upravený.`;
}

/**
 * ETF exceeds cap (STARTER allows 50%, CORE 40%, LATE 35%)
 * @param etfPct - Current ETF percentage
 * @param etfCap - Cap for this stage
 * @param stage - Current investment stage
 */
export function getETFCapCopy(etfPct: number, etfCap: number, stage: Stage): string {
  if (stage === "STARTER") {
    // Info, not warning
    return `V štarte povoľujeme ETF až do 50%. Máte ${etfPct.toFixed(1)}% – v bezpečnom pásme.`;
  }
  return `ETF alokáciu sme znížili z ${etfPct.toFixed(1)}% na ${etfCap}% (limit pre fázu ${stage}).`;
}

/**
 * Sum drift warning (not exactly 100%)
 * @param sum - Current sum of all allocations
 */
export function getSumDriftCopy(sum: number): string {
  const diff = Math.abs(sum - 100);
  if (diff < 0.01) return ""; // No warning needed
  return `Súčet alokácií je ${sum.toFixed(2)}%. Použite "Dorovnať" pre presné 100%.`;
}

/**
 * Monthly contribution is zero
 */
export function getZeroMonthlyCopy(): string {
  return "Mesačný vklad je 0 € – projekcia porastie len z jednorazovej investície.";
}

/**
 * Unutilized reserve (surplus > monthly by significant margin)
 * @param surplus - Monthly surplus (income - expenses - debts)
 * @param currentMonthly - Current monthly contribution
 * @param suggestedMonthly - Suggested increased contribution
 */
export function getUnutilizedReserveCopy(
  surplus: number,
  currentMonthly: number,
  suggestedMonthly: number
): string {
  const unutilized = Math.max(0, surplus - currentMonthly);
  return `Zostáva vám nevyužitá rezerva ~${Math.round(unutilized)} €/mes. Zvážte zvýšiť vklad na ${suggestedMonthly} €/mes.`;
}

/**
 * Profile changed, inputs reset
 */
export function getProfileResetCopy(): string {
  return "Profil zmenený. Vstupy boli vynulované.";
}

/**
 * Collaboration opt-in (increase income)
 */
export function getCollabOptInCopy(): string {
  return "Chcem zvýšiť svoj príjem – zaujíma ma spolupráca s UNOTOP.";
}

// ============================================================================
// PR-12: Asset Minimums Copy
// ============================================================================

/**
 * Bonds unavailable (requires 2500 EUR lump sum)
 * @param redistribution - Where the allocation was moved (e.g., "ETF, hotovosť")
 */
export function getBondsMinimumCopy(redistribution: string): string {
  return `Dlhopisy vyžadujú min. 2 500 € jednorazovo. Alokáciu sme presunuli do ${redistribution}.`;
}

/**
 * Dynamic management unavailable (requires 1000 EUR lump sum)
 */
export function getDynMinimumCopy(): string {
  return "Dynamické riadenie od 1 000 € jednorazovo – momentálne presunuté do ETF.";
}

/**
 * Gold unavailable (requires 50 EUR monthly or more)
 * @param redistribution - Where the allocation was moved
 */
export function getGoldMinimumCopy(redistribution: string): string {
  return `Zlato vyžaduje min. 50 €/mes. Alokáciu sme presunuli do ${redistribution}.`;
}

/**
 * Crypto unavailable (requires 50 EUR monthly or 100 EUR lump sum)
 */
export function getCryptoMinimumCopy(): string {
  return "Krypto od 50 €/mes alebo 100 € jednorazovo – momentálne presunuté do ETF.";
}

/**
 * Reality unavailable (requires large capital)
 * @param redistribution - Where the allocation was moved
 */
export function getRealityMinimumCopy(redistribution: string): string {
  return `Reality len pre väčší kapitál (300 000 € alebo príjem 3 500+ €/mes). Alokáciu sme presunuli do ${redistribution}.`;
}

/**
 * Generic asset minimum message (fallback)
 * @param assetLabel - Human-readable asset name
 * @param minLump - Minimum lump sum (0 if not required)
 * @param minMonthly - Minimum monthly (0 if not required)
 * @param redistribution - Where the allocation was moved
 */
export function getAssetMinimumCopy(
  assetLabel: string,
  minLump: number,
  minMonthly: number,
  redistribution: string
): string {
  let requirement = "";
  if (minLump > 0 && minMonthly > 0) {
    requirement = `min. ${minLump.toLocaleString("sk-SK")} € jednorazovo alebo ${minMonthly} €/mes`;
  } else if (minLump > 0) {
    requirement = `min. ${minLump.toLocaleString("sk-SK")} € jednorazovo`;
  } else if (minMonthly > 0) {
    requirement = `min. ${minMonthly} €/mes`;
  }
  
  return `${assetLabel} vyžaduje ${requirement}. Alokáciu sme presunuli do ${redistribution}.`;
}
