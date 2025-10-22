export type MixItem = { key: 'gold'|'dyn'|'etf'|'bonds'|'cash'|'crypto'|'real'|'other'; pct: number };

export function sum(list: MixItem[]) { return +list.reduce((a,b)=>a+b.pct,0).toFixed(2); }

export function normalize(list: MixItem[]): MixItem[] {
  const s = sum(list) || 1;
  const out = list.map(i => ({ ...i, pct: +(i.pct / s * 100).toFixed(2) }));
  const diff = +(100 - sum(out)).toFixed(2);
  if (Math.abs(diff) > 0) out[out.length-1] = { ...out[out.length-1], pct: +(out[out.length-1].pct + diff).toFixed(2) };
  return out;
}

export function setGoldTarget(list: MixItem[], target: number): MixItem[] {
  const gold = list.find(i => i.key==='gold'); if (!gold) return list;
  const others = list.filter(i => i.key!=='gold');
  const remaining = Math.max(0, 100 - target);
  const otherSum = others.reduce((a,b)=>a+b.pct,0) || 1;
  const redistributed = others.map(o => ({ ...o, pct: +(o.pct / otherSum * remaining).toFixed(2) }));
  return normalize([{ ...gold, pct: target }, ...redistributed]);
}

export function chipsFromState(list: MixItem[]): string[] {
  const gold = list.find(i=>i.key==='gold')?.pct || 0;
  const dyn  = list.find(i=>i.key==='dyn')?.pct  || 0;
  const crypto = list.find(i=>i.key==='crypto')?.pct || 0;
  const s = sum(list);
  const chips: string[] = [];
  if (gold >= 12) chips.push('Zlato dorovnané');
  if (dyn + crypto > 22) chips.push('Dyn+Krypto obmedzené');
  if (Math.abs(s - 100) < 0.01) chips.push('Súčet dorovnaný');
  // Risk cap chip
  try {
    const raw = localStorage.getItem('unotop:v3') || localStorage.getItem('unotop_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      const pref: string | undefined = parsed?.profile?.riskPref || parsed?.riskPref;
      const capMap: Record<string, number> = { konzervativny:4.0, vyvazeny:6.0, rastovy:7.5 };
      const cap = capMap[pref || 'vyvazeny'];
      const score = riskScore(list);
      if (score > cap) chips.push('⚠️ Nad limit rizika');
    }
  } catch {}
  return Array.from(new Set(chips));
}

// Simple risk scoring: weight dynamic + crypto + etf as higher risk
export function riskScore(list: MixItem[]): number {
  const dyn = list.find(i=>i.key==='dyn')?.pct || 0;
  const crypto = list.find(i=>i.key==='crypto')?.pct || 0;
  const etf = list.find(i=>i.key==='etf')?.pct || 0;
  // weights: dyn 0.15, crypto 0.25, etf 0.10; sum approximates risk index
  return +(dyn*0.15 + crypto*0.25 + etf*0.10).toFixed(2);
}

export function applyRiskConstrainedMix(list: MixItem[], cap: number): MixItem[] {
  let current = [...list];
  let score = riskScore(current);
  if (score <= cap) return normalize(current);
  // Identify risk components
  const riskKeys: MixItem['key'][] = ['dyn','crypto','etf'];
  const riskItems = current.filter(i=>riskKeys.includes(i.key));
  const safeItems = current.filter(i=>!riskKeys.includes(i.key));
  let riskSum = riskItems.reduce((a,b)=>a+b.pct,0) || 1;
  // Iteratively scale down risk block until score <= cap or minimal
  // scale factor derived from linear proportional reduction
  for (let iter=0; iter<10 && score>cap; iter++) {
    const factor = Math.max(0, (cap / score)); // target proportional factor
    riskItems.forEach(r => { r.pct = +(r.pct * factor).toFixed(2); });
    // redistribute freed percentage to safe items proportionally
    const newRiskSum = riskItems.reduce((a,b)=>a+b.pct,0);
    const freed = Math.max(0, riskSum - newRiskSum);
    const safeSum = safeItems.reduce((a,b)=>a+b.pct,0) || 1;
    safeItems.forEach(s => { s.pct = +(s.pct + (s.pct / safeSum * freed)).toFixed(2); });
    current = [...riskItems, ...safeItems];
    current = normalize(current);
    score = riskScore(current);
    riskSum = riskItems.reduce((a,b)=>a+b.pct,0) || 1;
  }
  return normalize(current);
}
