/**
 * RecalculateProfileChip - PR-12 Lazy Reapply
 *
 * Zobrazuje sa keď:
 * - mixOrigin === 'presetAdjusted'
 * - hasDrift === true (vstupy sa výrazne zmenili)
 *
 * CTA: Prepočítať profil → reaplikuje getAdjustedPreset() s novými vstupmi
 */

import React from "react";
import {
  PORTFOLIO_PRESETS,
  getAdjustedPreset,
  type ProfileForAdjustments,
} from "../features/portfolio/presets";
import { readV3, writeV3 } from "../persist/v3";
import { emitMixChangeEvent } from "../persist/mixEvents";
import { WarningCenter } from "../features/ui/warnings/WarningCenter";

interface RecalculateProfileChipProps {
  driftFields: string[]; // Ktoré polia driftujú ['lumpSum', 'monthly', 'horizon']
  presetId: "konzervativny" | "vyvazeny" | "rastovy";
  onReapplied?: () => void; // Callback po úspechu
}

const DRIFT_LABELS: Record<string, string> = {
  lumpSum: "jednorazový vklad",
  monthly: "mesačný vklad",
  horizon: "horizont",
};

const PROFILE_LABELS: Record<string, string> = {
  konzervativny: "Konzervatívny",
  vyvazeny: "Vyvážený",
  rastovy: "Rastový",
};

export function RecalculateProfileChip({
  driftFields,
  presetId,
  onReapplied,
}: RecalculateProfileChipProps) {
  const [isRecalculating, setIsRecalculating] = React.useState(false);

  const handleReapply = async () => {
    setIsRecalculating(true);

    // Debounce loading state (400-600ms)
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const v3 = readV3();
      const profile = v3.profile || {};

      // Fresh read aktuálnych vstupov
      const profileForAdj: ProfileForAdjustments = {
        lumpSumEur: profile.lumpSumEur || 0,
        monthlyEur: (v3 as any).monthly || 0,
        horizonYears: profile.horizonYears || 10,
        monthlyIncome: profile.monthlyIncome || 0,
        fixedExpenses: profile.fixedExp || 0,
        variableExpenses: profile.varExp || 0,
        reserveEur: profile.reserveEur || 0,
        reserveMonths: profile.reserveMonths || 0,
        goalAssetsEur: profile.goalAssetsEur || 0,
        riskPref: presetId,
      };

      // Nájdi preset
      const preset = PORTFOLIO_PRESETS.find((p) => p.id === presetId);
      if (!preset) {
        console.error("[RecalculateChip] Preset not found:", presetId);
        return;
      }

      // Aplikuj adjustments s novými vstupmi
      const { preset: adjusted, warnings } = getAdjustedPreset(
        preset,
        profileForAdj
      );

      // Zapíš mix + update snapshot
      writeV3({
        mix: adjusted.mix,
        mixOrigin: "presetAdjusted",
        presetId,
        profileSnapshot: {
          lumpSum: profileForAdj.lumpSumEur,
          monthly: profileForAdj.monthlyEur,
          horizon: profileForAdj.horizonYears,
          ts: Date.now(),
        },
      });

      // Trigger mix change event (aby sa chip refresh a zmiznul)
      emitMixChangeEvent();

      // Toast úspech
      WarningCenter.push({
        type: "info",
        message: "✅ Mix prispôsobený – výnos a riziko aktualizované.",
        scope: "global",
        dedupeKey: "mix-reapplied",
      });

      // Callback
      onReapplied?.();
    } catch (err) {
      console.error("[RecalculateChip] Error:", err);
      WarningCenter.push({
        type: "error",
        message: "Chyba pri prepočítaní profilu.",
        scope: "global",
        dedupeKey: "mix-reapply-error",
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const driftLabels = driftFields.map((f) => DRIFT_LABELS[f] || f).join(", ");
  const profileLabel = PROFILE_LABELS[presetId] || presetId;

  return (
    <div className="p-3 rounded-lg bg-amber-900/20 ring-1 ring-amber-500/30">
      <div className="flex items-start gap-3">
        <span className="text-amber-400 text-xl flex-shrink-0">⚠️</span>
        <div className="flex-1">
          <div className="font-medium text-amber-400 mb-1">
            Profil vyžaduje prepočítanie
          </div>
          <div className="text-sm text-slate-300 mb-3">
            Investičné vstupy sa výrazne zmenili.
            {driftLabels && (
              <span className="block text-xs text-slate-400 mt-1">
                Zmenené: {driftLabels}
              </span>
            )}
            Pre optimálny mix a presný výnos kliknite:
          </div>
          <button
            onClick={handleReapply}
            disabled={isRecalculating}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 
                       disabled:opacity-50 disabled:cursor-not-allowed
                       text-slate-900 font-medium text-sm transition-colors"
          >
            {isRecalculating
              ? "⏳ Prepočítavam..."
              : `Prepočítať profil ${profileLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}
