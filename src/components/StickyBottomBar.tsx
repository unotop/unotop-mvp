/**
 * PR-7: StickyBottomBar - Fixed panel s prehľadom a CTA
 * 
 * Zobrazuje sa až po výbere profilu alebo manuálnom nastavení mixu (sum=100%).
 * Obsahuje: FV, výnos p.a., debt clear (ak existuje), súčet pilulka, profil pilulka,
 * CTA "Odoslať projekciu" + "Zmeniť mix".
 * 
 * Používa useProjection hook (PR-6) na live reaktivitu.
 */

import React from "react";
import { TEST_IDS } from "../testIds";
import { useProjection } from "../features/projection/useProjection";
import { readV3 } from "../persist/v3";
import { unlockMix } from "../features/mix/mix-lock";
import type { RiskPref } from "../features/mix/assetModel";
import type { MixItem } from "../features/mix/mix.service";

interface StickyBottomBarProps {
  mix: MixItem[];
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  goalAssetsEur: number;
  riskPref: RiskPref;
  onSubmitClick: () => void;
}

export const StickyBottomBar: React.FC<StickyBottomBarProps> = ({
  mix,
  lumpSumEur,
  monthlyVklad,
  horizonYears,
  goalAssetsEur,
  riskPref,
  onSubmitClick,
}) => {
  const v3 = readV3();
  const debts = v3.debts || [];

  // Viditeľnosť: zobraz až po výbere profilu alebo sum=100%
  const profileSelected = v3.profile?.selected;
  const mixSum = mix.reduce((sum, item) => sum + item.pct, 0);
  const isMixSet = Math.abs(mixSum - 100) < 0.01;
  const shouldShow = !!profileSelected || isMixSet;

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

  const {
    fvFinal,
    approxYield,
    crossoverIndex,
  } = projection;

  if (!shouldShow) return null;

  // Format FV
  const formatLargeNumber = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(2)} mld`;
    }
    if (absValue >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(2)} M`;
    }
    if (absValue >= 1_000) {
      return `${(value / 1_000).toFixed(0)} k`;
    }
    return value.toFixed(0);
  };

  // Debt clear date (ak existuje crossoverIndex)
  const debtClearDate = crossoverIndex !== null && debts.length > 0
    ? (() => {
        const now = new Date();
        const targetDate = new Date(now.getFullYear() + crossoverIndex, now.getMonth());
        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
        return `${yyyy}/${mm}`;
      })()
    : null;

  // Súčet pilulka color
  const sumDrift = Math.abs(mixSum - 100);
  const sumColor =
    sumDrift < 0.01
      ? "bg-emerald-800/40 ring-emerald-500/40 text-emerald-200"
      : sumDrift <= 1
        ? "bg-amber-800/40 ring-amber-500/40 text-amber-200"
        : "bg-red-800/40 ring-red-500/40 text-red-200";

  // Profil pilulka text
  const profileLabel = profileSelected
    ? {
        konzervativny: "Konzerv.",
        vyvazeny: "Vyváž.",
        rastovy: "Rast.",
      }[profileSelected as string] || "Manuál"
    : "Manuál";

  // Validácia pre submit (placeholder - bude rozšírené v Task 7)
  const canSubmit = lumpSumEur > 0 || monthlyVklad > 0;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[1000] bg-slate-900/95 backdrop-blur-sm border-t border-white/10 shadow-2xl"
      role="region"
      aria-label="Rýchly súhrn a odoslanie"
    >
      <div className="max-w-[1320px] mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Ľavá časť - metriky */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* FV */}
            <div className="flex items-center gap-2" data-testid={TEST_IDS.BBAR_FV}>
              <span className="text-slate-400">FV:</span>
              <span className="font-bold text-emerald-400 tabular-nums">
                {formatLargeNumber(fvFinal)} €
              </span>
            </div>

            {/* Výnos p.a. */}
            <div className="flex items-center gap-2" data-testid={TEST_IDS.BBAR_YIELD}>
              <span className="text-slate-400">Výnos p.a.:</span>
              <span className="font-bold text-blue-400 tabular-nums">
                {(approxYield * 100).toFixed(1)} %
              </span>
            </div>

            {/* Debt clear (voliteľné) */}
            {debtClearDate && (
              <div className="flex items-center gap-2" data-testid={TEST_IDS.BBAR_DEBT_CLEAR}>
                <span className="text-slate-400">Dlh – vyplatenie:</span>
                <span className="font-bold text-amber-400 tabular-nums">
                  {debtClearDate}
                </span>
              </div>
            )}

            {/* Súčet pilulka */}
            <div
              className={`px-2 py-1 rounded text-xs font-semibold ring-1 ${sumColor}`}
              data-testid={TEST_IDS.BBAR_SUM}
            >
              Súčet: {Math.round(mixSum)}%
            </div>

            {/* Profil pilulka */}
            <div
              className="px-2 py-1 rounded text-xs font-semibold bg-slate-800/60 ring-1 ring-slate-600/40 text-slate-300"
              data-testid={TEST_IDS.BBAR_PROFILE}
            >
              {profileLabel}
            </div>
          </div>

          {/* Pravá časť - CTA */}
          <div className="flex items-center gap-3">
            {/* Zmeniť mix (sekundárne) */}
            <button
              onClick={() => {
                unlockMix();
                // Scroll na portfolio selector (ak existuje)
                document.getElementById("portfolio-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
              data-testid={TEST_IDS.BBAR_CHANGE_MIX}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-700/40 hover:bg-slate-700/60 text-slate-200 ring-1 ring-slate-600/40 transition-colors"
            >
              Zmeniť mix
            </button>

            {/* Odoslať projekciu (primárne) */}
            <button
              onClick={onSubmitClick}
              disabled={!canSubmit}
              data-testid={TEST_IDS.BBAR_SUBMIT}
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
