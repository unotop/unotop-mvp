import { computeRisk } from './risk';
import { computeRiskLegacy } from './riskLegacy';
import type { Assets } from './assets';

export interface OptimizerOptions {
  step?: number;              // weight increment percentage (default 5)
  maxRisk?: number;           // soft cap (exclude mixes above this raw risk)
  requireGoldMin?: number;    // minimum gold weight % (default 10)
  dynamicCap?: number;        // maximum dynamic allocation % (default 30)
  cryptoCap?: number;         // maximum crypto allocation % (optional)
  riskySumMax?: number;       // maximum (dynamic + crypto) sum % (optional)
  maxSolutions?: number;      // keep only top N solutions
  mode?: 'legacy' | 'current'; // scoring mode
  reasonMode?: 'score' | 'výnos'; // preferred reason label when not 'low risk'
}

export interface OptimizedSolution {
  weights: Record<string, number>; // integer percentages summing 100
  expectedReturn: number;          // weighted expected annual return
  risk: number;                    // raw risk (0-10)
  score: number;                   // expectedReturn / (risk || 1)
  reason?: 'score' | 'výnos' | 'low risk';
}

// Brute-force optimizer exploring coarse grid of allocations.
// This is intentionally simple (non-dominated filtering could be added later).
export function findBestPortfolio(assets: Assets, opts: OptimizerOptions = {}): OptimizedSolution[] {
  const step = opts.step ?? 5; // 5% granularity
  const maxRisk = opts.maxRisk ?? 9.8;
  const goldMin = opts.requireGoldMin ?? 10;
  const dynCap = opts.dynamicCap ?? 30;
  const cryCap = opts.cryptoCap ?? Number.POSITIVE_INFINITY;
  const riskyMax = opts.riskySumMax ?? Number.POSITIVE_INFINITY;
  const maxSolutions = opts.maxSolutions ?? 5;
  const mode = opts.mode || 'current';

  const keys = Object.keys(assets);
  // Order keys so that gold + dynamic evaluated early for pruning
  keys.sort((a,b)=>{
    if(a.includes('Zlato')) return -1;
    if(b.includes('Zlato')) return 1;
    if(a.includes('Dynamické')) return -1;
    if(b.includes('Dynamické')) return 1;
    return a.localeCompare(b);
  });

  const solutions: OptimizedSolution[] = [];
  const current: Record<string, number> = {};

  function backtrack(idx: number, remaining: number){
    if(idx === keys.length - 1){
      current[keys[idx]] = remaining;
      // Constraint checks
      const zl = (current['Zlato (fyzické)'] || 0);
      const dy = (current['Dynamické riadenie'] || 0);
      const cr = (current['Krypto (BTC/ETH)'] || 0);
      if(zl < goldMin) return;
      if(dy > dynCap) return;
      if(cr > cryCap) return;
      if(dy + cr > riskyMax) return;
      evaluateCurrent();
      return;
    }
    const k = keys[idx];
    for(let w=0; w<=remaining; w+=step){
      current[k] = w;
      // Early constraint pruning
      if(k === 'Zlato (fyzické)' && w < goldMin) {
        // If we are below gold minimum and not at final distribution, ensure remaining could still reach min
        if(remaining - w + w < goldMin) continue;
      }
      if(k === 'Dynamické riadenie' && w > dynCap) continue;
      if(k === 'Krypto (BTC/ETH)' && w > cryCap) continue;
      if(k === 'Dynamické riadenie' || k === 'Krypto (BTC/ETH)'){
        const dy = (current['Dynamické riadenie'] || 0);
        const cr = (current['Krypto (BTC/ETH)'] || 0);
        if(dy + cr > riskyMax) continue;
      }
      backtrack(idx+1, remaining - w);
    }
  }

  function evaluateCurrent(){
    // Normalize to 1 weights for risk & return calc
    const norm: Record<string, number> = {};
    for(const k of keys) norm[k] = (current[k]||0)/100;
    const riskRes = mode === 'legacy' ? (computeRiskLegacy as any)(norm, assets) : computeRisk(norm, assets);
    if(riskRes.raw > maxRisk) return;
    // expected return
    let er = 0;
    for(const k of keys){
      er += norm[k] * assets[k].expReturn;
    }
    const score = mode === 'legacy' ? ((er * 100) / Math.min(10, riskRes.raw || 1)) : (er / (riskRes.raw || 1));
    const solution: OptimizedSolution = {
      weights: { ...current },
      expectedReturn: er,
      risk: riskRes.raw,
      score,
      reason: riskRes.raw <= 5 ? 'low risk' : (opts.reasonMode || 'score'),
    };
    insertSolution(solution);
  }

  function insertSolution(sol: OptimizedSolution){
    solutions.push(sol);
    solutions.sort((a,b)=> b.score - a.score);
    if(solutions.length > maxSolutions) solutions.length = maxSolutions;
  }

  backtrack(0, 100);
  return solutions;
}
