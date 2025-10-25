import React from "react";
import { ProjectionChart } from "../projection/ProjectionChart";
import { calculateFutureValue } from "../../engine/calculations";
import {
  approxYieldAnnualFromMix,
  riskScore0to10,
  type RiskPref,
} from "../mix/assetModel";
import type { MixItem } from "../mix/mix.service";
import { getCashReserveInfo } from "../portfolio/cashReserve";
import { readV3, writeV3 } from "../../persist/v3";
import { detectStage } from "../policy/stage";
import { getAdaptiveRiskCap } from "../policy/risk";
import { getUnutilizedReserveCopy, getCollabOptInCopy } from "../ui/warnings/copy";

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
}) => {
  const hasMix =
    Array.isArray(mix) && mix.length > 0 && mix.some((i) => i.pct > 0);

  // Validate riskPref
  const validRiskPref: RiskPref =
    riskPref === "konzervativny" || riskPref === "rastovy"
      ? (riskPref as RiskPref)
      : "vyvazeny";

  // Detect investment stage for adaptive caps
  const stage = detectStage(
    lumpSumEur,
    monthlyVklad,
    horizonYears,
    goalAssetsEur
  );

  // Calculations
  const approxYield = hasMix
    ? approxYieldAnnualFromMix(mix, validRiskPref)
    : 0.04;
  const fv = calculateFutureValue(
    lumpSumEur,
    monthlyVklad,
    horizonYears,
    approxYield
  );
  const totalVklady = lumpSumEur + monthlyVklad * 12 * horizonYears;
  const zisk = fv - totalVklady;

  // Progress calculation (capped at 100%)
  const progressPercent =
    goalAssetsEur > 0 ? Math.min((fv / goalAssetsEur) * 100, 100) : 0;
  const remaining = Math.max(goalAssetsEur - fv, 0);

  // Risk metrics with adaptive cap
  const riskScore = hasMix ? riskScore0to10(mix, validRiskPref, 0) : 0;
  const riskCap = getAdaptiveRiskCap(validRiskPref, stage);
  const isOverRisk = riskScore > riskCap;

  // Risk profile label
  const riskLabel = {
    konzervativny: "Konzervatívne",
    vyvazeny: "Vyvážené",
    rastovy: "Dynamické",
  }[validRiskPref];

  // Cash reserve info
  const v3 = readV3();
  const currentCashPct = mix.find((m) => m.key === "cash")?.pct || 0;
  const totalPortfolioEur = lumpSumEur + monthlyVklad * 12 * horizonYears;

  const cashReserveInfo = hasMix
    ? getCashReserveInfo(
        {
          monthlyIncome: (v3.profile?.monthlyIncome as any) || 0,
          fixedExpenses: (v3.profile?.fixedExp as any) || 0,
          variableExpenses: (v3.profile?.varExp as any) || 0,
          reserveEur: (v3.profile?.reserveEur as any) || 0,
          reserveMonths: (v3.profile?.reserveMonths as any) || 0,
        },
        totalPortfolioEur,
        currentCashPct
      )
    : null;

  // Unutilized reserve detection (PR-11)
  const reserveEur = (v3.profile?.reserveEur as any) || 0;
  const reserveMonths = (v3.profile?.reserveMonths as any) || 0;
  const varExp = (v3.profile?.varExp as any) || 0;
  const surplus = reserveEur - reserveMonths * varExp;
  const hasUnutilizedReserve =
    surplus >= 50 && surplus - monthlyVklad >= 50;
  const unutilizedReserveCopy = hasUnutilizedReserve
    ? getUnutilizedReserveCopy(
        surplus,
        monthlyVklad,
        Math.round(monthlyVklad + surplus * 0.5)
      )
    : null;

  // Empty state - ak nie je mix
  if (!hasMix) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-100 px-2">
          📈 Vaša projekcia
        </h2>
        <div className="rounded-2xl ring-1 ring-white/5 bg-gradient-to-br from-slate-900/80 to-slate-800/60 p-8 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="text-4xl">📊</div>
            <h3 className="text-xl font-semibold text-white">
              Vyberte si portfólio
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Aby sme mohli vypočítať vašu projekciu, vyberte jedno z
              predpripravených portfólií nižšie. Každé je prispôsobené vášmu
              rizikovému profilu.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <span className="text-xs text-slate-500">
                → Scroll dole k sekcii "Portfólio"
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hlavička */}
      <h2 className="text-lg font-bold text-slate-100 px-2">
        📈 Vaša projekcia
      </h2>

      {/* Hero KPI Panel - Očakávaný majetok dominuje */}
      <div className="rounded-2xl ring-1 ring-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 overflow-hidden">
        {/* Hero sekcia - Očakávaný majetok */}
        <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl">💰</div>
            <div className="text-sm uppercase tracking-wider text-emerald-400/80 font-semibold">
              Očakávaný majetok
            </div>
          </div>

          <div
            className="text-4xl md:text-5xl font-bold text-white tabular-nums mb-3"
            data-testid="expected-assets-value"
          >
            {formatLargeNumber(fv)} €
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
              <div className="text-xl">📊</div>
              <div className="text-xs uppercase tracking-wider text-blue-400/70 font-semibold">
                Ročný výnos
              </div>
            </div>
            <div className="text-2xl font-bold text-white tabular-nums mb-1">
              +{(approxYield * 100).toFixed(1)} %
            </div>
            <div className="text-xs text-blue-300/70">
              {riskLabel}
              {isOverRisk && (
                <span className="text-amber-400 ml-2">⚠️ Vysoké riziko</span>
              )}
            </div>
          </div>

          {/* Mini karta 2: Progres k cieľu */}
          <div
            className={`p-4 bg-gradient-to-br ${
              progressPercent >= 100
                ? "from-emerald-900/20 to-emerald-800/10"
                : "from-amber-900/20 to-amber-800/10"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xl">🎯</div>
              <div
                className={`text-xs uppercase tracking-wider font-semibold ${
                  progressPercent >= 100
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
                    progressPercent >= 100 ? "text-emerald-300" : ""
                  }`}
                >
                  {remaining > 0
                    ? `${formatLargeNumber(remaining)} €`
                    : "Splnené ✓"}
                </div>
                <div
                  className={`text-xs ${
                    progressPercent >= 100
                      ? "text-emerald-300/70"
                      : "text-amber-300/70"
                  }`}
                >
                  {progressPercent >= 100
                    ? progressPercent === 100
                      ? "Cieľ splnený"
                      : `Prekročený o ${(progressPercent - 100).toFixed(0)}%`
                    : `Progres: ${progressPercent.toFixed(0)}%`}
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

      {/* Cash Reserve Info - ak treba upozorniť */}
      {cashReserveInfo && cashReserveInfo.needsAdjustment && (
        <div
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
                  : "Nadmerná hotovosť"}
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
        <ProjectionChart
          mix={mix}
          debts={[]} // BASIC nemá dlhy v grafe
          lumpSumEur={lumpSumEur}
          monthlyVklad={monthlyVklad}
          horizonYears={horizonYears}
          goalAssetsEur={goalAssetsEur}
          riskPref={validRiskPref}
          hideDebts={true}
        />
        {/* Risk Gauge (pod grafom) - 6 úrovní */}
        <div className="mt-2 pt-3 border-t border-white/5">
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
                {riskScore.toFixed(1)}/{riskCap.toFixed(1)}
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

      {/* Odporúčania - kompaktné, edukatívne */}
      <div className="rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <span>💡</span>
          <span>Čo ďalej?</span>
        </h3>

        <div className="space-y-2">
          {/* Priorita 0: Unutilized reserve (ak existuje, zobraz info) */}
          {hasUnutilizedReserve && unutilizedReserveCopy && (
            <div className="flex items-start gap-2 text-sm">
              <span className="text-blue-500 shrink-0">💵</span>
              <div className="text-slate-300">{unutilizedReserveCopy}</div>
            </div>
          )}

          {/* Priorita 1: Vysoké riziko (VŽDY prvé ak existuje) */}
          {isOverRisk && (
            <div className="flex items-start gap-2 text-sm">
              <span className="text-amber-500 shrink-0">⚠️</span>
              <div className="text-slate-300">
                <strong>Pozor!</strong> Portfólio rizikové (
                {riskScore.toFixed(1)}/{riskCap.toFixed(1)}). Znížte dyn.
                riadenie alebo krypto.
              </div>
            </div>
          )}

          {/* Priorita 2: Cieľ splnený (ak nie je riziko) */}
          {!isOverRisk && progressPercent >= 100 && (
            <div className="flex items-start gap-2 text-sm">
              <span className="text-emerald-500 shrink-0">🎉</span>
              <div className="text-slate-300">
                <strong>Gratulujeme!</strong> Váš cieľ bude splnený.
              </div>
            </div>
          )}

          {/* Priorita 3: Edukatívne odporúčania (ak cieľ nie je splnený) */}
          {!isOverRisk &&
            goalAssetsEur > 0 &&
            progressPercent < 100 &&
            remaining > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-blue-500 shrink-0">💡</span>
                <div className="text-slate-300">
                  <strong>Ako dosiahnuť cieľ?</strong> Chýba vám{" "}
                  {formatLargeNumber(remaining)} €. Možnosti:
                  <ul className="mt-1 ml-4 text-xs space-y-0.5 text-slate-400">
                    {/* Smart odporúčanie vkladu - len ak je realistické */}
                    {monthlyVklad > 0 &&
                      horizonYears > 0 &&
                      (() => {
                        const requiredMonthly = Math.ceil(
                          monthlyVklad + remaining / (horizonYears * 12)
                        );
                        const currentIncome =
                          (v3.profile?.monthlyIncome as any) || 0;
                        const increaseRatio =
                          requiredMonthly / Math.max(monthlyVklad, 1);
                        const incomeRatio =
                          currentIncome > 0
                            ? requiredMonthly / currentIncome
                            : 999;

                        // Zobraz len ak je realistické (<2× súčasný vklad ALEBO <40% príjmu)
                        const isRealistic =
                          increaseRatio < 2 && incomeRatio < 0.4;

                        if (isRealistic) {
                          return (
                            <li>
                              ✅ Zvýšte mesačný vklad na{" "}
                              <strong className="text-blue-400">
                                {requiredMonthly} €
                              </strong>
                            </li>
                          );
                        }
                        return null;
                      })()}
                    <li>✅ Optimalizujte výdavky (fixné/variabilné)</li>
                    {horizonYears < 15 && (
                      <li>✅ Predĺžte horizont na {horizonYears + 5} rokov</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

          {/* Priorita 4: Pozitívna spätná väzba (default - ak nie sú iné odporúčania) */}
          {!isOverRisk && (progressPercent >= 100 || progressPercent === 0) && (
            <div className="flex items-start gap-2 text-sm">
              <span className="text-emerald-500 shrink-0">✓</span>
              <div className="text-slate-300">
                <strong>Skvelé!</strong> Portfólio vyvážené a zodpovedá profilu.
              </div>
            </div>
          )}

          {/* CTA: VŽDY viditeľný */}
          <div className="mt-3 pt-2 border-t border-white/5">
            <div className="flex items-start gap-2 text-sm">
              <span className="text-emerald-500 shrink-0">📧</span>
              <div className="text-slate-300">
                <strong>Odoslať agentovi</strong> → nezáväzne pomôžeme dosiahnuť
                ciele.
              </div>
            </div>

            {/* PR-11: Collab opt-in checkbox */}
            <label className="flex items-center gap-2 mt-2 text-xs text-slate-400 cursor-pointer hover:text-slate-300 transition-colors">
              <input
                type="checkbox"
                checked={!!(v3.profile as any)?.collabOptIn}
                onChange={(e) => {
                  const checked = e.target.checked;
                  writeV3({ profile: { ...v3.profile, collabOptIn: checked } as any });
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
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
              />
              <span>{getCollabOptInCopy()}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
