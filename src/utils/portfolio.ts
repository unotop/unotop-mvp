import { fairRoundTo100 } from '../domain/finance';

// Normalize arbitrary percent weights to integers summing 100 and enforce Gold >= 10%.
export function normalizeAndEnsureGold(weights: Record<string, number>): Record<string, number> {
  const base: Record<string, number> = {};
  Object.keys(weights).forEach(k=> base[k] = Math.max(0, weights[k]||0));
  let next = fairRoundTo100(base);
  const GOLD_KEY = 'Zlato (fyzické)';
  const gold = next[GOLD_KEY] || 0;
  if(gold < 10){
    let need = 10 - gold;
    next[GOLD_KEY] = 10;
    const others = Object.keys(next).filter(k=> k!==GOLD_KEY && next[k] > 0);
    let pool = others.reduce((a,k)=> a + next[k], 0) || 1;
    for(const k of others){
      if(need<=0) break;
      const take = Math.min(next[k], Math.round((next[k]/pool)*need));
      next[k] -= take; need -= take;
    }
    if(need>0){
      for(const k of others){ if(need<=0) break; const take = Math.min(next[k], need); next[k]-=take; need-=take; }
    }
  }
  return next;
}
