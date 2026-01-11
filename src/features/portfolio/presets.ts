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
import { trackPolicyAdjustment } from "../../services/telemetry";
import { getRiskCapCopy } from "../ui/warnings/copy";

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
      { key: "dyn", pct: 5 },         // PR-31: 5% baseline (profile policy cap upraví pre PREMIUM/STARTER)
      { key: "cash", pct: 15 },       // Zvýšené z 12% (kompenzácia za znížený dyn)
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
      // PR-34: Zlato znížené z 40% → 12%, dyn zvýšené z 0% → 10%
      { key: "gold", pct: 12 },    // PR-34: Znížené (stabilita bez extrému)
      { key: "etf", pct: 50 },     // PR-34: Zvýšené z 45% (hlavný rast)
      { key: "bonds", pct: 9 },    // Zvýšené z 5% (kompenzácia)
      { key: "bond3y9", pct: 9 },  // Zvýšené z 5% (mesačný CF)
      { key: "dyn", pct: 10 },     // PR-34: Zvýšené z 0% (aktívne riadenie)
      { key: "cash", pct: 5 },     // Minimálna rezerva
      { key: "crypto", pct: 0 },   // Starter: bez crypto
      { key: "real", pct: 5 },     // Zvýšené z 0% (diverzifikácia)
    ],
    targetRisk: { min: 5.5, max: 6.5 }, // PR-30: Cieľ 5.5-6.5 (pod riskMax 7.0)
  },
  {
    id: "rastovy",
    label: "Rastový",
    icon: "🚀",
    color: "green",
    description: "Vyššie riziko, maximálny potenciálny výnos. Vhodné pre skúsených investorov s vysokou toleranciou rizika.",
    mix: [
      // PR-34: Zlato znížené z 40% → 10%, dyn zvýšené z 0% → 16%, crypto 3% → 6%
      { key: "gold", pct: 10 },    // PR-34: Znížené (minimálna stabilita)
      { key: "etf", pct: 52 },     // PR-34: Zvýšené z 47% (hlavný rast)
      { key: "bonds", pct: 4 },    // Zvýšené z 2.5% (stabilita)
      { key: "bond3y9", pct: 4 },  // Zvýšené z 2.5% (mesačný CF)
      { key: "dyn", pct: 16 },     // PR-34: Zvýšené z 0% (aktívne riadenie)
      { key: "cash", pct: 2 },     // Znížené z 5% (minimalizácia hotovosti)
      { key: "crypto", pct: 6 },   // PR-34: Zvýšené z 3% (agresívny rast)
      { key: "real", pct: 6 },     // Zvýšené z 0% (diverzifikácia)
    ],
    targetRisk: { min: 7.0, max: 8.0 }, // PR-30: Cieľ 7-8 (nad Balanced, pod riskMax 8.0)
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
  stage: Stage,
  paramHash?: string // PR-14.D: Optional param hash (lump-monthly-years-stage) pre cache invalidation
): MixItem[] {
  // PR-14.D CIRCUIT BREAKER: Detekcia opakovania toho istého mixu
  const mixKey = mix.map((m) => `${m.key}:${m.pct.toFixed(2)}`).join("|");
  // PR-14.D: Pridaj paramHash do cache key (ak je poskytnutý)
  const cacheKey = paramHash 
    ? `${riskPref}-${stage}-${paramHash}-${mixKey}` 
    : `${riskPref}-${stage}-${mixKey}`;
  
  // @ts-ignore - static cache pre detekciu loop
  if (!enforceStageCaps._cache) enforceStageCaps._cache = new Map();
  
  // PR-14.D: OKAMŽITÁ cache kontrola (0ms window - detekcia skutočného loop-u v rámci jednej operácie)
  // @ts-ignore
  if (enforceStageCaps._cache.has(cacheKey)) {
    console.warn(`[enforceStageCaps] LOOP DETECTED (same mix processed again), returning cached result`);
    // @ts-ignore
    return enforceStageCaps._cache.get(cacheKey).result;
  }
  
  const caps = getAssetCaps(riskPref, stage);
  const comboCap = getDynCryptoComboCap(stage);
  
  // Snapshot pre telemetria (pre/po porovnanie)
  const sumBefore = mix.reduce((acc, m) => acc + m.pct, 0);
  
  // PR-12 FIX: Snapshot vstupného mixu pre detekciu applyMinimums vynulovaných aktív
  const inputSnapshot = new Map(mix.map((m) => [m.key, m.pct]));
  
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
  let adjustmentsMade = false;
  
  // 1. Uplatni individuálne asset capy
  for (const item of mix) {
    const cap = caps[item.key];
    if (cap !== undefined && item.pct > cap) {
      const pctBefore = item.pct;
      overflow += item.pct - cap;
      item.pct = cap;
      adjustmentsMade = true;
      
      // DEBUG LOG (PR-34)
      console.log(`[enforceStageCaps] ${item.key} clamped ${pctBefore.toFixed(1)}% → ${cap}% (stage=${stage}, riskPref=${riskPref})`);
      
      // Track individual asset cap enforcement
      trackPolicyAdjustment({
        stage,
        riskPref,
        reason: `${item.key}_cap` as any,
        asset: item.key,
        pct_before: pctBefore,
        pct_after: cap,
        cap,
      });
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
    adjustmentsMade = true;
    
    // Track combo cap enforcement
    trackPolicyAdjustment({
      stage,
      riskPref,
      reason: "dyn_crypto_combo",
      pct_before: comboSum,
      pct_after: comboCap,
      combo_cap: comboCap,
    });
  }
  
  // 3. Redistribuuj overflow podľa bucket poradia
  // PR-12 FIX: Preskočiť aktíva, ktoré mali pct=0 NA VSTUPE (vynulované applyMinimums)
  let elasticCashUsed = false;
  
  if (overflow > 0.01) { // Tolerance 0.01%
    const buckets: MixItem["key"][] = 
      stage === "LATE"
        ? ["bonds", "gold", "etf", "cash"]   // LATE: stabilita
        : ["etf", "bonds", "gold", "cash"];  // STARTER/CORE: rast
    
    for (const bucket of buckets) {
      if (overflow < 0.01) break;
      
      const current = getPct(bucket);
      const inputPct = inputSnapshot.get(bucket) ?? 0;
      
      // Preskočiť aktíva, ktoré boli vynulované PRED caps enforcement
      // (applyMinimums ich označilo ako nedostupné)
      if (inputPct === 0) {
        continue;
      }
      
      const cap = caps[bucket] ?? 40;
      const available = cap - current;
      
      if (available > 0.01) {
        const toAdd = Math.min(available, overflow);
        setPct(bucket, current + toAdd);
        overflow -= toAdd;
      }
    }
    
    // PR-14.C: ELASTIC CASH SINK - ak overflow stále existuje, absorbuj do cash (prekroč cap)
    if (overflow > 0.01) {
      const cashIdx = getIdx("cash");
      if (cashIdx !== -1) {
        const currentCash = getPct("cash");
        const cashCap = caps["cash"] ?? 40;
        
        // Pridaj overflow do cash (aj nad cap)
        setPct("cash", currentCash + overflow);
        elasticCashUsed = true;
        
        console.warn(
          `[enforceStageCaps] ELASTIC CASH SINK: ${overflow.toFixed(2)}% overflow absorbed into cash (${currentCash.toFixed(2)}% → ${(currentCash + overflow).toFixed(2)}%, cap=${cashCap}%)`
        );
        
        // Track elastic cash usage
        trackPolicyAdjustment({
          stage,
          riskPref,
          reason: "elastic_cash_sink",
          asset: "cash",
          pct_before: currentCash,
          pct_after: currentCash + overflow,
          cap: cashCap,
          overflow_absorbed: overflow,
        });
        
        overflow = 0; // Absorbované
      }
    }
  }
  
  // 4. Normalize na presne 100% (VŽDY - PR-14.C)
  // Elastic cash sink zaručuje, že overflow je vždy 0 → normalize() nebude loopovať
  const currentSum = mix.reduce((acc, m) => acc + m.pct, 0);
  const normalized = normalize(mix);
  const sumAfter = normalized.reduce((acc, m) => acc + m.pct, 0);
  
  // Track sum drift correction if normalization was significant
  if (adjustmentsMade && Math.abs(sumBefore - 100) > 0.05) {
    trackPolicyAdjustment({
      stage,
      riskPref,
      reason: "sum_drift",
      sum_before: sumBefore,
      sum_after: sumAfter,
    });
  }
  
  // PR-14.D: Ulož do cache pre loop detekciu (0ms window - cache platí okamžite)
  // @ts-ignore
  enforceStageCaps._cache.set(cacheKey, { 
    result: normalized,
    elasticCashUsed // PR-16: Flag pre warning chip
  });
  
  return normalized;
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
  // PR-11: Removed < 2000 EUR/year threshold - all portfolios available at any amount
  
  // === CHECK 1: Diverzifikácia (žiadne aktívum > 40%) ===
  // PR-14: Elastic sink exceptions - cash 60%, ETF 50% (main buckets for overflow)
  for (const item of mix) {
    if (item.key === "bonds" && riskPref === "konzervativny") {
      // Výnimka: bonds môže byť až 40% v konzervatívnom (po redistribúcii overflow)
      if (item.pct > 40) {
        return {
          valid: false,
          message: `Príliš vysoká alokácia dlhopisov (${item.pct}%). Max 40%.`,
        };
      }
    } else if (item.key === "cash") {
      // PR-14: Cash môže ísť až 60% (elastic sink absorbs overflow)
      if (item.pct > 60) {
        return {
          valid: false,
          message: `Príliš vysoká alokácia hotovosti (${item.pct}%). Max 60%.`,
        };
      }
    } else if (item.key === "etf") {
      // PR-14: ETF môže ísť až 50% (main growth bucket, gets overflow before cash)
      if (item.pct > 50) {
        return {
          valid: false,
          message: `Príliš vysoká alokácia ETF (${item.pct}%). Max 50%.`,
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

  // Nakoniec over risk cap (PR-13: len warning, nie blokovanie)
  if (riskScore > riskCap) {
    return {
      valid: true, // Neblokuj výber
      message: `Riziko ${riskScore.toFixed(1)} prekračuje limit ${riskCap} pre ${riskPref} profil.`,
      isWarning: true, // Označiť ako warning
    };
  }

  return { valid: true };
}

// ============================================================================
// DYNAMIC ADJUSTMENTS (Lump sum / Monthly / Cash / Bonds scaling)
// ============================================================================

export type { ProfileForAdjustments, AdjustmentWarning, AdjustmentResult } from "./mixAdjustments";
export { getAdjustedPreset, getAdjustedMix } from "./mixAdjustments";

/**
 * PR-9 Task A: Dynamický default mix podľa riskPref
 * 
 * Vracia preset mix pre daný profil namiesto hard-coded vyvážený mix.
 * Používa sa ako fallback keď používateľ ešte nevybral portfólio.
 * 
 * @param riskPref - Rizikový profil (konzervativny|vyvazeny|rastovy)
 * @returns MixItem[] - Preset mix pre daný profil
 */
export function getDynamicDefaultMix(riskPref: RiskPref): MixItem[] {
  const preset = PORTFOLIO_PRESETS.find((p) => p.id === riskPref);
  return preset ? [...preset.mix] : PORTFOLIO_PRESETS[1].mix; // fallback na vyvážený
}
