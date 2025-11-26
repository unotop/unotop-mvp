/**
 * Apply Asset Minimums - Presunie nedostupné aktíva do fallback buckets
 * 
 * PR-12: Jednoduchý fallback bez blokovania výberu
 * PR-13: Risk-aware fallback pre konzervativny profil
 */

import type { MixItem } from "../mix/mix.service";
import type { RiskPref } from "../mix/assetModel";
import { normalize } from "../mix/mix.service";
import {
  ASSET_MINIMUMS,
  FALLBACKS,
  CONSERVATIVE_FALLBACKS,
  isAssetAvailable,
  type AssetAvailabilityProfile,
} from "./assetMinimums";
import { WarningCenter } from "../ui/warnings/WarningCenter";

export interface MinimumAdjustmentResult {
  mix: MixItem[];
  adjustments: Array<{
    asset: string;
    pctMoved: number;
    targets: Array<{ asset: string; pct: number }>;
  }>;
}

/**
 * Aplikuj minimumy aktív - presunie nedostupné % do ETF/cash alebo gold/cash
 * 
 * PR-13: Risk-aware fallback pre konzervativny profil
 * 
 * @param baseMix - Vstupný mix (po reality filtri, pred stage capmi)
 * @param profile - Profil používateľa
 * @param riskPref - Rizikový profil (pre výber fallback stratégie)
 * @returns Upravený mix + info o presunoch
 */
export function applyMinimums(
  baseMix: MixItem[],
  profile: AssetAvailabilityProfile,
  riskPref: RiskPref = "vyvazeny"
): MinimumAdjustmentResult {
  let mix = [...baseMix];
  const adjustments: MinimumAdjustmentResult["adjustments"] = [];

  // PR-13: Vyber fallback stratégiu podľa risk profilu
  const fallbackMap = riskPref === "konzervativny" ? CONSERVATIVE_FALLBACKS : FALLBACKS;

  // Helper: získaj pct aktíva
  const getPct = (key: MixItem["key"]): number =>
    mix.find((m) => m.key === key)?.pct ?? 0;

  // Helper: nastav pct aktíva
  const setPct = (key: MixItem["key"], val: number) => {
    const idx = mix.findIndex((m) => m.key === key);
    if (idx !== -1) {
      mix[idx] = { ...mix[idx], pct: Math.max(0, Math.min(100, val)) };
    }
  };

  // Prejdi všetky aktíva
  for (const item of mix) {
    // Preskočiť, ak je % nulové
    if (item.pct === 0) continue;

    // Preskočiť, ak je aktívum dostupné
    if (isAssetAvailable(item.key as keyof typeof ASSET_MINIMUMS, profile)) {
      continue;
    }

    // Aktívum nie je dostupné → presunúť do fallback
    const fallback = fallbackMap[item.key];
    if (!fallback) {
      // Žiadny fallback definovaný (napr. etf, cash)
      continue;
    }

    const pctToMove = item.pct;
    const targets: Array<{ asset: string; pct: number }> = [];

    // Rozdeľ podľa fallback ratios
    for (const [targetKey, ratio] of fallback) {
      const targetPct = (pctToMove * ratio) / 100;
      const currentPct = getPct(targetKey);
      setPct(targetKey, currentPct + targetPct);
      targets.push({ asset: targetKey, pct: targetPct });
    }

    // Vynuluj pôvodné aktívum
    setPct(item.key, 0);

    // Zaznamenaj adjustment
    adjustments.push({
      asset: item.key,
      pctMoved: pctToMove,
      targets,
    });

    // Emit warning do WarningCenter (info chip)
    const assetLabel = getAssetLabel(item.key);
    const targetLabels = targets.map((t) => getAssetLabel(t.asset)).join(", ");
    const minInfo = ASSET_MINIMUMS[item.key as keyof typeof ASSET_MINIMUMS];

    let message = `${assetLabel} nedostupné pri vašich vkladoch`;
    if (minInfo.lumpMin > 0 && minInfo.monthlyMin === 0) {
      message += ` (min. ${minInfo.lumpMin.toLocaleString("sk-SK")} € jednorazovo)`;
    } else if (minInfo.monthlyMin > 0) {
      message += ` (min. ${minInfo.monthlyMin} €/mesiac)`;
    }
    message += `. Alokácia presunutá: ${targetLabels}.`;

    WarningCenter.push({
      type: "info",
      message,
      scope: "minimums",
      dedupeKey: `minimum-${item.key}`,
    });
  }

  // Normalize na presne 100%
  const normalized = normalize(mix);

  return {
    mix: normalized,
    adjustments,
  };
}

/**
 * Helper: Získaj label aktíva pre UI
 */
function getAssetLabel(key: string): string {
  const labels: Record<string, string> = {
    gold: "Zlato",
    etf: "ETF",
    bonds: "Dlhopisy",
    bond3y9: "Dlhopisy 3-9r",
    dyn: "Dynamické riadenie",
    cash: "Pracujúca rezerva – IAD DK",
    crypto: "Krypto",
    real: "Reality",
  };
  return labels[key] || key;
}
