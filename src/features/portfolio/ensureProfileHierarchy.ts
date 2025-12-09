/**
 * PR-30: Profile Hierarchy Enforcement
 * 
 * Garantuje produktovo-logické poradie profilov:
 * - Conservative < Balanced <= Growth (riziko aj výnos)
 * - cryptoG >= cryptoB (ak cryptoB > 0)
 * - IAD_G <= IAD_B (rastový nemôže mať viac rezervy)
 * 
 * Používa sa AFTER getAdjustedPreset pre všetky 3 profily,
 * aby sme zabezpečili konzistenciu medzi nimi.
 */

import type { MixItem } from "../mix/mix.service";
import type { RiskPref } from "../mix/assetModel";
import { normalize } from "../mix/mix.service";
import { riskScore0to10, approxYieldAnnualFromMix } from "../mix/assetModel";

export interface ProfileMixes {
  conservative: MixItem[];
  balanced: MixItem[];
  growth: MixItem[];
}

export interface HierarchyResult {
  conservative: MixItem[];
  balanced: MixItem[];
  growth: MixItem[];
  adjustmentsMade: boolean;
  violations: string[];
}

/**
 * Uplatni profile hierarchy invarianty
 * 
 * Invarianty:
 * 1. riskC < riskB <= riskG
 * 2. yieldG >= yieldB (ak riskG >= riskB)
 * 3. cryptoG >= cryptoB (ak cryptoB > 0, zvýš cryptoG; ak nemožné, zníž cryptoB)
 * 4. IAD_G <= IAD_B (rastový nemôže držať VIAC rezervy)
 * 
 * Stratégia úprav:
 * - Pri porušení rizika: presun z ETF → gold (znižuje riziko) alebo gold → ETF (zvyšuje)
 * - Pri porušení výnosu: zvýš ETF/crypto v Growth
 * - Pri porušení crypto: zvýš cryptoG (ak riskG to dovolí), inak zníž cryptoB
 * - Pri porušení IAD: presun z IAD → ETF v Growth
 */
