// Legacy risk model replicated from spec-logic-v1 (pre-modular snapshot)
// Uses overweight starting at 20%, concentration threshold 0.22, piecewise dynamic surcharge.
import type { Assets } from './assets';

export interface LegacyRiskResult {
  score10: number; // raw unclamped (min(11, raw)) for display mapping
  pct: number;     // 0-100 for gauge arc (raw capped at 10)
  raw: number;     // composite raw risk (unbounded except later clamps)
  hhi: number;
  wMax: number;
  top2Sum: number;
}

const OVERWEIGHT_START = 0.2;
const ALPHA_OVERWEIGHT = 0.5;
const GAMMA_HHI = 1.0;

export function computeRiskLegacy(normMix: Record<string, number>, assets: Assets): LegacyRiskResult {
  let weighted = 0;
  let HHI = 0;
  let wMax = 0;
  const entries = Object.entries(normMix);
  const sorted = [...entries].sort((a,b)=> b[1]-a[1]);
  const top2Sum = (sorted[0]?.[1]||0) + (sorted[1]?.[1]||0);

  for(const [k,w] of entries){
    const base = assets[k]?.risk ?? 5;
    const baseWithCash = k.startsWith('Hotovosť') ? 2 + 6 * Math.min(1, Math.max(0,w)) : base;
    const over = Math.max(0, w - OVERWEIGHT_START) / (1 - OVERWEIGHT_START);
    const eff = baseWithCash * (1 + ALPHA_OVERWEIGHT * over);
    weighted += w * eff;
    HHI += w * w;
    if(w > wMax) wMax = w;
  }

  const concPenalty = 10 * GAMMA_HHI * Math.max(0, HHI - 0.22);
  const dynW = normMix['Dynamické riadenie'] || 0;
  let dynExtra = 0;
  if (dynW >= 0.2 && dynW < 0.3) dynExtra = 10 * (dynW - 0.2);
  else if (dynW >= 0.3 && dynW < 0.4) dynExtra = 1 + 10 * (dynW - 0.3);
  else if (dynW >= 0.4 && dynW < 0.5) dynExtra = 2 + 20 * (dynW - 0.4);
  else if (dynW >= 0.5) dynExtra = 4 + 30 * (dynW - 0.5);

  const raw = weighted + concPenalty + dynExtra;
  const score10 = Math.min(11, raw);
  const pct = Math.min(100, Math.max(0, (Math.min(raw, 10)/10)*100));
  return { score10, pct, raw, hhi: HHI, wMax, top2Sum };
}
