/**
 * Asset Availability Logic (PR-36+)
 * 
 * Zdroj pravdy: finálne mixy z getAdjustedMix pre všetky 3 profily.
 * Guardrails: malé vklady lockujú high-end assets (dyn, crypto, reality).
 */

import type { MixItem } from "../mix/mix.service";
import type { RiskPref } from "../mix/assetModel";
import { getAdjustedMix, type ProfileForAdjustments } from "../portfolio/mixAdjustments";
import { ASSET_MINIMA } from "../portfolio/assetMinima";
import { PORTFOLIO_PRESETS } from "../portfolio/presets";
import type { AssetStatus } from "./AssetPill";

export interface AssetAvailabilityInfo {
  key: string;
  label: string;
  status: AssetStatus;
  maxPct: number; // Max % across all 3 profiles
  minVolume: number; // Minimálna suma z ASSET_MINIMA
}

const ASSET_LABELS: Record<string, string> = {
  gold: "Zlato",
  etf: "ETF",
  dyn: "Dynamické riadenie",
  bonds: "Dlhopisy 7.5%",
  bond3y9: "Dlhopisy 3–9r",
  crypto: "Krypto",
  real: "Reality",
  cash: "IAD depozitné konto",
};

const ASSET_ORDER = ["gold", "etf", "dyn", "bonds", "bond3y9", "crypto", "real", "cash"];

/**
 * Guardrail: Malé vklady lockujú high-end assets
 * 
 * @param effectivePlanVolume - lumpSum + 12 × monthly × horizonYears
 * @returns Set<string> locked asset keys
 */
function getSmallPlanLocks(effectivePlanVolume: number): Set<string> {
  const locks = new Set<string>();

  // Ak < 1000 € → dyn, crypto, reality LOCKED
  if (effectivePlanVolume < 1_000) {
    locks.add("dyn");
    locks.add("crypto");
    locks.add("real");
  }

  // Ak < 2500 € → bonds nedostupné (už v ASSET_MINIMA, ale double-check)
  if (effectivePlanVolume < 2_500) {
    locks.add("bonds");
  }

  // Reality už má minumum 50k v ASSET_MINIMA
  if (effectivePlanVolume < 50_000) {
    locks.add("real");
  }

  return locks;
}

/**
 * Získaj asset availability z reálneho mixu (aktuálny profil)
 * 
 * @param lumpSum - Jednorazová investícia (EUR)
 * @param monthly - Mesačný vklad (EUR)
 * @param horizonYears - Investičný horizont (roky)
 * @param goalAssetsEur - Cieľ majetku (EUR)
 * @param effectivePlanVolume - lumpSum + 12 × monthly × horizonYears
 * @param currentRiskPref - Aktuálny rizikový profil používateľa
 * @returns AssetAvailabilityInfo[]
 */
export function getAssetAvailabilityFromMixes(
  lumpSum: number,
  monthly: number,
  horizonYears: number,
  goalAssetsEur: number,
  effectivePlanVolume: number,
  currentRiskPref: RiskPref
): AssetAvailabilityInfo[] {
  const smallPlanLocks = getSmallPlanLocks(effectivePlanVolume);

  // Dummy cashflow pre ProfileForAdjustments (nie sú kritické pre mixy)
  const dummyCashflow = {
    monthlyIncome: 3000,
    fixedExpenses: 1500,
    variableExpenses: 500,
    reserveEur: 5000,
    reserveMonths: 6,
  };

  // Vypočítaj mix pre aktuálny profil
  const profile: ProfileForAdjustments = {
    lumpSumEur: lumpSum,
    monthlyEur: monthly,
    horizonYears,
    goalAssetsEur,
    riskPref: currentRiskPref,
    ...dummyCashflow,
  };

  // Base mix z PORTFOLIO_PRESETS (správne východiskové hodnoty)
  const preset = PORTFOLIO_PRESETS.find((p) => p.id === currentRiskPref);
  const baseMix: MixItem[] = preset
    ? preset.mix.map((item) => ({ ...item })) // Deep copy
    : [
        { key: "gold" as const, pct: 12 },
        { key: "etf" as const, pct: 40 },
        { key: "bonds" as const, pct: 20 },
        { key: "cash" as const, pct: 10 },
      ];

  const adjustedMix = getAdjustedMix(baseMix, profile);
  const currentMix = adjustedMix.mix;

  // Spočítaj % pre každý asset z AKTUÁLNEHO mixu
  const assetCurrentPct: Record<string, number> = {};

  for (const assetKey of ASSET_ORDER) {
    const item = currentMix.find((m) => m.key === assetKey);
    assetCurrentPct[assetKey] = item ? item.pct : 0;
  }

  // Vytvor AssetAvailabilityInfo pre každý asset
  const result: AssetAvailabilityInfo[] = [];

  for (const assetKey of ASSET_ORDER) {
    if (!ASSET_LABELS[assetKey]) continue; // Skip neznáme assets

    const currentPct = assetCurrentPct[assetKey] || 0;
    const minVolume = ASSET_MINIMA[assetKey] || 0;

    let status: AssetStatus;

    if (smallPlanLocks.has(assetKey)) {
      // Guardrail: malé vklady
      status = "locked";
    } else if (effectivePlanVolume < minVolume) {
      // ASSET_MINIMA policy
      status = "locked";
    } else if (currentPct > 0) {
      // Používa sa v aktuálnom profile
      status = "active";
    } else {
      // Dostupný, ale nepoužitý v aktuálnom profile
      status = "available";
    }

    result.push({
      key: assetKey,
      label: ASSET_LABELS[assetKey],
      status,
      maxPct: currentPct, // Aktuálne % v profile (nie max across all)
      minVolume,
    });
  }

  return result;
}
