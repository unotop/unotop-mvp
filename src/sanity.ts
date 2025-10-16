// Lightweight runtime sanity checks for core domain logic.
import { fvMonthly } from './domain/finance';
import { getAssetsByScenario } from './domain/assets';
import { computeRisk } from './domain/risk';
import { computeRecommendedMix } from './domain/recommendation';
import { findBestPortfolio } from './domain/optimizer';

(function runSanity(){
  if(typeof window === 'undefined') return;
  if(!import.meta?.env?.DEV) return;
  const assets = getAssetsByScenario('base');
  const fv = fvMonthly({ initial: 10000, monthly: 500, years: 10, rate: 0.08 });
  console.log('[sanity] FV sample 10y ≈', Math.round(fv));
  const weights: Record<string, number> = { 'ETF (svet – aktívne)':30, 'Zlato (fyzické)':20, 'Krypto (BTC/ETH)':10, 'Dynamické riadenie':10, 'Garantovaný dlhopis 7,5% p.a.':20, 'Hotovosť/rezerva':10 };
  const sum = Object.values(weights).reduce((a,b)=>a+b,0);
  if(sum !== 100) console.warn('[sanity] weights do not sum to 100');
  const norm: Record<string, number> = {}; for(const k in weights) { norm[k] = weights[k]/100; }
  const risk = computeRisk(norm, assets);
  console.log('[sanity] risk raw', risk.raw.toFixed(2));
  const rec = computeRecommendedMix({ years:15, income:3000, monthlyInvest:600, oneTime:10000, missingReserve:0, reUnlocked:true, assetsKeys:Object.keys(assets)});
  console.log('[sanity] rec mix sum', Object.values(rec).reduce((a,b)=>a+b,0));
  const sols = findBestPortfolio(assets, { step:10, maxSolutions:3 });
  console.log('[sanity] optimizer solutions', sols);
})();
