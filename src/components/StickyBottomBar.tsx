/**
 * PR-8: StickyBottomBar - Fixed panel s prehľadom a CTA (reworked)
 *
 * Zobrazuje sa až po výbere profilu ALEBO manuálnom nastavení mixu (sum=100%).
 * Obsahuje: Očakávaný majetok, Ročný výnos, Vyplatenie úveru (ak debt),
 * Riziko (voliteľne), CTA "Odoslať projekciu".
 *
 * Používa useProjection hook (PR-6) na live reaktivitu.
 *
 * PR-8 Changes:
 * - Odstránené: "FV", "Súčet 100%", "Vyváž.", "Zmeniť mix"
 * - Pridané: Ľudské metriky, lock "Odoslať" ak nie je profil
 * - Gating: zobraz len ak profileSelected && mix.length > 0
 */

import React from "react";
import { TEST_IDS } from "../testIds";
import { useProjection } from "../features/projection/useProjection";
import { readV3 } from "../persist/v3";
import { unlockMix } from "../features/mix/mix-lock";
import type { RiskPref } from "../features/mix/assetModel";
import type { MixItem } from "../features/mix/mix.service";
// PR-27: Inflation helpers
import { toRealValue, toRealYield } from "../utils/inflation";

interface StickyBottomBarProps {
  mix: MixItem[];
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  goalAssetsEur: number;
  riskPref: RiskPref;
  onSubmitClick: () => void;
  hasDriftBlocking?: boolean; // PR-12: Blokuje odoslanie ak hasDrift && !autoOptimize
  valuationMode?: "real" | "nominal"; // PR-27: Inflation adjustment
}

export const StickyBottomBar: React.FC<StickyBottomBarProps> = ({
  mix,
  lumpSumEur,
  monthlyVklad,
  horizonYears,
  goalAssetsEur,
  riskPref,
  onSubmitClick,
  hasDriftBlocking = false, // Default false
  valuationMode = "real", // PR-27: Default to real (po inflácii)
}) => {
  const v3 = readV3();
  const debts = v3.debts || [];

  // PR-8: Gating - zobraz až po výbere profilu ALEBO sum=100%
  const profileSelected = v3.profile?.selected;
  const mixSum = mix.reduce((sum, item) => sum + item.pct, 0);
  const isMixSet = Math.abs(mixSum - 100) < 0.01;

  // ZMENA: Teraz je vyžadovaný profil + mix (nie OR)
  const shouldShow = !!profileSelected && mix.length > 0;

  if (!shouldShow) return null; // PR-8: Gating

  // useProjection hook (PR-6) pre live reaktivitu
  const projection = useProjection({
    lumpSumEur,
    monthlyVklad,
    horizonYears,
    goalAssetsEur,
    mix,
    debts,
    riskPref,
  });

  const { fvFinal, approxYield, crossoverIndex, riskScore } = projection;

  // PR-27: Transformácia podľa valuationMode
  const displayFV =
    valuationMode === "real" ? toRealValue(fvFinal, horizonYears) : fvFinal;
  const displayYield =
    valuationMode === "real" ? toRealYield(approxYield) : approxYield;

  // PR-8: Helper pre formátovanie majetku (Očakávaný majetok)
  const formatWealth = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(2)} M €`;
    }
    if (absValue >= 1_000) {
      return `${(value / 1_000).toFixed(0)} k €`;
    }
    return `${value.toFixed(0)} €`;
  };

  // PR-13 Fix: Crossover = kedy investície >= dlhy (možnosť predčasného splatenia)
  const earlyPayoffDate =
    crossoverIndex !== null && debts.length > 0
      ? (() => {
          const now = new Date();
          const targetYear = now.getFullYear() + crossoverIndex;
          return `${targetYear}`;
        })()
      : null;

  // PR-10 Task E: Riziko z useProjection (nie lokálny výpočet)
  // riskScore už je v projection.riskScore

  // PR-8: Submit gating - vyžaduje profil + aspoň jeden input
  // PR-12: Pridané drift blocking
  const canSubmit =
    !!profileSelected &&
    (lumpSumEur > 0 || monthlyVklad > 0) &&
    !hasDriftBlocking;

  return (
    <div
      className="sticky-bottom-bar fixed bottom-0 left-0 right-0 z-[1000] bg-slate-900/95 backdrop-blur-sm border-t border-white/10 shadow-2xl"
      role="region"
      aria-label="Rýchly súhrn a odoslanie"
    >
      <div className="max-w-[1320px] mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* PR-8: Ľavá časť - human-readable metriky */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* Očakávaný majetok */}
            <div
              className="flex items-center gap-2"
              data-testid={TEST_IDS.BB_WEALTH}
            >
              <span className="text-slate-400">Očakávaný majetok:</span>
              <span className="font-bold text-emerald-400 tabular-nums">
                {formatWealth(displayFV)}
              </span>
            </div>

            {/* Ročný výnos (odhad) */}
            <div
              className="flex items-center gap-2"
              data-testid={TEST_IDS.BB_YIELD}
            >
              <span className="text-slate-400">Ročný výnos:</span>
              <span className="font-bold text-blue-400 tabular-nums">
                +
                {displayYield != null && !isNaN(displayYield)
                  ? (displayYield * 100).toFixed(1)
                  : "0.0"}{" "}
                %
              </span>
            </div>

            {/* Predčasné vyplatenie úverov (voliteľné) */}
            {earlyPayoffDate && (
              <div
                className="flex items-center gap-2"
                data-testid={TEST_IDS.BB_DEBT_CLEAR}
              >
                <span className="text-slate-400">
                  Predčasné vyplatenie úverov:
                </span>
                <span className="font-bold text-amber-400 tabular-nums">
                  {earlyPayoffDate}
                </span>
              </div>
            )}

            {/* Riziko (voliteľné, ak je priestor) */}
            <div
              className="hidden sm:flex items-center gap-2"
              data-testid={TEST_IDS.BB_RISK}
            >
              <span className="text-slate-400">Riziko:</span>
              <span className="font-bold text-slate-300 tabular-nums">
                {riskScore != null && !isNaN(riskScore)
                  ? riskScore.toFixed(1)
                  : "0.0"}{" "}
                / 10
              </span>
            </div>
          </div>

          {/* PR-8: Pravá časť - len Odoslať projekciu (Zmeniť mix odstránené) */}
          <div className="flex items-center gap-3">
            {/* Odoslať projekciu (primárne) */}
            <button
              onClick={onSubmitClick}
              disabled={!canSubmit}
              data-testid={TEST_IDS.BB_SUBMIT}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white ring-1 ring-emerald-500/40 disabled:ring-slate-600/40 transition-colors"
            >
              Odoslať projekciu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
