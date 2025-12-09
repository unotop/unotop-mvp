/**
 * portfolioEngine.ts
 * 
 * SINGLE SOURCE OF TRUTH pre všetky portfolio výpočty.
 * Všetky UI komponenty MUSIA používať computePortfolioFromInputs().
 * 
 * Žiadne bokom volania getAdjustedMix() alebo approxYieldAnnualFromMix().
 * 
 * P0 HYBRID STRATEGY:
 * - Memoization/cache pre stabilitu (žiadne oscilácie v UI)
 * - getAdjustedMix() môže byť ne-idempotentný (fix v P1)
 * - Používa sa SINGLE PASS cez engine (nie opakované volania)
 */

import type { MixItem } from '../mix/mix.service';
import { getAdjustedMix } from './mixAdjustments';
import { approxYieldAnnualFromMix, riskScore0to10 } from '../mix/assetModel';
import { RISK_MAX_PER_BAND } from "../policy/risk"; // P1.5: Import z risk.ts

// ──────────────────────────────────────────────────────────────────────────────
// CACHE / MEMOIZATION
// ──────────────────────────────────────────────────────────────────────────────

interface CacheKey {
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  reserveEur: number;
  reserveMonths: number;
  riskPref: RiskPref;
}

interface CacheEntry {
  timestamp: number;
  result: PortfolioOutput;
}

const CACHE_TTL = 5000; // 5s (UI re-render nerobí nový výpočet ak inputs rovnaké)
const portfolioCache = new Map<string, CacheEntry>();

/**
 * Vytvor hash key z inputs pre cache lookup
 */
function getCacheKey(inputs: PortfolioInputs): string {
  const key: CacheKey = {
    lumpSumEur: inputs.lumpSumEur || 0,
    monthlyVklad: inputs.monthlyVklad || 0,
    horizonYears: inputs.horizonYears || 0,
    reserveEur: inputs.reserveEur || 0,
    reserveMonths: inputs.reserveMonths || 0,
    riskPref: inputs.riskPref || 'vyvazeny',
  };
  return JSON.stringify(key);
}

/**
 * Vyčisti staré cache entries (TTL expired)
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of portfolioCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      portfolioCache.delete(key);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// TYPY
// ──────────────────────────────────────────────────────────────────────────────

export type RiskPref = 'konzervativny' | 'vyvazeny' | 'rastovy';
export type VolumeBand = 'STARTER' | 'CORE' | 'PREMIUM';

export interface PortfolioInputs {
  lumpSumEur?: number;
  monthlyVklad?: number;
  horizonYears?: number;
  reserveEur?: number;
  reserveMonths?: number;
  /** Ak je undefined → default 'vyvazeny' */
  riskPref?: RiskPref;
  /** Ak je undefined → použije preset mix pre daný profil */
  baseMix?: MixItem[];
}

export type WarningLevel = 'INFO' | 'CRITICAL' | 'ERROR';

export interface PortfolioWarning {
  level: WarningLevel;
  message: string;
  code?: string; // napr. 'RISK_OVERSHOOT_MINOR'
}

export interface PortfolioOutput {
  /** Finálny mix po všetkých úpravách */
  mix: MixItem[];
  /** Očakávaný ročný výnos (%) */
  yieldPa: number;
  /** Riziko 0-10 */
  riskScore: number;
  /** Volume band pre tento plán */
  volumeBand: VolumeBand;
  /** Efektívny risk max pre tento profil + band */
  effectiveRiskMax: number;
  /** Varovania (ak sú) */
  warnings: PortfolioWarning[];
}

// ──────────────────────────────────────────────────────────────────────────────
// KONŠTANTY
// ──────────────────────────────────────────────────────────────────────────────

/** Hard risk pásma pre profily (invariant) */
export const RISK_BANDS: Record<RiskPref, { min: number; max: number }> = {
  konzervativny: { min: 3.0, max: 5.0 },
  vyvazeny: { min: 5.0, max: 7.0 },
  rastovy: { min: 7.0, max: 9.0 },
};

/** Preset mixes pre každý profil (fallback) */
const PRESET_MIXES: Record<RiskPref, MixItem[]> = {
  konzervativny: [
    { key: 'gold', pct: 20 },
    { key: 'dyn', pct: 0 },
    { key: 'etf', pct: 25 },
    { key: 'bonds', pct: 35 },
    { key: 'cash', pct: 15 },
    { key: 'crypto', pct: 0 },
    { key: 'real', pct: 5 },
  ],
  vyvazeny: [
    { key: 'gold', pct: 15 },
    { key: 'dyn', pct: 10 },
    { key: 'etf', pct: 45 },
    { key: 'bonds', pct: 20 },
    { key: 'cash', pct: 5 },
    { key: 'crypto', pct: 2 },
    { key: 'real', pct: 3 },
  ],
  rastovy: [
    { key: 'gold', pct: 12 },
    { key: 'dyn', pct: 20 },
    { key: 'etf', pct: 50 },
    { key: 'bonds', pct: 10 },
    { key: 'cash', pct: 3 },
    { key: 'crypto', pct: 2 },
    { key: 'real', pct: 3 },
  ],
};

