// src/persist/v3.ts
export type Debt = { 
  id: string; 
  name: string; 
  principal: number; 
  ratePa: number; 
  monthly: number; 
  monthsLeft?: number; 
  remaining?: number;
  extraMonthly?: number; // mimoriadna splátka (mesačná, ide na istinu)
};
export type MixItem = { key: string; pct: number };
export type Profile = { 
  monthlyIncome?: number; 
  reserveEur?: number; 
  reserveMonths?: number; 
  riskMode?: 'legacy'|'current'; 
  modeUi?: 'BASIC'|'PRO'; 
  clientType?: 'individual' | 'family' | 'firm';
  riskPref?: string; 
  crisisBias?: number;
  lumpSumEur?: number;
  horizonYears?: number;
  goalAssetsEur?: number;
  fixedExp?: number;
  varExp?: number;
  currentReserve?: number;
  emergencyMonths?: number;
};

export type V3 = Partial<{
  debts: Debt[];
  mix: MixItem[];
  profile: Profile;
  // back-compat top-level mirrors (tests may read these directly)
  monthlyIncome: number;
  monthly: number; // mirror for monthlyVklad
  reserveEur: number;
  reserveMonths: number;
  riskMode: 'legacy'|'current';
  modeUi: 'BASIC'|'PRO';
  riskPref: string; // legacy tests
  crisisBias: number; // legacy tests
}>;

const KEY_V3_COLON = 'unotop:v3';
const KEY_V3_UNDERSCORE = 'unotop_v3';

function safeParse<T>(s: string | null): T | null {
  try { return s ? JSON.parse(s) as T : null; } catch { return null; }
}

export function readV3(): V3 {
  return safeParse<V3>(localStorage.getItem(KEY_V3_COLON))
      ?? safeParse<V3>(localStorage.getItem(KEY_V3_UNDERSCORE))
      ?? {};
}

export function writeV3(patch: Partial<V3>): V3 {
  const cur = readV3();
  const next: V3 = { ...cur, ...patch };
  // ensure version marker for tests expecting version===3
  (next as any).version = 3;

  if (patch.profile) {
    const p = patch.profile as Profile;
    if (typeof p.monthlyIncome === 'number') next.monthlyIncome = p.monthlyIncome;
    if (typeof p.reserveEur === 'number')    next.reserveEur    = p.reserveEur;
    if (typeof p.reserveMonths === 'number') next.reserveMonths = p.reserveMonths;
  if (p.riskMode)                          next.riskMode      = p.riskMode;
  if (p.modeUi)                            next.modeUi        = p.modeUi;
    if (p.riskPref)                          next.riskPref      = p.riskPref;
    if (typeof p.crisisBias === 'number')    next.crisisBias    = p.crisisBias;
    // legacy alias mirrors (tests still read these)
    if (typeof p.reserveEur === 'number')    (next as any).current_reserve   = p.reserveEur;
    if (typeof p.reserveMonths === 'number') (next as any).emergency_months  = p.reserveMonths;
  }

  const json = JSON.stringify(next);
  try {
    localStorage.setItem(KEY_V3_COLON, json);
    localStorage.setItem(KEY_V3_UNDERSCORE, json);
  } catch {}
  return next;
}
