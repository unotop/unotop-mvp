// src/persist/v3.ts
import { emitMixChangeEvent } from "./mixEvents";

export type Debt = { 
  id: string;
  type?: "mortgage" | "consumer"; // PR-13: Typ dlhu pre validácie
  name: string; 
  principal: number; 
  ratePa: number; 
  monthly: number; 
  monthsLeft?: number; 
  remaining?: number;
  extraMonthly?: number; // mimoriadna splátka (mesačná, ide na istinu)
};
export type MixItem = { key: string; pct: number };

// PR-13: Contact info pre lead capture (bonusy)
export type ContactInfo = {
  name?: string;
  email?: string;
  phone?: string;
  bonuses?: string[]; // UFO, refi_7d, audit, pdf, ebook
};

// PR-12: Mix origin tracking pre lazy reapply
export type MixOrigin = 'presetAdjusted' | 'manual';
export type ProfileSnapshot = {
  lumpSum: number;
  monthly: number;
  horizon: number;
  ts: number; // timestamp
};

export type Profile = { 
  monthlyIncome?: number; 
  reserveEur?: number; 
  reserveMonths?: number; 
  riskMode?: 'legacy'|'current'; 
  modeUi?: 'BASIC'|'PRO'; 
  clientType?: 'individual' | 'family' | 'company'; // PR-17: firm → company
  riskPref?: string; 
  crisisBias?: number;
  lumpSumEur?: number;
  horizonYears?: number;
  goalAssetsEur?: number;
  fixedExp?: number;
  varExp?: number;
  currentReserve?: number;
  emergencyMonths?: number;
  hideTour?: boolean; // Nezobrazovať welcome modal
  selected?: 'konzervativny' | 'vyvazeny' | 'rastovy'; // PR-7: sticky profil po výbere
  // PR-12: Beta auto-optimize
  autoOptimizeMix?: boolean; // default false
  // PR-27: Voľba zhodnotenia (nominálne vs. reálne po inflácii)
  valuationMode?: 'real' | 'nominal'; // default 'real'
  // Referral system: agent code (format: ab01, jb01, etc.)
  agentRefCode?: string;
};

export type V3 = Partial<{
  debts: Debt[];
  mix: MixItem[];
  profile: Profile;
  contact: ContactInfo; // PR-13: Contact info + bonuses
  mixLocked?: boolean; // PR-4: Po výbere profilu/manuálnom ťahu → žiadne auto-prepisy
  // PR-12: Mix origin tracking
  mixOrigin?: MixOrigin;
  presetId?: 'konzervativny' | 'vyvazeny' | 'rastovy';
  profileSnapshot?: ProfileSnapshot;
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

/**
 * PR-23: Validate and sanitize V3 data (prevent localStorage poisoning)
 * 
 * Security limits:
 * - lumpSumEur ≤ 10M
 * - monthly ≤ 100k
 * - horizonYears: 1-50
 * - mix sum ≈ 100%
 */
function validateV3Data(data: V3): V3 {
  const validated = { ...data };
  let warnings: string[] = [];

  // 1. Validate lumpSumEur
  if (validated.profile?.lumpSumEur != null) {
    const lump = validated.profile.lumpSumEur;
    if (lump > 10_000_000) {
      warnings.push(`lumpSumEur exceeded 10M (${lump.toLocaleString()}), clamping to 10M`);
      validated.profile.lumpSumEur = 10_000_000;
    } else if (lump < 0) {
      warnings.push(`lumpSumEur negative (${lump}), resetting to 0`);
      validated.profile.lumpSumEur = 0;
    }
  }

  // 2. Validate monthly (top-level mirror for back-compat)
  if (typeof validated.monthly === 'number') {
    if (validated.monthly > 100_000) {
      warnings.push(`monthly exceeded 100k (${validated.monthly.toLocaleString()}), clamping to 100k`);
      validated.monthly = 100_000;
    } else if (validated.monthly < 0) {
      warnings.push(`monthly negative (${validated.monthly}), resetting to 0`);
      validated.monthly = 0;
    }
  }

  // 3. Validate horizonYears
  if (validated.profile?.horizonYears != null) {
    const horizon = validated.profile.horizonYears;
    if (horizon > 50) {
      warnings.push(`horizonYears exceeded 50 (${horizon}), clamping to 50`);
      validated.profile.horizonYears = 50;
    } else if (horizon < 1) {
      warnings.push(`horizonYears below 1 (${horizon}), resetting to 1`);
      validated.profile.horizonYears = 1;
    }
  }

  // 4. Validate mix sum (should be ≈100%)
  if (validated.mix && Array.isArray(validated.mix)) {
    const sum = validated.mix.reduce((acc, item) => acc + (item.pct || 0), 0);
    const diff = Math.abs(sum - 100);
    
    if (diff > 0.1) {
      warnings.push(`mix sum is ${sum.toFixed(2)}% (expected 100%), normalizing`);
      
      // Normalize to 100%
      if (sum > 0) {
        validated.mix = validated.mix.map(item => ({
          ...item,
          pct: Math.round((item.pct / sum) * 100 * 100) / 100
        }));
      } else {
        // Invalid mix (all zeros) - reset to safe default
        warnings.push('mix all zeros, resetting to default balanced mix');
        validated.mix = [
          { key: 'gold', pct: 12 },
          { key: 'dyn', pct: 20 },
          { key: 'etf', pct: 40 },
          { key: 'bonds', pct: 20 },
          { key: 'cash', pct: 8 },
        ];
      }
    }
  }

  // Log warnings if any
  if (warnings.length > 0) {
    console.warn('[v3] LocalStorage validation warnings:', warnings);
  }

  return validated;
}

export function readV3(): V3 {
  const raw = safeParse<V3>(localStorage.getItem(KEY_V3_COLON))
           ?? safeParse<V3>(localStorage.getItem(KEY_V3_UNDERSCORE))
           ?? {};
  
  // PR-23: Validate and sanitize data
  return validateV3Data(raw);
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
    if (p.agentRefCode)                      next.profile = { ...next.profile, agentRefCode: p.agentRefCode };
    // legacy alias mirrors (tests still read these)
    if (typeof p.reserveEur === 'number')    (next as any).current_reserve   = p.reserveEur;
    if (typeof p.reserveMonths === 'number') (next as any).emergency_months  = p.reserveMonths;
  }

  const json = JSON.stringify(next);
  try {
    localStorage.setItem(KEY_V3_COLON, json);
    localStorage.setItem(KEY_V3_UNDERSCORE, json);
  } catch {}
  
  // Emit event if mix changed (for event-based sync)
  if (patch.mix) {
    emitMixChangeEvent();
  }
  
  return next;
}
