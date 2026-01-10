import React from "react";
import { ProjectionChart } from "../projection/ProjectionChart";
// PR-8: DebtVsInvestmentChart odstránený - ProjectionChart má debt support
import { useProjection } from "../projection/useProjection"; // PR-6 Task A: centralizovaná reaktivita
import type { RiskPref } from "../mix/assetModel";
import type { MixItem } from "../mix/mix.service";
import { getCashReserveInfo } from "../portfolio/cashReserve";
import { readV3, writeV3 } from "../../persist/v3";
import { detectStage } from "../policy/stage";
import { getAdaptiveRiskCap } from "../policy/risk";
import { getDynamicDefaultMix } from "../portfolio/presets"; // PR-9 Task A
import {
  getUnutilizedReserveCopy,
  getCollabOptInCopy,
} from "../ui/warnings/copy";
import {
  detectRightPanelState,
  getStateBadgeCopy,
  shouldShowYieldRisk,
  shouldShowConcreteAdvice,
} from "./rightPanelState";
// PR-13 FIX: BonusesModal removed - bonuses now in ContactModal
// PR-27: Inflation helpers + ValuationModeSelector
import { toRealValue, toRealYield, toNominalGoal } from "../../utils/inflation";
import { ValuationModeSelector } from "../../components/ValuationModeSelector";

/**
 * Formatuje čísla s medzerami ako oddeľovačmi tisícov (SK formát)
 */
function formatNumber(value: number): string {
  return value.toLocaleString("sk-SK", { maximumFractionDigits: 0 });
}

/**
 * Formatuje veľké čísla s jednotkami (M/mld) + medzery
 * Do milióna zobrazuje celé číslo s medzerami
 */
