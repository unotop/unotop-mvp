/**
 * Portfolio presety pre BASIC režim
 * 
 * Každý preset je optimalizovaný pre danú preferenciu rizika
 * a dodržiava diverzifikačné pravidlá.
 */

import type { MixItem } from "../mix/mix.service";
import type { RiskPref } from "../mix/assetModel";
import { normalize } from "../mix/mix.service";
import { getAssetCaps, getDynCryptoComboCap, type Caps } from "../policy/caps";
import type { Stage } from "../policy/stage";

export interface PortfolioPreset {
  id: RiskPref;
  label: string;
  icon: string;
  color: "blue" | "amber" | "green";
  description: string;
  mix: MixItem[];
  targetRisk: { min: number; max: number };
}

/**
 * Tri základné presety pre BASIC režim
 * 
 * Pravidlá:
 * - Žiadne aktívum > 30% (okrem bonds v konzervatívnom)
 * - Dynamické riadenie ≤ 11% (konzervatívny), 11-21% (vyvážený), 21-31% (rastový)
 * - Reality len ak príjem ≥ 3500€ alebo vklad ≥ 300k€
 * - Suma = 100%
 */
export const PORTFOLIO_PRESETS: PortfolioPreset[] = [
  {
    id: "konzervativny",
    label: "Konzervatívny",
    icon: "🛡️",
    color: "blue",
    description: "Nízke riziko, stabilný rast. Vhodné pre začiatočníkov a konzervatívnych investorov.",
    mix: [
      { key: "gold", pct: 20 },
      { key: "etf", pct: 20 },
      { key: "bonds", pct: 17 },      // 50% z pôvodných 34%
      { key: "bond3y9", pct: 17 },    // 50% z pôvodných 34% (mesačný CF)
      { key: "dyn", pct: 8 },
      { key: "cash", pct: 12 },
      { key: "crypto", pct: 0 },
      { key: "real", pct: 6 },
    ],
    targetRisk: { min: 3.0, max: 4.0 },
  },
  {
    id: "vyvazeny",
    label: "Vyvážený",
    icon: "⚖️",
    color: "amber",
    description: "Vyvážený pomer rizika a výnosu. Vhodné pre väčšinu investorov s dlhodobým horizontom.",
    mix: [
      { key: "gold", pct: 13 },    // Znížené z 14
      { key: "etf", pct: 32 },     
      { key: "bonds", pct: 10 },    
      { key: "bond3y9", pct: 10 },  
      { key: "dyn", pct: 18 },     
      { key: "cash", pct: 9 },     
      { key: "crypto", pct: 4 },   
      { key: "real", pct: 4 },     // Znížené z 5
    ],
    targetRisk: { min: 4.5, max: 6.0 },
  },
  {
    id: "rastovy",
    label: "Rastový",
    icon: "🚀",
    color: "green",
    description: "Vyššie riziko, maximálny potenciálny výnos. Vhodné pre skúsených investorov s vysokou toleranciou rizika.",
    mix: [
      { key: "gold", pct: 12 },    
      { key: "etf", pct: 35 },     
      { key: "bonds", pct: 6.5 },   
      { key: "bond3y9", pct: 6.5 }, 
      { key: "dyn", pct: 21.5 },    // > 21% (test požiadavka)
      { key: "cash", pct: 5.5 },    
      { key: "crypto", pct: 5.5 },  // Znížené z 7 (pre súčet 100%)
      { key: "real", pct: 7.5 },    // Znížené z 8 (pre súčet 100%)
    ],
    targetRisk: { min: 6.5, max: 7.5 },
  },
];

/**
 * Vynúť stage-aware asset capy a redistribuuj prebytky
 * 
 * Pravidlá:
 * 1. Uplatní individuálne asset capy (z getAssetCaps)
 * 2. Skontroluj combo dyn+crypto limit
 * 3. Prebytky redistribuuj podľa bucket poradia:
 *    - STARTER/CORE: ["etf", "bonds", "gold", "cash"]
 *    - LATE: ["bonds", "gold", "etf", "cash"]
 * 4. Normalize na presne 100%
 * 
 * @param mix - Mix na úpravu (mutable)
 * @param riskPref - Rizikový profil
 * @param stage - Investičná fáza
 * @returns Upravený a normalizovaný mix
 */
