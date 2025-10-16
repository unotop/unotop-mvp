import { getAssetsByScenario } from '../src/domain/assets';
import { computeRisk } from '../src/domain/risk';
import { computeRiskLegacy } from '../src/domain/riskLegacy';

function norm(m: Record<string, number>){
  const s = Object.values(m).reduce((a,b)=>a+b,0)||1;
  const o: Record<string, number> = {};
  for(const k in m) o[k] = m[k]/s;
  return o;
}

function expectedReturn(weights: Record<string, number>, assets: any){
  let er = 0;
  for(const k in weights) er += (weights[k]||0) * assets[k].expReturn;
  return er;
}

function fvMonthly(oneTime: number, monthly: number, years: number, rPa: number){
  const n = years*12;
  const r = rPa/12;
  let v = oneTime;
  for(let m=1;m<=n;m++) v = v * (1+r) + monthly;
  return v;
}

function runCase(name: string, mix: Record<string, number>){
  const assetsL = getAssetsByScenario('base' as any, 'legacy');
  const assetsC = getAssetsByScenario('base' as any, 'current');
  const nL = norm(mix);
  const nC = norm(mix);
  const rL = computeRiskLegacy(nL, assetsL).raw;
  const rC = computeRisk(nC, assetsC).raw;
  const erL = expectedReturn(nL, assetsL);
  const erC = expectedReturn(nC, assetsC);
  const fvL = fvMonthly(10000, 300, 10, erL);
  const fvC = fvMonthly(10000, 300, 10, erC);
  return { name, riskL: rL, riskC: rC, erL, erC, fvL, fvC };
}

const cases: Array<{ name: string; mix: Record<string, number> }> = [
  { name: 'Golden A (60/20/10/5/5)', mix: {
    'ETF (svet – aktívne)': 60,
    'Zlato (fyzické)': 20,
    'Krypto (BTC/ETH)': 10,
    'Dynamické riadenie': 5,
    'Garantovaný dlhopis 7,5% p.a.': 5,
    'Hotovosť/rezerva': 0,
    'Reality (komerčné)': 0,
  }},
  { name: 'Golden B (40/20/20/10/10)', mix: {
    'ETF (svet – aktívne)': 40,
    'Zlato (fyzické)': 20,
    'Krypto (BTC/ETH)': 20,
    'Dynamické riadenie': 10,
    'Garantovaný dlhopis 7,5% p.a.': 10,
    'Hotovosť/rezerva': 0,
    'Reality (komerčné)': 0,
  }},
  { name: 'Golden C (25/20/15/10/20/10)', mix: {
    'ETF (svet – aktívne)': 25,
    'Zlato (fyzické)': 20,
    'Krypto (BTC/ETH)': 15,
    'Dynamické riadenie': 10,
    'Garantovaný dlhopis 7,5% p.a.': 20,
    'Hotovosť/rezerva': 10,
    'Reality (komerčné)': 0,
  }},
  // Two "real" scenarios: conservative and aggressive
  { name: 'Real-1 (Conservative tilt)', mix: {
    'ETF (svet – aktívne)': 20,
    'Zlato (fyzické)': 25,
    'Krypto (BTC/ETH)': 5,
    'Dynamické riadenie': 5,
    'Garantovaný dlhopis 7,5% p.a.': 35,
    'Hotovosť/rezerva': 10,
    'Reality (komerčné)': 0,
  }},
  { name: 'Real-2 (Aggressive tilt)', mix: {
    'ETF (svet – aktívne)': 45,
    'Zlato (fyzické)': 10,
    'Krypto (BTC/ETH)': 20,
    'Dynamické riadenie': 15,
    'Garantovaný dlhopis 7,5% p.a.': 5,
    'Hotovosť/rezerva': 5,
    'Reality (komerčné)': 0,
  }},
];

const out = cases.map(c=> runCase(c.name, c.mix));
console.log(JSON.stringify(out, null, 2));