/** Emergency safe mixes (pre FATAL errors) */
const EMERGENCY_SAFE_MIX: MixItem[] = [
  { key: 'gold', pct: 20 },
  { key: 'dyn', pct: 0 },
  { key: 'etf', pct: 30 },
  { key: 'bonds', pct: 40 },
  { key: 'cash', pct: 10 },
  { key: 'crypto', pct: 0 },
  { key: 'real', pct: 0 },
];

// ──────────────────────────────────────────────────────────────────────────────
// HELPER FUNKCIE
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Vypočíta volume band podľa celkového objemu investície
 */
function getVolumeBand(inputs: PortfolioInputs): VolumeBand {
  const lump = inputs.lumpSumEur || 0;
  const monthly = inputs.monthlyVklad || 0;
  const horizon = inputs.horizonYears || 0;

  const totalVolume = lump + monthly * 12 * horizon;

  if (totalVolume < 50_000) return 'STARTER';
  if (totalVolume < 100_000) return 'CORE';
  return 'PREMIUM';
}

/**
 * Vráti efektívny risk max pre daný profil a band
 */
function getEffectiveRiskMax(riskPref: RiskPref, band: VolumeBand): number {
  return RISK_MAX_PER_BAND[band][riskPref];
}

/**
 * Validuje či risk score je v hard pásme pre profil
 * Tolerance: ±0.5 (minor overshoot)
 */
