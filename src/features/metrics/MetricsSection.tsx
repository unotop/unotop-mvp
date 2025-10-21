import React from "react";
import { readV3 } from "../../persist/v3";
import { createMixListener } from "../../persist/mixEvents";
import type { MixItem } from "../mix/mix.service";
import { RiskGauge } from "../../components/RiskGauge";
import {
  approxYieldAnnualFromMix,
  riskScore0to10,
  getRiskCap,
  type RiskPref,
} from "../mix/assetModel";

interface MetricsSectionProps {
  riskPref: string;
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  goalAssetsEur: number;
}

/**
 * Vypočítaj budúcu hodnotu s mesačnou kapitalizáciou
 * (zhodné s engine.ts)
 */
function calculateFutureValue(
  lump: number,
  monthly: number,
  years: number,
  annualRate: number
): number {
  if (years <= 0) return lump;

  const months = Math.round(years * 12);
  // Mesačná sadzba: (1 + r_annual)^(1/12) - 1
  const rMonthly = annualRate > 0 ? Math.pow(1 + annualRate, 1 / 12) - 1 : 0;

  let V = lump;
  for (let t = 1; t <= months; t++) {
    V = (V + monthly) * (1 + rMonthly);
  }

  return V;
}

export function MetricsSection({
  riskPref,
  lumpSumEur,
  monthlyVklad,
  horizonYears,
  goalAssetsEur,
}: MetricsSectionProps) {
  // Reactive state for mix - syncs from localStorage
  const [mix, setMix] = React.useState<MixItem[]>(() => {
    const v3Data = readV3();
    return (v3Data.mix as any) || [];
  });

  // Event-based sync: listen to mix changes (replaces 500ms polling)
  React.useEffect(() => {
    // Initial sync
    const v3Data = readV3();
    const initialMix = (v3Data.mix as any) || [];
    if (JSON.stringify(initialMix) !== JSON.stringify(mix)) {
      setMix(initialMix);
    }

    // Listen to changes
    return createMixListener((newMix) => {
      if (JSON.stringify(newMix) !== JSON.stringify(mix)) {
        setMix(newMix);
      }
    });
  }, [mix]);

  // Validate riskPref and use assetModel functions
  const validRiskPref: RiskPref =
    riskPref === "konzervativny" || riskPref === "rastovy"
      ? (riskPref as RiskPref)
      : "vyvazeny";

  const cap = getRiskCap(validRiskPref);
  const risk =
    Array.isArray(mix) && mix.length > 0
      ? riskScore0to10(mix, validRiskPref, 0)
      : 0;
  const approxYield =
    Array.isArray(mix) && mix.length > 0
      ? approxYieldAnnualFromMix(mix, validRiskPref)
      : 0.04;
  const fv = calculateFutureValue(
    lumpSumEur,
    monthlyVklad,
    horizonYears,
    approxYield
  );
  const progress = goalAssetsEur > 0 ? (fv / goalAssetsEur) * 100 : 0;

  return (
    <section
      id="sec5"
      role="region"
      aria-labelledby="sec5-title"
      className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5 transition-all duration-300"
    >
      <div className="space-y-4">
        {/* SVG Risk Gauge (prominentný, väčší) */}
        {Array.isArray(mix) && mix.length > 0 && (
          <div className="flex justify-center py-4">
            <RiskGauge value={risk} size="lg" />
          </div>
        )}

        {/* 3 Scorecards (horizontal layout) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Scorecard: Riziko */}
          <div className="p-3 rounded-lg bg-slate-800/50 ring-1 ring-white/5">
            <div className="text-xs text-slate-400 mb-1">Riziko (0–10)</div>
            <div className="text-lg font-bold tabular-nums">
              {!Array.isArray(mix) || mix.length === 0 ? (
                "– (mix nezadaný)"
              ) : (
                <>
                  {risk.toFixed(1)} / {cap.toFixed(1)}
                  {risk > cap && (
                    <span className="ml-2 text-amber-500">⚠️</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Scorecard: Výnos/rok */}
          <div className="p-3 rounded-lg bg-slate-800/50 ring-1 ring-white/5">
            <div className="text-xs text-slate-400 mb-1">Výnos/rok (odhad)</div>
            <div className="text-lg font-bold tabular-nums">
              {!Array.isArray(mix) || mix.length === 0
                ? "– (mix nezadaný)"
                : `${(approxYield * 100).toFixed(1)} %`}
            </div>
          </div>

          {/* Scorecard: Progres k cieľu */}
          <div className="p-3 rounded-lg bg-slate-800/50 ring-1 ring-white/5">
            <div className="text-xs text-slate-400 mb-1">Progres k cieľu</div>
            <div className="text-lg font-bold tabular-nums">
              {goalAssetsEur <= 0 ? (
                <span className="text-slate-500 text-sm">Nastavte cieľ</span>
              ) : (
                <>
                  {progress.toFixed(0)} %
                  {progress >= 100 && (
                    <span className="ml-2 text-emerald-500">✓</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* CTA: Max výnos (placeholder) */}
        <div className="pt-2">
          <button
            type="button"
            className="w-full px-4 py-2.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 ring-1 ring-emerald-600/30 text-emerald-400 text-sm font-medium transition-colors"
            aria-label="Maximalizuj výnos pri dodržaní risk cap"
          >
            🎯 Max výnos (riziko ≤ {cap.toFixed(1)})
          </button>
        </div>

        {/* Recommendations section (placeholder) */}
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold text-slate-300">
            💡 Odporúčania
          </h3>
          <ul className="space-y-1 text-xs text-slate-400">
            {risk > cap && (
              <li className="flex items-start gap-2">
                <span className="text-amber-500 shrink-0">⚠️</span>
                <span>
                  Portfolio prekračuje risk cap ({risk.toFixed(1)} {">"}{" "}
                  {cap.toFixed(1)}). Znížte dynamické riadenie alebo krypto.
                </span>
              </li>
            )}
            {goalAssetsEur > 0 && progress < 50 && (
              <li className="flex items-start gap-2">
                <span className="text-blue-500 shrink-0">ℹ️</span>
                <span>
                  Pre splnenie cieľa ({goalAssetsEur.toLocaleString()} €) zvýšte
                  mesačný vklad alebo horizont.
                </span>
              </li>
            )}
            {goalAssetsEur > 0 && progress >= 100 && (
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 shrink-0">✓</span>
                <span>
                  Cieľ dosiahnutý! Projektovaná hodnota: {fv.toFixed(0)} €
                </span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