export function enforceStageCaps(
  mix: MixItem[],
  riskPref: RiskPref,
  stage: Stage
): MixItem[] {
  const caps = getAssetCaps(riskPref, stage);
  const comboCap = getDynCryptoComboCap(stage);
  
  // Helper: získaj index aktíva
  const getIdx = (key: MixItem["key"]) => mix.findIndex((m) => m.key === key);
  
  // Helper: získaj pct aktíva
  const getPct = (key: MixItem["key"]) => mix.find((m) => m.key === key)?.pct ?? 0;
  
  // Helper: nastav pct aktíva
  const setPct = (key: MixItem["key"], val: number) => {
    const idx = getIdx(key);
    if (idx !== -1) mix[idx].pct = Math.max(0, val);
  };
  
  let overflow = 0;
  
  // 1. Uplatni individuálne asset capy
  for (const item of mix) {
    const cap = caps[item.key];
    if (cap !== undefined && item.pct > cap) {
      overflow += item.pct - cap;
      item.pct = cap;
    }
  }
  
  // 2. Skontroluj combo dyn+crypto
  const dynPct = getPct("dyn");
  const cryptoPct = getPct("crypto");
  const comboSum = dynPct + cryptoPct;
  
  if (comboSum > comboCap) {
    const comboOver = comboSum - comboCap;
    
    // Uber 70% z dyn, 30% z crypto
    const dynReduction = Math.min(dynPct, comboOver * 0.7);
    const cryptoReduction = Math.min(cryptoPct, comboOver * 0.3);
    
    setPct("dyn", dynPct - dynReduction);
    setPct("crypto", cryptoPct - cryptoReduction);
    
    overflow += dynReduction + cryptoReduction;
  }
  
  // 3. Redistribuuj overflow podľa bucket poradia
  if (overflow > 0.01) { // Tolerance 0.01%
    const buckets: MixItem["key"][] = 
      stage === "LATE"
        ? ["bonds", "gold", "etf", "cash"]   // LATE: stabilita
        : ["etf", "bonds", "gold", "cash"];  // STARTER/CORE: rast
    
    for (const bucket of buckets) {
      if (overflow < 0.01) break;
      
      const cap = caps[bucket] ?? 40;
      const current = getPct(bucket);
      const available = cap - current;
      
      if (available > 0.01) {
        const toAdd = Math.min(available, overflow);
        setPct(bucket, current + toAdd);
        overflow -= toAdd;
      }
    }
  }
  
  // 4. Normalize na presne 100%
  return normalize(mix);
}

/**
 * Upraví preset podľa profilu užívateľa
 * 
 * Reality filter:
 * - Ak príjem < 3500€ a vklad < 300k€ → reality = 0%
 * - Redistribúcia: 60% do ETF, 40% do bonds
 * 
 * Stage caps:
 * - Uplatní asset capy podľa investičnej fázy (STARTER/CORE/LATE)
 * - Redist

ribuuje prebytky podľa bucket poradia
 * 
 * @param preset - Pôvodný preset
 * @param profile - Užívateľský profil
 * @param stage - Investičná fáza (STARTER/CORE/LATE)
 * @returns Upravený mix
 */
