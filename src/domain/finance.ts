import { clamp } from '../utils/number';

export interface FVParams {
  initial: number; // starting amount
  monthly: number; // monthly contribution
  years: number;   // horizon in years
  rate: number;    // expected annual return (0.07 = 7%)
}

// Convert an annual nominal rate to an effective monthly rate (simple division fallback)
export function monthlyFromAnnual(r: number){
  return r/12; // for simplicity; could use (1+r)**(1/12)-1
}

// Future value with monthly contributions (contribution at period end)
export function fvMonthly(p: FVParams){
  const months = Math.max(0, Math.round(p.years*12));
  const i = monthlyFromAnnual(p.rate);
  let total = p.initial;
  for(let m=0; m<months; m++){
    total *= (1+i);
    total += p.monthly;
  }
  return total;
}

// Fair rounding of weights so they sum exactly to 100 (largest remainder method)
export function fairRoundTo100(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights);
  if(entries.length === 0) return {};
  const raw = entries.map(([k,v]) => [k, clamp(v,0,100)] as [string, number]);
  const sum = raw.reduce((a, [,v]) => a+v, 0) || 1;
  const normalized = raw.map(([k,v]) => [k, (v/sum)*100] as [string, number]);
  const floors = normalized.map(([k,v]) => [k, Math.floor(v)] as [string, number]);
  let used = floors.reduce((a,[,v])=>a+v,0);
  const remainders = normalized.map(([k,v],idx) => ({ key:k, rem: v - floors[idx][1] }));
  remainders.sort((a,b)=> b.rem - a.rem);
  let i=0;
  while(used < 100){
    const r = remainders[i % remainders.length];
    const fIdx = floors.findIndex(([k])=>k===r.key);
    floors[fIdx][1] += 1;
    used += 1;
    i++;
  }
  return Object.fromEntries(floors);
}

// Lightweight self-checks (won't throw in production, only console)
(function tests(){
  // Use (import.meta as any).env for TS compatibility (build-time check may not include Vite types)
  if(typeof window === 'undefined' || !(import.meta as any)?.env?.DEV) return;
  const approx = (a:number,b:number,e=1e-6)=> Math.abs(a-b)<e;
  console.assert(approx(fvMonthly({initial:1000, monthly:0, years:1, rate:0}),1000), 'fvMonthly lumpsum zero rate');
  console.assert(fvMonthly({initial:0, monthly:100, years:1, rate:0}) === 1200, 'fvMonthly annuity zero rate');
})();
