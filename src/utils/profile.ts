export type UiMode = 'basic' | 'pro';
export type RiskPref = 'conservative' | 'balanced' | 'growth';

export interface Policy {
  goldMin: number;      // in percentage points (0-100)
  dynamicMax: number;   // in p.p.
  cryptoMax: number;    // in p.p.
  riskySumMax: number;  // in p.p.
}

// Map risk preference + UI mode to policy caps/floors.
export function getPolicy(riskPref: RiskPref, uiMode: UiMode): Policy {
  const basic: Record<RiskPref, Policy> = {
    conservative: { goldMin: 15, dynamicMax: 12, cryptoMax: 3, riskySumMax: 15 },
    balanced:     { goldMin: 12, dynamicMax: 15, cryptoMax: 4, riskySumMax: 18 },
    growth:       { goldMin: 10, dynamicMax: 17, cryptoMax: 5, riskySumMax: 22 },
  };
  const b = basic[riskPref];
  if (uiMode === 'basic') return b;
  // PRO: slightly higher caps but riskySumMax never > 22
  const dyn = b.dynamicMax + 2;
  const cry = b.cryptoMax + 1;
  const risky = Math.min(22, b.riskySumMax);
  return { goldMin: b.goldMin, dynamicMax: dyn, cryptoMax: cry, riskySumMax: risky };
}

// Apply crisis bias steps: for each step add +2pp Gold and +2pp Bonds, taking first from ETF then Dynamic, then others.
export function applyCrisisBias(
  mix: Record<string, number>,
  steps: number
): Record<string, number> {
  if (!steps) return { ...mix };
  const out: Record<string, number> = { ...mix };
  const goldKey = Object.keys(out).find((k) => k.startsWith('Zlato'));
  const bondKey =
    Object.keys(out).find((k) => k.startsWith('Garantovaný dlhopis (fixný)')) ||
    Object.keys(out).find((k) => k.startsWith('Garantovaný dlhopis')) ||
    Object.keys(out).find((k) => k.startsWith('Dlhopis'));
  const etfKey = Object.keys(out).find((k) => k.startsWith('ETF'));
  const dynKey = Object.keys(out).find((k) => k.startsWith('Dynamické'));
  for (let s = 0; s < steps; s++) {
    if (goldKey) out[goldKey] = (out[goldKey] || 0) + 2;
    if (bondKey) out[bondKey] = (out[bondKey] || 0) + 2;
    // Step wants -2 from ETF and -2 from Dynamic. Borrow between them if one is short.
    let needEtf = 2;
    let needDyn = 2;
    // Take from ETF first up to 2
    if (etfKey) {
      const takeEtf = Math.min(out[etfKey] || 0, needEtf);
      out[etfKey] = (out[etfKey] || 0) - takeEtf;
      needEtf -= takeEtf;
    }
    // If ETF couldn't cover its 2, try borrow from Dynamic
    if (needEtf > 0 && dynKey) {
      const borrow = Math.min(out[dynKey] || 0, needEtf);
      out[dynKey] = (out[dynKey] || 0) - borrow;
      needEtf -= borrow;
    }
    // Now take from Dynamic up to 2
    if (dynKey) {
      const takeDyn = Math.min(out[dynKey] || 0, needDyn);
      out[dynKey] = (out[dynKey] || 0) - takeDyn;
      needDyn -= takeDyn;
    }
    // If Dynamic couldn't cover its 2, try borrow from ETF
    if (needDyn > 0 && etfKey) {
      const borrow = Math.min(out[etfKey] || 0, needDyn);
      out[etfKey] = (out[etfKey] || 0) - borrow;
      needDyn -= borrow;
    }
    // If still missing after ETF and Dynamic, take remainder proportionally from others
    let remaining = needEtf + needDyn; // 0..4
    if (remaining > 0) {
      const exclude = new Set([goldKey, bondKey, etfKey, dynKey].filter(Boolean) as string[]);
      const donors = Object.keys(out).filter((k) => !exclude.has(k) && (out[k] || 0) > 0);
      const total = donors.reduce((a, k) => a + (out[k] || 0), 0);
      if (total > 0) {
        for (const k of donors) {
          if (remaining <= 0) break;
          const share = Math.min(out[k] || 0, Math.round(((out[k] || 0) / total) * remaining) || 0);
          if (share > 0) {
            out[k] -= share;
            remaining -= share;
          }
        }
        // Any dust left, sweep linearly
        for (const k of donors) {
          if (remaining <= 0) break;
          const take = Math.min(out[k] || 0, remaining);
          out[k] -= take;
          remaining -= take;
        }
      }
    }
  }
  return out;
}

export function emailValid(addr: string): boolean {
  if (!addr) return false;
  // Simple RFC5322-ish check
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(addr);
}