export function adjustPresetForProfile(
  preset: PortfolioPreset,
  profile: { monthlyIncome: number; lumpSumEur: number },
  stage: Stage = "CORE"  // Default CORE ak nie je poskytnuté
): MixItem[] {
  const qualifiesForRealty = 
    profile.monthlyIncome >= 3500 || profile.lumpSumEur >= 300000;

  if (!qualifiesForRealty) {
    // Kópiruj mix (immutable)
    const mix = preset.mix.map((m) => ({ ...m }));
    const realtyIdx = mix.findIndex((m) => m.key === "real");
    
    if (realtyIdx !== -1 && mix[realtyIdx].pct > 0) {
      const realtyPct = mix[realtyIdx].pct;
      
      // Nastav reality na 0
      mix[realtyIdx].pct = 0;
      
      // Redistribuj: 60% do ETF, 40% do bonds
      // BEZPEČNÉ: Ak ETF dosiahne limit 40%, presun zvyšok do bonds
      const etfIdx = mix.findIndex((m) => m.key === "etf");
      const bondsIdx = mix.findIndex((m) => m.key === "bonds");
      
      if (etfIdx !== -1) {
        const etfAddition = realtyPct * 0.6;
        const newEtfPct = mix[etfIdx].pct + etfAddition;
        
        if (newEtfPct > 40) {
          // ETF by prekročil limit → pridaj len do 40%, zvyšok daj bonds
          const overflow = newEtfPct - 40;
          mix[etfIdx].pct = 40;
          
          if (bondsIdx !== -1) {
            mix[bondsIdx].pct += (realtyPct * 0.4) + overflow;
          }
        } else {
          // ETF neprekročil limit → pridaj normálne
          mix[etfIdx].pct = newEtfPct;
          if (bondsIdx !== -1) {
            mix[bondsIdx].pct += realtyPct * 0.4;
          }
        }
      } else if (bondsIdx !== -1) {
        // Ak ETF neexistuje, všetko do bonds
        mix[bondsIdx].pct += realtyPct;
      }
    }
    
    // Enforce stage caps a normalize
    return enforceStageCaps(mix, preset.id, stage);
  }

  // Kvalifikovaný → vráť pôvodný mix, ale enforce caps a normalize
  const mix = preset.mix.map((m) => ({ ...m }));
  return enforceStageCaps(mix, preset.id, stage);
}

/**
 * Validuj preset proti risk cap
 * 
 * @param mix - Mix na overenie
 * @param riskPref - Preferencia rizika
 * @param riskScore - Vypočítané riziko
 * @param riskCap - Risk cap pre profil
 * @param lumpSumEur - Jednorazová investícia (optional, pre low-investment check)
 * @param monthlyEur - Mesačný vklad (optional, pre low-investment check)
 * @returns true ak je valid, inak false
 */
export function validatePresetRisk(
  mix: MixItem[],
  riskPref: RiskPref,
  riskScore: number,
  riskCap: number,
  lumpSumEur = 0,
  monthlyEur = 0
): { valid: boolean; message?: string; isWarning?: boolean } {
  // === CHECK 1: Nízke vklady (hard block pre konzervativny/vyvazeny) ===
  const totalFirstYear = lumpSumEur + monthlyEur * 12;
  
  if (totalFirstYear < 2000 && (riskPref === "konzervativny" || riskPref === "vyvazeny")) {
    return {
      valid: false,  // Hard block
      message: `Pri investícii ${totalFirstYear.toLocaleString("sk-SK")} EUR/rok nie je možné efektívne diverzifikovať portfólio. Vyberte rastový profil alebo zvýšte vklady na min. 2 000 EUR/rok.`,
    };
  }

  // === CHECK 2: Diverzifikácia (žiadne aktívum > 40%) ===
  for (const item of mix) {
    if (item.key === "bonds" && riskPref === "konzervativny") {
      // Výnimka: bonds môže byť až 30% v konzervatívnom
      if (item.pct > 35) {
        return {
          valid: false,
          message: `Príliš vysoká alokácia dlhopisov (${item.pct}%). Max 35%.`,
        };
      }
    } else if (item.pct > 40) {
      return {
        valid: false,
        message: `Príliš vysoká alokácia ${item.key} (${item.pct}%). Max 40%.`,
      };
    }
  }

  // Over dyn + crypto limit
  const dynPct = mix.find((m) => m.key === "dyn")?.pct ?? 0;
  const cryptoPct = mix.find((m) => m.key === "crypto")?.pct ?? 0;
  if (dynPct + cryptoPct > 35) {
    return {
      valid: false,
      message: `Súčet Dynamického (${dynPct}%) + Krypto (${cryptoPct}%) nesmie prekročiť 35%.`,
    };
  }

  // Nakoniec over risk cap
  if (riskScore > riskCap) {
    return {
      valid: false,
      message: `Riziko ${riskScore.toFixed(1)} prekračuje limit ${riskCap} pre ${riskPref} profil.`,
    };
  }

  return { valid: true };
}

// ============================================================================
// DYNAMIC ADJUSTMENTS (Lump sum / Monthly / Cash / Bonds scaling)
// ============================================================================

export type { ProfileForAdjustments, AdjustmentWarning, AdjustmentResult } from "./mixAdjustments";
export { getAdjustedPreset, getAdjustedMix } from "./mixAdjustments";