function validateRiskBand(
  risk: number,
  riskPref: RiskPref,
  band: VolumeBand
): PortfolioWarning[] {
  const warnings: PortfolioWarning[] = [];
  const { min, max } = RISK_BANDS[riskPref];
  const effectiveMax = getEffectiveRiskMax(riskPref, band);

  // Check dolná hranica (hard)
  if (risk < min - 0.5) {
    warnings.push({
      level: 'CRITICAL',
      message: `Riziko ${risk.toFixed(1)} je príliš nízke pre profil ${riskPref} (min ${min})`,
      code: 'RISK_UNDERSHOT',
    });
  } else if (risk < min) {
    warnings.push({
      level: 'INFO',
      message: `Riziko ${risk.toFixed(1)} je mierne pod pásmom ${riskPref} (min ${min})`,
      code: 'RISK_UNDERSHOT_MINOR',
    });
  }

  // Check horná hranica (hard base max + VIP headroom)
  // P1.5 FIX: Rôzna tolerancia pre Growth vs ostatné (Growth ±1.0, iné ±0.5)
  // Dôvod: yieldOptimizer headroom +0.5 → Growth môže dosiahnuť 9.0, fallback je zbytočný
  const criticalTolerance = riskPref === 'rastovy' ? 1.0 : 0.5;
  
  if (risk > effectiveMax + criticalTolerance) {
    warnings.push({
      level: 'CRITICAL',
      message: `Riziko ${risk.toFixed(1)} prekročilo limit pre ${riskPref} (max ${effectiveMax})`,
      code: 'RISK_OVERSHOOT_MAJOR',
    });
  } else if (risk > effectiveMax) {
    warnings.push({
      level: 'INFO',
      message: `Riziko ${risk.toFixed(1)} je mierne nad limitom ${effectiveMax}`,
      code: 'RISK_OVERSHOOT_MINOR',
    });
  }

  // VIP optimization badge (ak je Premium a risk > base max)
  if (band === 'PREMIUM' && riskPref === 'rastovy' && risk > RISK_BANDS.rastovy.max) {
    warnings.push({
      level: 'INFO',
      message: `⚡ VIP optimalizácia: využívate zvýšený risk headroom (${risk.toFixed(1)} > ${RISK_BANDS.rastovy.max})`,
      code: 'VIP_OPTIMIZATION',
    });
  }

  return warnings;
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN ENGINE
// ──────────────────────────────────────────────────────────────────────────────

/**
 * SINGLE SOURCE OF TRUTH – jediný entry point pre všetky portfolio výpočty.
 * 
 * P0 HYBRID: Cache/memoization pre stabilitu. Ak inputs rovnaké → vráť cached result.
 * 
 * @param inputs - Vstupné parametre (lump sum, monthly, horizon, profil...)
 * @returns Finálny mix + metriky + warnings
 * 
 * @example
 * const result = computePortfolioFromInputs({
 *   lumpSumEur: 10000,
 *   monthlyVklad: 500,
 *   horizonYears: 20,
 *   riskPref: 'rastovy'
 * });
 * 
 * console.log(result.mix, result.yieldPa, result.riskScore);
 */
export function computePortfolioFromInputs(inputs: PortfolioInputs): PortfolioOutput {
  // STEP 0: Check cache (pre stabilitu v UI - žiadne oscilácie)
  const cacheKey = getCacheKey(inputs);
  const cached = portfolioCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // console.log('[PortfolioEngine] Cache HIT:', cacheKey.substring(0, 50));
    return cached.result;
  }

  // Cleanup old entries
  cleanupCache();

  const warnings: PortfolioWarning[] = [];

  // Default profil ak nie je zadaný
  const riskPref = inputs.riskPref || 'vyvazeny';

  // Volume band
  const volumeBand = getVolumeBand(inputs);
  const effectiveRiskMax = getEffectiveRiskMax(riskPref, volumeBand);

  try {
    // 1. Zober base mix (preset alebo z inputu)
    const baseMix = inputs.baseMix || PRESET_MIXES[riskPref];

    // 2. Priprav profile objekt pre getAdjustedMix (ProfileForAdjustments interface)
    const profile = {
      riskPref,
      lumpSumEur: inputs.lumpSumEur || 0,
      monthlyEur: inputs.monthlyVklad || 0, // Note: monthlyEur, nie monthlyVklad
      horizonYears: inputs.horizonYears || 0,
      reserveEur: inputs.reserveEur || 0,
      reserveMonths: inputs.reserveMonths || 0,
      // Potrebné pre reserve calculation
      monthlyIncome: 0, // Default (nie je kritické pre testy)
      fixedExpenses: 0,
      variableExpenses: 0,
      // Goal pre stage detection
      goalAssetsEur: 100_000, // Default goal
    };

    // 3. Spusti adjustment pipeline
    const adjusted = getAdjustedMix(baseMix, profile);
    const finalMix = adjusted.mix;

    // 4. Vypočítaj metriky (BEZ planStrength multiplikátora!)
    const yieldPa = approxYieldAnnualFromMix(finalMix);
    const riskScore = riskScore0to10(finalMix);

    // 5. Validuj risk bands
    const riskWarnings = validateRiskBand(riskScore, riskPref, volumeBand);
    warnings.push(...riskWarnings);

    // 6. Graceful fallback ak MAJOR overshoot
    const majorOvershoot = warnings.find(w => w.code === 'RISK_OVERSHOOT_MAJOR');
    if (majorOvershoot) {
      // Použij konzervatívnejší mix z PRESET_MIXES
      const fallbackProfile = riskPref === 'rastovy' ? 'vyvazeny' : 'konzervativny';
      const fallbackMix = PRESET_MIXES[fallbackProfile];

      warnings.push({
        level: 'CRITICAL',
        message: `Použitý fallback mix (${fallbackProfile}) kvôli vysokému riziku`,
        code: 'FALLBACK_APPLIED',
      });

      return {
        mix: fallbackMix,
        yieldPa: approxYieldAnnualFromMix(fallbackMix),
        riskScore: riskScore0to10(fallbackMix),
        volumeBand,
        effectiveRiskMax,
        warnings,
      };
    }

    // 7. Normálny return + cache
    const result: PortfolioOutput = {
      mix: finalMix,
      yieldPa,
      riskScore,
      volumeBand,
      effectiveRiskMax,
      warnings,
    };

    // Cache result pre budúce volania
    portfolioCache.set(cacheKey, {
      timestamp: Date.now(),
      result,
    });

    return result;
  } catch (error) {
    // FATAL error → safe conservative mix
    console.error('FATAL error in computePortfolioFromInputs:', error);

    warnings.push({
      level: 'ERROR',
      message: `Kritická chyba pri výpočte portfólia. Použitý bezpečný konzervatívny mix.`,
      code: 'FATAL_ERROR',
    });

    const fallbackResult: PortfolioOutput = {
      mix: EMERGENCY_SAFE_MIX,
      yieldPa: approxYieldAnnualFromMix(EMERGENCY_SAFE_MIX),
      riskScore: riskScore0to10(EMERGENCY_SAFE_MIX),
      volumeBand,
      effectiveRiskMax: 5.0,
      warnings,
    };

    // Cache aj fallback (zabráni opakovaným error calls)
    portfolioCache.set(cacheKey, {
      timestamp: Date.now(),
      result: fallbackResult,
    });

    return fallbackResult;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// EXPORT HELPERS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Helper pre porovnanie profilov (používa PRESET mixes bez adjustmentu)
 */
export function getPresetMix(riskPref: RiskPref): MixItem[] {
  return PRESET_MIXES[riskPref];
}

/**
 * Helper pre získanie volume band z inputov (bez výpočtu celého portfólia)
 */
export { getVolumeBand };
