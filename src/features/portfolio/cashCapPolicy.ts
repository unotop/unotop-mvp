/**
 * Cash Cap Policy Module
 * 
 * Globálny strop na hotovosť v modelových portfóliách.
 * Prebytok hotovosti sa reallocuje do zlata a ETF podľa profilu.
 * 
 * Pravidlá:
 * - Konzervatívny: max 10% cash
 * - Vyvážený: max 7% cash
 * - Rastový: max 5% cash
 * 
 * Reallokácia prebytku:
 * - Konzervatívny: 70% → zlato, 30% → ETF
 * - Vyvážený: 50% → zlato, 50% → ETF
 * - Rastový: 30% → zlato, 70% → ETF
 * 
 * HARD LIMIT: Cash cap prepíše cash reserve optimization.
 * Ak reserve chce 15% a cap je 10%, dostane len 10%, zvyšok → zlato/ETF.
 */

import type { MixItem } from "../mix/mix.service";
import type { RiskPref } from "../mix/assetModel";
import { normalize } from "../mix/mix.service";

/**
 * Profilové cash capy (%)
 */
const CASH_CAPS: Record<RiskPref, number> = {
  konzervativny: 10,
  vyvazeny: 7,
  rastovy: 5,
};

/**
 * Reallokačné ratio prebytku (zlato vs ETF)
 * [goldRatio, etfRatio] - musí dávať súčet 1.0
 */
const REALLOC_RATIOS: Record<RiskPref, { gold: number; etf: number }> = {
  konzervativny: { gold: 0.70, etf: 0.30 }, // 70% zlato, 30% ETF
  vyvazeny: { gold: 0.50, etf: 0.50 },      // 50/50
  rastovy: { gold: 0.30, etf: 0.70 },       // 30% zlato, 70% ETF
};

export interface CashCapResult {
  mix: MixItem[];
  applied: boolean;
  excessCash: number; // Prebytok hotovosti (p.b.)
  goldAdded: number;  // Pridané do zlata (p.b.)
  etfAdded: number;   // Pridané do ETF (p.b.)
}

/**
 * Aplikuj cash cap na mix
 * 
 * PR-27b FIX: Reallokácia prebytku cash rešpektuje stage caps (gold 40%, ETF 50%)
 * Ak gold/ETF nemá room, prebytok proporcionálne do dostupných aktív.
 * 
 * @param baseMix - Mix pred aplikáciou cash cap
 * @param riskPref - Rizikový profil
 * @param stageCaps - Stage caps (gold, ETF limity) - optional, ak nie je, bez limitu
 * @returns Upravený mix + info o realloce
 */
