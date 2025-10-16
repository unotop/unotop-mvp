import type { Assets } from './assets';

// Exported constants for spec-guarding and transparency
export const OVERWEIGHT_START = 0.35; // 35%
export const OVERWEIGHT_K = 8;        // coefficient for overweight penalty
export const HHI_THRESHOLD = 0.18;    // HHI break
export const HHI_K = 12;              // coefficient for concentration penalty
export const DYNCRYPTO_SUM_START = 0.45; // (dyn + crypto) threshold 45%
export const DYNCRYPTO_K = 15;           // coefficient for dynamic surcharge

export interface RiskResult {
  raw: number;    // 0-10 scaled risk
  pct: number;    // 0-1 (raw/10)
  details: {
    base: number;
    overweightPenalty: number;
    concentrationPenalty: number;
    dynamicSurcharge: number;
  };
}

// Compute risk: weighted base + penalties
export function computeRisk(weights: Record<string, number>, assets: Assets): RiskResult {
  // normalize weights to 1
  const sum = Object.values(weights).reduce((a,b)=>a+b,0) || 1;
  const norm: Record<string, number> = {};
  for(const k in weights){
    norm[k] = (weights[k] / sum);
  }
  // base weighted risk
  let base = 0;
  for(const k in norm){
    const a = assets[k];
    if(!a) continue;
    base += norm[k] * a.risk;
  }
  // overweight penalty (any position over OVERWEIGHT_START)
  let overweightPenalty = 0;
  for(const k in norm){
    const w = norm[k];
    if(w > OVERWEIGHT_START){
      overweightPenalty += (w - OVERWEIGHT_START) * OVERWEIGHT_K; // scale
    }
  }
  // concentration (Herfindahl-Hirschman like)
  const hhi = Object.values(norm).reduce((a,w)=> a + w*w, 0);
  const concentrationPenalty = Math.max(0, (hhi - HHI_THRESHOLD)) * HHI_K; // tuned

  // dynamic surcharge (if dynamic allocation + crypto jointly high)
  const dyn = norm['Dynamické riadenie'] || 0;
  const crypto = norm['Krypto (BTC/ETH)'] || 0;
  let dynamicSurcharge = 0;
  if(dyn + crypto > DYNCRYPTO_SUM_START){
    dynamicSurcharge = (dyn + crypto - DYNCRYPTO_SUM_START) * DYNCRYPTO_K;
  }

  let raw = base + overweightPenalty + concentrationPenalty + dynamicSurcharge;
  raw = Math.min(10, raw);

  return {
    raw,
    pct: raw/10,
    details: { base, overweightPenalty, concentrationPenalty, dynamicSurcharge }
  };
}