function formatLargeNumber(value: number): string {
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return `${formatNumber(Math.round(value / 1_000_000_000))} mld`;
  }
  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)} M`;
  }
  // Do milióna zobrazujeme celé číslo s medzerami
  return formatNumber(value);
}

interface BasicProjectionPanelProps {
  mix: MixItem[];
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  goalAssetsEur: number;
  riskPref: "konzervativny" | "vyvazeny" | "rastovy";
  mode?: "BASIC" | "PRO"; // PR-4: Hide cash alerts in BASIC
  debts?: Array<{
    id: string;
    name: string;
    principal: number;
    ratePa: number;
    monthly: number;
    monthsLeft?: number;
  }>; // PR-26: Debt reactivity
  valuationMode?: "real" | "nominal"; // PR-27: Inflation adjustment
  onValuationModeChange?: (mode: "real" | "nominal") => void; // PR-27: Callback for mode changes
}

/**
 * BasicProjectionPanel - Zjednodušený, atraktívny panel pre BASIC režim
 *
 * Features:
 * - 3 KPI karty (Očakávaný majetok, Výnos, Do cieľa)
 * - Väčší graf (bez dlhov)
 * - Mini risk gauge pod grafom
 * - Akčné, zrozumiteľné odporúčania
 * - Empty state ak nie je mix
 */
export const BasicProjectionPanel: React.FC<BasicProjectionPanelProps> = ({
  mix,
  lumpSumEur,
  monthlyVklad,
  horizonYears,
  goalAssetsEur,
  riskPref,
  mode = "BASIC", // PR-4: Default to BASIC
  debts = [], // PR-26: Default to empty array
  valuationMode = "nominal", // PR-27: Default to nominal (primárny pohľad)
  onValuationModeChange, // PR-27: Callback for mode changes
}) => {
  // PR-9 Task A: Validate riskPref PRED defaultMix
  const validRiskPref: RiskPref =
    riskPref === "konzervativny" || riskPref === "rastovy"
      ? (riskPref as RiskPref)
      : "vyvazeny";

  // PR-9 Task A: Dynamický default mix podľa profilu (nie hard-coded vyvážený)
  const defaultMix = getDynamicDefaultMix(validRiskPref);

  const effectiveMix =
    Array.isArray(mix) && mix.length > 0 && mix.some((i) => i.pct > 0)
      ? mix
      : defaultMix;

  const hasMix = true; // Always show projection with effective mix
  const isUsingFallback = effectiveMix === defaultMix;

  // PR-26: Get v3 ONLY for profile checks, debts are passed as prop
  const v3 = readV3();

  // PR-13 FIX: Bonuses state removed - bonuses now in ContactModal

  // Check if user has selected profile + has basic data filled
  const hasProfileSelected = !!v3.profile?.selected;
  const hasBasicData = lumpSumEur > 0 || monthlyVklad > 0 || horizonYears > 0;
  const shouldShowRecommendations = hasProfileSelected && hasBasicData;

  // PR-26: Use debts prop instead of v3.debts for reactivity
  const projection = useProjection({
    lumpSumEur,
    monthlyVklad,
    horizonYears,
    goalAssetsEur,
    mix: effectiveMix,
    debts, // PR-26: Use prop (updates on debt add/remove)
    riskPref: validRiskPref,
  });

  // Unpack projection results
  const {
    fvFinal: fv,
    fvSeries,
    totalVklady,
    zisk,
    debtSeries,
    crossoverIndex,
    totalDebtRemaining,
    approxYield,
    riskScore,
    goalProgress: progressPercent,
    remaining,
  } = projection;

  // PR-27: Apply inflation adjustment based on valuation mode
  // Engine works in nominal world, view layer transforms to real if needed
  const displayFV =
    valuationMode === "real" ? toRealValue(fv, horizonYears) : fv;
  const displayYield =
    valuationMode === "real" ? toRealYield(approxYield) : approxYield;

  // Progress k cieľu - VŽDY používame nominal FV (absolútna suma na účte)
  // Real mode zobrazuje len kúpnu silu, ale cieľ sa hodnotí podľa nominal
  const nominalProgress = goalAssetsEur > 0 ? (fv / goalAssetsEur) * 100 : 0;
  const displayProgress = nominalProgress; // Vždy rovnaký progress (nominal aj real)

  // Detect investment stage for adaptive caps
  const stage = detectStage(
    lumpSumEur,
    monthlyVklad,
    horizonYears,
    goalAssetsEur
  );
  const riskCap = getAdaptiveRiskCap(validRiskPref, stage);
  // Risk warning vypnutý v BASIC režime (PR-38)

  // Risk profile label
  const riskLabel = {
    konzervativny: "Konzervatívne",
    vyvazeny: "Vyvážené",
    rastovy: "Dynamické",
  }[validRiskPref];

  // Cash reserve info
  const currentCashPct = effectiveMix.find((m) => m.key === "cash")?.pct || 0;
  const totalPortfolioEur = lumpSumEur + monthlyVklad * 12 * horizonYears;

  // PR-16.A: Detect right panel state
  const monthlyIncome = (v3.profile?.monthlyIncome as any) || 0;
  const reserveEur = (v3.profile?.reserveEur as any) || 0;
  const reserveMonths = (v3.profile?.reserveMonths as any) || 0;

  const panelState = detectRightPanelState({
    lumpSumEur,
    monthlyVklad,
    horizonYears,
    goalAssetsEur,
    monthlyIncome,
    reserveEur,
    reserveMonths,
  });

  const stateBadge = getStateBadgeCopy(panelState);
  const showYieldRisk = shouldShowYieldRisk(panelState);
  const showAdvice = shouldShowConcreteAdvice(panelState);

  const cashReserveInfo = getCashReserveInfo(
    {
      monthlyIncome,
      fixedExpenses: (v3.profile?.fixedExp as any) || 0,
      variableExpenses: (v3.profile?.varExp as any) || 0,
      reserveEur,
      reserveMonths,
    },
    totalPortfolioEur,
    currentCashPct
  );

  // Unutilized reserve detection (PR-11)
  const varExp = (v3.profile?.varExp as any) || 0;
  const surplus = reserveEur - reserveMonths * varExp;
  const hasUnutilizedReserve = surplus >= 50 && surplus - monthlyVklad >= 50;
  const unutilizedReserveCopy = hasUnutilizedReserve
    ? getUnutilizedReserveCopy(
        surplus,
        monthlyVklad,
        Math.round(monthlyVklad + surplus * 0.5)
      )
    : null;

  // PR-13B: "Rezerva najprv" hint conditions
  const fixedExp = (v3.profile?.fixedExp as any) || 0;
  const expenses = fixedExp + varExp;
  const reserveLow = Math.round(expenses * 3);
  const reserveHigh = Math.round(expenses * 6);
  const debtPayments = 0; // TODO: calculate from debts if needed
  const surplusIncome = monthlyIncome - expenses - debtPayments;

  // Zobraz "Rezerva najprv" hint ak:
  // 1. Konzervatívny profil, alebo
  // 2. Minimumy aplicované (TODO: track this in adjustment result), alebo
  // 3. Surplus > monthlyVklad
  const showReserveHint =
    validRiskPref === "konzervativny" || surplusIncome > monthlyVklad;

  // PR-14: Always render projection (with fallback if needed), no empty state

  // PR-13 FIX: formatBonusLabel & handleApplyBonuses removed - bonuses now in ContactModal

  return (
    <div className="space-y-4">
      {/* PR-16.A: State badge (ZERO/PARTIAL) */}
      {stateBadge && (
        <div className="rounded-xl bg-amber-900/20 ring-1 ring-amber-400/30 p-3 flex items-start gap-3">
          <div className="text-lg">ℹ️</div>
          <div className="text-sm text-amber-200/90">{stateBadge}</div>
        </div>
      )}

      {/* Hlavička */}
      <h2 className="text-lg font-bold text-slate-100 px-2 flex items-center gap-2">
        <svg
          className="w-6 h-6 text-emerald-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
          />
        </svg>
        Vaša projekcia
      </h2>

      {/* Hero KPI Panel - Očakávaný majetok dominuje */}
      <div className="rounded-2xl ring-1 ring-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 overflow-hidden">
        {/* Hero sekcia - Očakávaný majetok */}
        <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-sm uppercase tracking-wider text-emerald-400/80 font-semibold">
              Očakávaný majetok
            </div>
          </div>

          <div
            className="text-4xl md:text-5xl font-bold text-white tabular-nums mb-3"
            data-testid="expected-assets-value"
          >
            {formatLargeNumber(displayFV)} €
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-emerald-300/80">
            <span>Vklady: {formatLargeNumber(totalVklady)} €</span>
            <span className="text-emerald-400">
              Zisk: +{formatLargeNumber(zisk)} €
              {totalVklady > 0 && (
                <span className="ml-1">
                  (+{((zisk / totalVklady) * 100).toFixed(0)}%)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* 2 mini karty - Výnos a Cieľ */}
        <div className="grid grid-cols-2 divide-x divide-white/5">
          {/* Mini karta 1: Ročný výnos */}
          <div className="p-4 bg-gradient-to-br from-blue-900/20 to-blue-800/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs uppercase tracking-wider text-blue-400/70 font-semibold">
                Ročný výnos
              </div>
            </div>
            {/* PR-16.A: Gate výnos/riziko (show "—" ak PARTIAL) */}
            {showYieldRisk ? (
              <>
                <div className="text-2xl font-bold text-white tabular-nums mb-1">
                  +{(displayYield * 100).toFixed(1)} %
                </div>
                <div className="text-xs text-blue-300/70">{riskLabel}</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-slate-400 tabular-nums mb-1">
                  —
                </div>
                <div className="text-xs text-slate-500">Vyplňte profil</div>
              </>
            )}
          </div>

          {/* Mini karta 2: Progres k cieľu */}
          <div
            className={`p-4 bg-gradient-to-br ${
              displayProgress >= 100
                ? "from-emerald-900/20 to-emerald-800/10"
                : "from-amber-900/20 to-amber-800/10"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`text-xs uppercase tracking-wider font-semibold ${
                  displayProgress >= 100
                    ? "text-emerald-400/70"
                    : "text-amber-400/70"
                }`}
              >
                {goalAssetsEur > 0 ? "Do cieľa" : "Cieľ"}
              </div>
            </div>
            {goalAssetsEur > 0 ? (
              <>
                <div
                  className={`text-2xl font-bold text-white tabular-nums mb-1 ${
                    displayProgress >= 100 ? "text-emerald-300" : ""
                  }`}
                >
                  {displayProgress >= 100
                    ? "Splnené ✓"
                    : `${formatLargeNumber(goalAssetsEur - displayFV)} €`}
                </div>
                <div
                  className={`text-xs ${
                    displayProgress >= 100
                      ? "text-emerald-300/70"
                      : "text-amber-300/70"
                  }`}
                >
                  {displayProgress >= 100
                    ? displayProgress === 100
                      ? "Cieľ splnený"
                      : `Prekročený o ${(displayProgress - 100).toFixed(0)}%`
                    : `Progres: ${displayProgress.toFixed(0)}%`}
                  {valuationMode === "real" && displayProgress >= 100 && (
                    <span className="block mt-0.5 text-[11px] text-emerald-400/60">
                      (v dnešných cenách ako {formatLargeNumber(displayFV)} €)
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-xl font-semibold text-slate-400 mb-1">
                  Nenastavený
                </div>
                <div className="text-xs text-slate-500">Zadajte cieľ</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* PR-27: Inflation Mode Selector (BASIC + PRO) */}
      <div className="flex justify-center">
        <ValuationModeSelector
          mode={valuationMode}
          onChange={(newMode: "real" | "nominal") => {
            // Update parent state + persist
            if (onValuationModeChange) {
              onValuationModeChange(newMode);
            }
            // Persist to v3
            writeV3({
              profile: { ...readV3().profile, valuationMode: newMode },
            });
          }}
        />
      </div>

      {/* PR-4: Cash Reserve Info - zobraz len v PRO režime */}
      {mode === "PRO" && cashReserveInfo && cashReserveInfo.needsAdjustment && (
        <div
          data-testid="panel-cash-alerts"
          className={`rounded-lg p-3 text-sm ${
            cashReserveInfo.current < cashReserveInfo.optimal
              ? "bg-blue-500/10 border border-blue-500/30"
              : "bg-purple-500/10 border border-purple-500/30"
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-xl">
              {cashReserveInfo.current < cashReserveInfo.optimal ? "💵" : "💰"}
            </span>
            <div className="flex-1">
              <p className="font-semibold text-slate-200 mb-1">
                {cashReserveInfo.current < cashReserveInfo.optimal
                  ? "Rezerva pod optimom"
                  : "Nadmerná rezerva na IAD DK"}
              </p>
              <p className="text-slate-400 text-xs mb-2">
                Aktuálne: {cashReserveInfo.current.toFixed(1)}% | Optimálne:{" "}
                {cashReserveInfo.optimal.toFixed(1)}%
              </p>
              <p className="text-slate-300 text-xs">
                {cashReserveInfo.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Graf */}
      <div className="rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4">
        {/* PR-14: Fallback warning */}
        {isUsingFallback && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-500/30">
            <p className="text-xs text-amber-300/90">
              ℹ️ Predbežný odhad (použitý vyvážený mix). Pre presnejšiu
              projekciu si vyberte portfólio nižšie.
            </p>
          </div>
        )}
        <ProjectionChart
          mix={effectiveMix}
          debts={readV3().debts || []} // PR-8: Zobraz dlhy v grafe (ak existujú)
          lumpSumEur={lumpSumEur} // PR-6: live values (instant reaktivita)
          monthlyVklad={monthlyVklad} // PR-6: live values
          horizonYears={horizonYears} // PR-6: live values
          goalAssetsEur={goalAssetsEur} // PR-6: live values
          riskPref={validRiskPref}
          hideDebts={false} // PR-8: Zobraz debt line (unified graph)
          valuationMode={valuationMode} // PR-27: Inflation adjustment
        />
        {/* Risk Gauge (pod grafom) - 6 úrovní */}
        <div className="-mt-2 pt-2 border-t border-white/5">
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm font-medium text-slate-300">Riziko:</span>
            <div className="flex items-center gap-3">
              {/* Gauge bars - väčšie, 6 úrovní */}
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => {
                  let barColor = "bg-slate-700"; // Default (inactive)

                  if (i < Math.round(riskScore)) {
                    // Aktívny bar - 6 úrovní podľa škály
                    if (riskScore <= 2.0) {
                      barColor = "bg-green-500"; // Nízke (0-2.0)
                    } else if (riskScore <= 4.0) {
                      barColor = "bg-lime-500"; // Mierne (2.0-4.0)
                    } else if (riskScore <= 6.0) {
                      barColor = "bg-yellow-500"; // Stredné (4.0-6.0)
                    } else if (riskScore <= 7.5) {
                      barColor = "bg-orange-500"; // Zvýšené (6.0-7.5)
                    } else if (riskScore <= 9.0) {
                      barColor = "bg-orange-600"; // Vysoké (7.5-9.0, tmavo oranžová)
                    } else {
                      barColor = "bg-red-600"; // Extrémne vysoké (>9.0)
                    }
                  }

                  return (
                    <div
                      key={i}
                      className={`w-2.5 h-6 rounded-sm transition-all ${barColor}`}
                    />
                  );
                })}
              </div>
              <span className="text-base font-bold tabular-nums text-white">
                {riskScore.toFixed(1)}/10
              </span>
            </div>
            <span
              className={`text-sm font-medium ${
                riskScore <= 2.0
                  ? "text-green-400"
                  : riskScore <= 4.0
                    ? "text-lime-400"
                    : riskScore <= 6.0
                      ? "text-yellow-400"
                      : riskScore <= 7.5
                        ? "text-orange-400"
                        : riskScore <= 9.0
                          ? "text-orange-600"
                          : "text-red-600"
              }`}
            >
              {riskScore <= 2.0
                ? "✓ Nízke"
                : riskScore <= 4.0
                  ? "✓ Mierne"
                  : riskScore <= 6.0
                    ? "⚠️ Stredné"
                    : riskScore <= 7.5
                      ? "⚠️ Zvýšené"
                      : riskScore <= 9.0
                        ? "🔴 Vysoké"
                        : "🔴 Extrémne vysoké"}
            </span>
          </div>
        </div>
      </div>

      {/* CTA: Odoslať projekciu - BASIC režim (kompaktný, bez tipov) */}
      {shouldShowRecommendations && (
        <div className="rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <span>📧</span>
            <span>Chcete profesionálnu pomoc?</span>
          </h3>

          <p className="text-sm text-slate-400">
            Naši experti vám pomôžu optimalizovať plán a nájsť riešenia na
            mieru.
          </p>

          {/* PR-11: Collab opt-in checkbox */}
          <label
            htmlFor="collab-opt-in-checkbox"
            className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-300 transition-colors"
          >
            <input
              id="collab-opt-in-checkbox"
              type="checkbox"
              checked={!!(v3.profile as any)?.collabOptIn}
              onChange={(e) => {
                const checked = e.target.checked;
                writeV3({
                  profile: { ...v3.profile, collabOptIn: checked } as any,
                });
                // Track telemetry (PR-10)
                import("../../services/telemetry").then((t) =>
                  t.trackCollabInterest({
                    checked,
                    stage,
                    riskPref: validRiskPref,
                    monthlyIncome: (v3.profile?.monthlyIncome as any) || 0,
                    monthlyVklad,
                  })
                );
              }}
              aria-label="Zvýšiť príjem (collab opt-in)"
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-2 focus:ring-emerald-500/50 cursor-pointer flex-shrink-0"
            />
            <span className="select-none">{getCollabOptInCopy()}</span>
          </label>
        </div>
      )}
    </div>
  );
};
