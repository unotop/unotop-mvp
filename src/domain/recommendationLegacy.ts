// Legacy recommended mix heuristic per spec-logic-v1.
import { fairRoundTo100 } from './finance';
import { clamp } from '../utils/number';

export interface LegacyRecArgs {
  years: number;
  income: number;          // monthly income
  monthlyInvest: number;   // planned monthly invest (contribution)
  oneTime: number;         // lump sum
  missingReserve: number;  // amount needed to fill emergency fund
  reUnlocked: boolean;     // real estate unlock flag
  assetsKeys: string[];    // available asset names
}

export interface LegacyPolicy {
  goldMin: number;        // e.g., 0.10 for 10%
  dynamicMax: number;     // e.g., 0.30 for 30%
  cryptoMax: number;      // e.g., 0.10 for 10%
  riskySumMax: number;    // cap for (Dynamic + Crypto), e.g., 0.22 retail, 0.20 company
}

export function computeRecommendedMixLegacy(i: LegacyRecArgs, policy?: Partial<LegacyPolicy>): Record<string, number> {
  const goldFloorPct = Math.max(0, Math.min(1, policy?.goldMin ?? 0.10));
  const dynMaxPct = Math.max(0, Math.min(1, policy?.dynamicMax ?? 0.30));
  const cryptoMaxPct = Math.max(0, Math.min(1, policy?.cryptoMax ?? 0.12));
  const riskySumMaxPct = Math.max(0, Math.min(1, policy?.riskySumMax ?? 0.22));
  let target: Record<string, number> = {
    'ETF (svet – aktívne)': 30,
    'Zlato (fyzické)': 20,
    'Krypto (BTC/ETH)': 15,
    'Dynamické riadenie': 10,
    'Garantovaný dlhopis 7,5% p.a.': 15,
    'Hotovosť/rezerva': 10,
  };
  const H = i.years <= 5 ? 'short' : i.years <= 14 ? 'mid' : 'long';
  if(H === 'short') {
    target = {
      'ETF (svet – aktívne)': 20,
      'Zlato (fyzické)': 25,
      'Krypto (BTC/ETH)': 10,
      'Dynamické riadenie': 5,
      'Garantovaný dlhopis 7,5% p.a.': 20,
      'Hotovosť/rezerva': 20,
    };
  } else if (H === 'long') {
    target = {
      'ETF (svet – aktívne)': 40,
      'Zlato (fyzické)': 15,
      'Krypto (BTC/ETH)': 15,
      'Dynamické riadenie': 15,
      'Garantovaný dlhopis 7,5% p.a.': 10,
      'Hotovosť/rezerva': 5,
    };
  }

  // Large lump sum overrides (descending precedence)
  if(i.oneTime >= 1_000_000){
    target = { 'ETF (svet – aktívne)':32,'Zlato (fyzické)':22,'Krypto (BTC/ETH)':1,'Dynamické riadenie':3,'Garantovaný dlhopis 7,5% p.a.':37,'Hotovosť/rezerva':5 };
  } else if(i.oneTime >= 500_000){
    target = { 'ETF (svet – aktívne)':38,'Zlato (fyzické)':20,'Krypto (BTC/ETH)':2,'Dynamické riadenie':5,'Garantovaný dlhopis 7,5% p.a.':30,'Hotovosť/rezerva':5 };
  } else if(i.oneTime >= 100_000){
    target['Krypto (BTC/ETH)'] = Math.min(target['Krypto (BTC/ETH)'], 3);
    target['Dynamické riadenie'] = Math.min(target['Dynamické riadenie'], 7);
    target['Garantovaný dlhopis 7,5% p.a.'] = Math.max(target['Garantovaný dlhopis 7,5% p.a.'], 25);
    target['Zlato (fyzické)'] = Math.max(target['Zlato (fyzické)'], 15);
  }

  // Monthly invest adjustments
  if(i.monthlyInvest < 100){
    target['Krypto (BTC/ETH)'] = Math.min(target['Krypto (BTC/ETH)'], 4);
    target['Dynamické riadenie'] = Math.min(target['Dynamické riadenie'], 6);
    target['Garantovaný dlhopis 7,5% p.a.'] = Math.max(target['Garantovaný dlhopis 7,5% p.a.'], 30);
  } else if(i.monthlyInvest >= 500){
    target['Krypto (BTC/ETH)'] = Math.min(10, (target['Krypto (BTC/ETH)']||0)+2);
    target['Dynamické riadenie'] = Math.min(12, (target['Dynamické riadenie']||0)+2);
  }

  // Missing reserve defensive tilt
  if(i.missingReserve > 0){
    target['Hotovosť/rezerva'] = Math.max(target['Hotovosť/rezerva'], 10);
    target['Garantovaný dlhopis 7,5% p.a.'] = Math.max(target['Garantovaný dlhopis 7,5% p.a.'], 30);
    target['Krypto (BTC/ETH)'] = Math.min(target['Krypto (BTC/ETH)'], 5);
    target['Dynamické riadenie'] = Math.min(target['Dynamické riadenie'], 6);
  }

  // Real estate unlock
  if(i.reUnlocked){
    const take = 10;
    (target as any)['Reality (komerčné)'] = take;
    const donors = ['ETF (svet – aktívne)', 'Garantovaný dlhopis 7,5% p.a.'];
    donors.forEach(k=>{ if(k in target) target[k] = Math.max(0,(target[k]||0) - take/donors.length); });
  }

  // Hard caps / floors (from policy)
  target['Zlato (fyzické)'] = Math.max(Math.round(goldFloorPct*100), target['Zlato (fyzické)']||0);
  target['Dynamické riadenie'] = Math.min(Math.round(dynMaxPct*100), target['Dynamické riadenie']||0);
  target['Krypto (BTC/ETH)'] = Math.min(Math.round(cryptoMaxPct*100), target['Krypto (BTC/ETH)']||0);
  // Phase A: Pre-round risky sum limiter (Dynamic + Crypto > 22)
  {
    const dynKey = 'Dynamické riadenie';
    const cryKey = 'Krypto (BTC/ETH)';
    const bondKey = 'Garantovaný dlhopis 7,5% p.a.';
    const cap = Math.round(riskySumMaxPct*100);
    const riskySumA = (target[dynKey]||0) + (target[cryKey]||0);
    if(riskySumA > cap){
      const over = riskySumA - cap;
      const dynRoom = Math.max(0, (target[dynKey]||0) - 8); // only take dynamic above 8 p.b.
      const takeDyn = Math.min(over, dynRoom);
      if(takeDyn > 0) target[dynKey] = Math.max(0,(target[dynKey]||0) - takeDyn);
      const remaining = over - takeDyn;
      if(remaining > 0) target[cryKey] = Math.max(0,(target[cryKey]||0) - remaining);
      // Add full over into bonds (defensive absorption)
      target[bondKey] = (target[bondKey]||0) + over;
    }
  }

  // Filter & clamp before rounding
  const preRound: Record<string, number> = {};
  for(const k of Object.keys(target)){
    if(i.assetsKeys.includes(k)) preRound[k] = clamp(target[k]||0, 0, 100);
  }
  let rounded = fairRoundTo100(preRound);

  // Phase B: Post-round guard to ensure Dynamic + Crypto ≤ cap (correct any +1 p.b. overshoot)
  {
    const dynKey = 'Dynamické riadenie';
    const cryKey = 'Krypto (BTC/ETH)';
    const bondKey = 'Garantovaný dlhopis 7,5% p.a.';
    const cap = Math.round(riskySumMaxPct*100);
    const risky = () => (rounded[dynKey]||0) + (rounded[cryKey]||0);
    let guard = 0;
    while(risky() > cap && guard < 10){
      const d = rounded[dynKey]||0;
      const c = rounded[cryKey]||0;
      if(d >= c && d > 0){
        rounded[dynKey] = d - 1;
      } else if(c > 0){
        rounded[cryKey] = c - 1;
      } else {
        break; // nothing to take
      }
      rounded[bondKey] = (rounded[bondKey]||0) + 1;
      guard++;
    }
    // Re-round if sum drifted
    const total = Object.values(rounded).reduce((a,b)=>a+b,0);
    if(total !== 100){
      const tmp: Record<string, number> = {};
      for(const k of Object.keys(rounded)) tmp[k] = rounded[k];
      rounded = fairRoundTo100(tmp);
    }
  }

  return rounded;
}
