import { clamp } from '../utils/number';

export interface RecommendationInput {
  years: number;
  income: number;          // monthly income
  monthlyInvest: number;   // planned monthly invest
  oneTime: number;         // lump sum
  missingReserve: number;  // amount needed to fill emergency fund
  reUnlocked: boolean;     // real estate unlock flag
  assetsKeys: string[];    // available asset names
}

export function computeRecommendedMix(i: RecommendationInput): Record<string, number> {
  // Start from a balanced skeleton
  const base: Record<string, number> = {
    'ETF (svet – aktívne)': 30,
    'Zlato (fyzické)': 15,
    'Krypto (BTC/ETH)': 10,
    'Dynamické riadenie': 10,
    'Garantovaný dlhopis 7,5% p.a.': 20,
    'Hotovosť/rezerva': 15,
    'Reality (komerčné)': 0,
  };

  // Adjust for horizon: longer horizon -> more growth assets (ETF, crypto, dynamic)
  const long = i.years >= 10;
  const veryLong = i.years >= 18;
  if(long){
    base['ETF (svet – aktívne)'] += 5;
    base['Garantovaný dlhopis 7,5% p.a.'] -= 3;
    base['Hotovosť/rezerva'] -= 2;
  }
  if(veryLong){
    base['ETF (svet – aktívne)'] += 3;
    base['Krypto (BTC/ETH)'] += 2;
    base['Hotovosť/rezerva'] -= 2;
  }

  // Reserve not filled -> push more to cash/bonds
  if(i.missingReserve > 0){
    base['Hotovosť/rezerva'] += 5;
    base['Garantovaný dlhopis 7,5% p.a.'] += 3;
    base['Krypto (BTC/ETH)'] -= 3;
  }

  // High monthly invest vs income => slightly more defensive (reduce volatile)
  const investRatio = i.monthlyInvest / (i.income || 1);
  if(investRatio > 0.4){
    base['Krypto (BTC/ETH)'] -= 2;
    base['Dynamické riadenie'] -= 2;
    base['Garantovaný dlhopis 7,5% p.a.'] += 3;
    base['Zlato (fyzické)'] += 1;
  }

  // Large lump sum encourages diversification & some real estate if available
  if(i.oneTime >= 50000 && i.reUnlocked && i.assetsKeys.includes('Reality (komerčné)')){
    base['Reality (komerčné)'] = 5;
    base['ETF (svet – aktívne)'] += 2;
    base['Hotovosť/rezerva'] -= 2;
  }

  // Enforce minimum gold 10
  if(base['Zlato (fyzické)'] < 10) base['Zlato (fyzické)'] = 10;
  // Cap dynamic at 30
  base['Dynamické riadenie'] = Math.min(30, base['Dynamické riadenie']);

  // Prevent negatives if adjustments subtracted too much
  for(const k in base){
    base[k] = clamp(base[k], 0, 100);
  }

  // Normalize to 100
  const sum = Object.values(base).reduce((a,b)=>a+b,0) || 1;
  for(const k in base){
    base[k] = (base[k]/sum)*100;
  }

  // Final round so integers sum to 100
  const floors = Object.entries(base).map(([k,v]) => [k, Math.floor(v)] as [string, number]);
  let used = floors.reduce((a,[,v])=>a+v,0);
  const rems = Object.entries(base).map(([k,v]) => ({k, r: v - Math.floor(v)})).sort((a,b)=> b.r-a.r);
  let idx = 0;
  while(used < 100){
    const target = rems[idx % rems.length];
    const fIdx = floors.findIndex(([k])=>k===target.k);
    floors[fIdx][1] += 1;
    used++;
    idx++;
  }
  return Object.fromEntries(floors);
}