export function ensureProfileHierarchy(
  mixes: ProfileMixes
): HierarchyResult {
  const { conservative, balanced, growth } = mixes;
  
  // Deep copy pre mutácie
  const consAdj = JSON.parse(JSON.stringify(conservative)) as MixItem[];
  const balAdj = JSON.parse(JSON.stringify(balanced)) as MixItem[];
  const growthAdj = JSON.parse(JSON.stringify(growth)) as MixItem[];
  
  const violations: string[] = [];
  let adjustmentsMade = false;
  
  // Helper: získaj pct aktíva
  const getPct = (mix: MixItem[], key: MixItem["key"]) =>
    mix.find((m) => m.key === key)?.pct ?? 0;
  
  // Helper: nastav pct aktíva
  const setPct = (mix: MixItem[], key: MixItem["key"], val: number) => {
    const idx = mix.findIndex((m) => m.key === key);
    if (idx !== -1) mix[idx].pct = Math.max(0, val);
  };
  
  // --- INVARIANT 1: riskC < riskB <= riskG ---
  const riskC = riskScore0to10(consAdj);
  const riskB = riskScore0to10(balAdj);
  const riskG = riskScore0to10(growthAdj);
  
  console.log(`[EnsureHierarchy] Initial risks: C=${riskC.toFixed(2)}, B=${riskB.toFixed(2)}, G=${riskG.toFixed(2)}`);
  
  if (riskC >= riskB) {
    violations.push(`riskC (${riskC.toFixed(2)}) >= riskB (${riskB.toFixed(2)})`);
    
    // Zníž Conservative risk: presun ETF → gold (max 5 p.b.)
    const consEtf = getPct(consAdj, "etf");
    const consGold = getPct(consAdj, "gold");
    const shift = Math.min(5, consEtf);
    
    setPct(consAdj, "etf", consEtf - shift);
    setPct(consAdj, "gold", consGold + shift);
    normalize(consAdj);
    
    adjustmentsMade = true;
    console.log(`[EnsureHierarchy] Shifted Conservative ETF→gold (${shift.toFixed(1)} p.b.)`);
  }
  
  if (riskB > riskG) {
    violations.push(`riskB (${riskB.toFixed(2)}) > riskG (${riskG.toFixed(2)})`);
    
    // Zvýš Growth risk: presun gold → ETF (max 5 p.b.)
    const growthGold = getPct(growthAdj, "gold");
    const growthEtf = getPct(growthAdj, "etf");
    const shift = Math.min(5, growthGold);
    
    setPct(growthAdj, "gold", growthGold - shift);
    setPct(growthAdj, "etf", growthEtf + shift);
    normalize(growthAdj);
    
    adjustmentsMade = true;
    console.log(`[EnsureHierarchy] Shifted Growth gold→ETF (${shift.toFixed(1)} p.b.)`);
  }
  
  // --- INVARIANT 2: yieldG >= yieldB (ak riskG >= riskB) ---
  const yieldB = approxYieldAnnualFromMix(balAdj);
  const yieldG = approxYieldAnnualFromMix(growthAdj);
  
  console.log(`[EnsureHierarchy] Initial yields: B=${(yieldB * 100).toFixed(2)}%, G=${(yieldG * 100).toFixed(2)}%`);
  
  const riskGAfter = riskScore0to10(growthAdj);
  const riskBAfter = riskScore0to10(balAdj);
  
  if (riskGAfter >= riskBAfter && yieldG < yieldB - 0.001) {
    violations.push(`yieldG (${(yieldG * 100).toFixed(2)}%) < yieldB (${(yieldB * 100).toFixed(2)}%)`);
    
    // Zvýš yield Growth: presun IAD → ETF (max 5 p.b.)
    const growthCash = getPct(growthAdj, "cash");
    const growthEtf = getPct(growthAdj, "etf");
    const shift = Math.min(5, growthCash);
    
    setPct(growthAdj, "cash", growthCash - shift);
    setPct(growthAdj, "etf", growthEtf + shift);
    normalize(growthAdj);
    
    adjustmentsMade = true;
    console.log(`[EnsureHierarchy] Shifted Growth IAD→ETF for yield (${shift.toFixed(1)} p.b.)`);
  }
  
  // --- INVARIANT 3: cryptoG >= cryptoB ---
  const cryptoB = getPct(balAdj, "crypto");
  let cryptoG = getPct(growthAdj, "crypto");
  
  console.log(`[EnsureHierarchy] Crypto: B=${cryptoB.toFixed(1)}%, G=${cryptoG.toFixed(1)}%`);
  
  if (cryptoB > cryptoG + 0.1) {
    violations.push(`cryptoB (${cryptoB.toFixed(1)}%) > cryptoG (${cryptoG.toFixed(1)}%)`);
    
    // Pokus 1: Zvýš cryptoG na úroveň cryptoB
    const neededCrypto = cryptoB - cryptoG;
    const growthCash = getPct(growthAdj, "cash");
    const growthBonds = getPct(growthAdj, "bonds");
    
    // Zobraní z IAD a bonds proporcionálne
    const fromCash = Math.min(neededCrypto * 0.7, growthCash);
    const fromBonds = Math.min(neededCrypto * 0.3, growthBonds);
    const totalShift = fromCash + fromBonds;
    
    if (totalShift >= neededCrypto * 0.8) {
      // Zvýšime cryptoG
      setPct(growthAdj, "crypto", cryptoG + totalShift);
      setPct(growthAdj, "cash", growthCash - fromCash);
      setPct(growthAdj, "bonds", growthBonds - fromBonds);
      normalize(growthAdj);
      
      adjustmentsMade = true;
      console.log(`[EnsureHierarchy] Increased cryptoG by ${totalShift.toFixed(1)} p.b.`);
    } else {
      // Nie je dosť priestoru → zníž cryptoB na 0
      console.warn(`[EnsureHierarchy] Cannot increase cryptoG → reducing cryptoB to 0`);
      
      const balCrypto = getPct(balAdj, "crypto");
      const balEtf = getPct(balAdj, "etf");
      
      setPct(balAdj, "crypto", 0);
      setPct(balAdj, "etf", balEtf + balCrypto);
      normalize(balAdj);
      
      adjustmentsMade = true;
    }
  }
  
  // --- INVARIANT 4: IAD_G <= IAD_B ---
  const cashB = getPct(balAdj, "cash");
  const cashG = getPct(growthAdj, "cash");
  
  console.log(`[EnsureHierarchy] IAD DK: B=${cashB.toFixed(1)}%, G=${cashG.toFixed(1)}%`);
  
  if (cashG > cashB + 0.1) {
    violations.push(`IAD_G (${cashG.toFixed(1)}%) > IAD_B (${cashB.toFixed(1)}%)`);
    
    // Presun z IAD → ETF v Growth
    const excess = cashG - cashB;
    const growthEtf = getPct(growthAdj, "etf");
    
    setPct(growthAdj, "cash", cashB);
    setPct(growthAdj, "etf", growthEtf + excess);
    normalize(growthAdj);
    
    adjustmentsMade = true;
    console.log(`[EnsureHierarchy] Shifted Growth IAD→ETF (${excess.toFixed(1)} p.b.)`);
  }
  
  // --- FINAL VALIDATION ---
  const finalRiskC = riskScore0to10(consAdj);
  const finalRiskB = riskScore0to10(balAdj);
  const finalRiskG = riskScore0to10(growthAdj);
  const finalYieldB = approxYieldAnnualFromMix(balAdj);
  const finalYieldG = approxYieldAnnualFromMix(growthAdj);
  
  console.log(`[EnsureHierarchy] Final risks: C=${finalRiskC.toFixed(2)}, B=${finalRiskB.toFixed(2)}, G=${finalRiskG.toFixed(2)}`);
  console.log(`[EnsureHierarchy] Final yields: B=${(finalYieldB * 100).toFixed(2)}%, G=${(finalYieldG * 100).toFixed(2)}%`);
  console.log(`[EnsureHierarchy] Adjustments made: ${adjustmentsMade}, Violations: ${violations.length}`);
  
  return {
    conservative: normalize(consAdj),
    balanced: normalize(balAdj),
    growth: normalize(growthAdj),
    adjustmentsMade,
    violations,
  };
}