export function applyCashCap(
  baseMix: MixItem[],
  riskPref: RiskPref,
  stageCaps?: Record<string, number>
): CashCapResult {
  const mix = [...baseMix];
  const cashCap = CASH_CAPS[riskPref];
  const ratio = REALLOC_RATIOS[riskPref];

  // Nájdi cash v mixe
  const cashIndex = mix.findIndex((m) => m.key === "cash");
  if (cashIndex === -1) {
    // Žiadna hotovosť → skip
    return {
      mix: normalize(mix),
      applied: false,
      excessCash: 0,
      goldAdded: 0,
      etfAdded: 0,
    };
  }

  const currentCash = mix[cashIndex].pct;

  // Ak cash <= cap → skip
  if (currentCash <= cashCap) {
    return {
      mix: normalize(mix),
      applied: false,
      excessCash: 0,
      goldAdded: 0,
      etfAdded: 0,
    };
  }

  // Vypočítaj prebytok
  const excessCash = currentCash - cashCap;

  // PR-27b FIX: Realloce prebytku s rešpektom k stage caps
  let goldAdded = excessCash * ratio.gold;
  let etfAdded = excessCash * ratio.etf;

  // Ak máme stage caps, kontroluj room pre gold a ETF
  if (stageCaps) {
    const goldCap = stageCaps["gold"] ?? 100;
    const etfCap = stageCaps["etf"] ?? 100;

    const goldIndex = mix.findIndex((m) => m.key === "gold");
    const etfIndex = mix.findIndex((m) => m.key === "etf");

    const currentGold = goldIndex !== -1 ? mix[goldIndex].pct : 0;
    const currentEtf = etfIndex !== -1 ? mix[etfIndex].pct : 0;

    const goldRoom = Math.max(0, goldCap - currentGold);
    const etfRoom = Math.max(0, etfCap - currentEtf);

    // Ak gold alebo ETF nemá room, prerozdeľ prebytok
    if (goldAdded > goldRoom || etfAdded > etfRoom) {
      const totalRoom = goldRoom + etfRoom;

      if (totalRoom > 0) {
        // PR-27b KRITICKÝ FIX: Reallokuj len toľko, koľko sa zmestí
        // Ak gold nemá room (0%), celý prebytok ide do ETF
        // Ak ETF nemá room (0%), celý prebytok ide do gold
        const actualGoldAdded = Math.min(goldAdded, goldRoom);
        const actualEtfAdded = Math.min(etfAdded, etfRoom);

        // Zvyšok (čo sa nezmestilo) prerozdeľ proporcionálne
        const remainder = excessCash - (actualGoldAdded + actualEtfAdded);

        if (remainder > 0) {
          // Prerozdeľ zvyšok podľa dostupného room
          if (goldRoom > 0 && etfRoom > 0) {
            // Oba majú room → proporcionálne
            const goldRoomRatio = goldRoom / totalRoom;
            const etfRoomRatio = etfRoom / totalRoom;
            goldAdded = actualGoldAdded + (remainder * goldRoomRatio);
            etfAdded = actualEtfAdded + (remainder * etfRoomRatio);
          } else if (goldRoom > 0) {
            // Len gold má room → všetko do gold
            goldAdded = actualGoldAdded + remainder;
            etfAdded = actualEtfAdded;
          } else if (etfRoom > 0) {
            // Len ETF má room → všetko do ETF
            goldAdded = actualGoldAdded;
            etfAdded = actualEtfAdded + remainder;
          }
        } else {
          goldAdded = actualGoldAdded;
          etfAdded = actualEtfAdded;
        }

        console.log(
          `[CashCapPolicy] Stage caps hit → reallocating: gold ${goldAdded.toFixed(1)}% (room ${goldRoom.toFixed(1)}%), ETF ${etfAdded.toFixed(1)}% (room ${etfRoom.toFixed(1)}%)`
        );
      } else {
        // Žiadny room v gold ani ETF → nechaj prebytok v cash (výnimočný prípad)
        console.warn(
          `[CashCapPolicy] No room in gold/ETF for reallocation, keeping excess ${excessCash.toFixed(1)}% in cash`
        );
        mix[cashIndex].pct = currentCash; // Vráť späť
        return {
          mix: normalize(mix),
          applied: false,
          excessCash: 0,
          goldAdded: 0,
          etfAdded: 0,
        };
      }
    }
  }

  // Aplikuj zmeny
  mix[cashIndex].pct = cashCap; // Hard cap na hotovosť

  const goldIndex = mix.findIndex((m) => m.key === "gold");
  if (goldIndex !== -1) {
    mix[goldIndex].pct += goldAdded;
  } else {
    mix.push({ key: "gold", pct: goldAdded });
  }

  const etfIndex = mix.findIndex((m) => m.key === "etf");
  if (etfIndex !== -1) {
    mix[etfIndex].pct += etfAdded;
  } else {
    mix.push({ key: "etf", pct: etfAdded });
  }

  console.log(
    `[CashCapPolicy] Applied for ${riskPref}: ${currentCash.toFixed(1)}% → ${cashCap}% (excess ${excessCash.toFixed(1)}% → ${goldAdded.toFixed(1)}% gold + ${etfAdded.toFixed(1)}% ETF)`
  );

  return {
    mix: normalize(mix),
    applied: true,
    excessCash,
    goldAdded,
    etfAdded,
  };
}

/**
 * Získaj cash cap hodnotu pre daný profil
 * Použitie: hard constraint v tuning funkciách (upTune, downTune, guardrails)
 */
export function getCashCap(riskPref: RiskPref): number {
  return CASH_CAPS[riskPref];
}

/**
 * Získaj info o cash cap pre daný profil (pre UI/debugging)
 */
export function getCashCapInfo(riskPref: RiskPref): {
  cap: number;
  goldRatio: number;
  etfRatio: number;
} {
  return {
    cap: CASH_CAPS[riskPref],
    goldRatio: REALLOC_RATIOS[riskPref].gold,
    etfRatio: REALLOC_RATIOS[riskPref].etf,
  };
}
