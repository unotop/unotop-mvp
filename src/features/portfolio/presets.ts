/**
 * Portfolio presety pre BASIC režim
 * 
 * Každý preset je optimalizovaný pre danú preferenciu rizika
 * a dodržiava diverzifikačné pravidlá.
 */

import type { MixItem } from "../mix/mix.service";
import type { RiskPref } from "../mix/assetModel";

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
      { key: "gold", pct: 14 },    
      { key: "etf", pct: 32 },     
      { key: "bonds", pct: 10 },    // 50% z pôvodných 20%
      { key: "bond3y9", pct: 10 },  // 50% z pôvodných 20% (mesačný CF)
      { key: "dyn", pct: 18 },     
      { key: "cash", pct: 9 },     
      { key: "crypto", pct: 4 },   
      { key: "real", pct: 5 },     
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
      { key: "gold", pct: 13 },    
      { key: "etf", pct: 35 },     
      { key: "bonds", pct: 6.5 },   // 50% z pôvodných 13%
      { key: "bond3y9", pct: 6.5 }, // 50% z pôvodných 13% (mesačný CF)
      { key: "dyn", pct: 21 },     
      { key: "cash", pct: 6 },     
      { key: "crypto", pct: 7 },   
      { key: "real", pct: 8 },     
    ],
    targetRisk: { min: 6.5, max: 7.5 },
  },
];

/**
 * Upraví preset podľa profilu užívateľa
 * 
 * Reality filter:
 * - Ak príjem < 3500€ a vklad < 300k€ → reality = 0%
 * - Redistribúcia: 60% do ETF, 40% do bonds
 * 
 * @param preset - Pôvodný preset
 * @param profile - Užívateľský profil
 * @returns Upravený mix
 */
export function adjustPresetForProfile(
  preset: PortfolioPreset,
  profile: { monthlyIncome: number; lumpSumEur: number }
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
      const etfIdx = mix.findIndex((m) => m.key === "etf");
      const bondsIdx = mix.findIndex((m) => m.key === "bonds");
      
      if (etfIdx !== -1) mix[etfIdx].pct += realtyPct * 0.6;
      if (bondsIdx !== -1) mix[bondsIdx].pct += realtyPct * 0.4;
    }
    
    return mix;
  }

  // Kvalifikovaný → vráť pôvodný mix
  return preset.mix.map((m) => ({ ...m }));
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
