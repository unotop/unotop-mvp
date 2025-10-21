/**
 * ProjectionChart - Vizualizácia investícií vs. dlhov s crossover markerom
 */

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { MixItem } from "../mix/mix.service";
import type { Debt } from "../../persist/v3";
import { simulateProjection, monthsToYears, formatCurrency } from "./engine";
import type { DebtInput, InvestInput } from "./types";

interface ProjectionChartProps {
  // Investičné vstupy
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  mix: MixItem[];
  // Dlhy
  debts: Debt[];
  // Voliteľné
  goalAssetsEur?: number;
}

/**
 * Odhad ročného výnosu z mixu
 * (Reuse z mix.service.ts alebo MetricsSection)
 */
function approxYieldAnnualFromMix(mix: MixItem[]): number {
  if (!Array.isArray(mix) || mix.length === 0) return 0.04;
  const gold = mix.find((i) => i.key === "gold")?.pct || 0;
  const dyn = mix.find((i) => i.key === "dyn")?.pct || 0;
  const etf = mix.find((i) => i.key === "etf")?.pct || 0;
  const bonds = mix.find((i) => i.key === "bonds")?.pct || 0;
  const cash = mix.find((i) => i.key === "cash")?.pct || 0;
  const crypto = mix.find((i) => i.key === "crypto")?.pct || 0;
  const real = mix.find((i) => i.key === "real")?.pct || 0;
  const other = mix.find((i) => i.key === "other")?.pct || 0;
  const totalPct = gold + dyn + etf + bonds + cash + crypto + real + other;
  if (totalPct < 1) return 0.04;
  const weighted =
    (gold * 0.06 +
      dyn * 0.08 +
      etf * 0.07 +
      bonds * 0.03 +
      cash * 0.01 +
      crypto * 0.15 +
      real * 0.05 +
      other * 0.04) /
    totalPct;
  return weighted;
}

/**
 * Konverzia Debt → DebtInput (pridaj kind detection + extra payments)
 */
function mapDebtToInput(debt: Debt): DebtInput {
  // Heuristic: ak úrok > 6%, pravdepodobne spotrebák, inak hypotéka
  const kind = debt.ratePa > 6 ? "consumer" : "mortgage";

  // Extra mesačná splátka (ide od mesiaca 1)
  const recurringExtra =
    debt.extraMonthly && debt.extraMonthly > 0
      ? { startMonth: 1, amount: debt.extraMonthly }
      : undefined;

  return {
    id: debt.id,
    kind,
    principal: debt.principal,
    annualRate: debt.ratePa,
    termMonths: debt.monthsLeft || 360, // default 30 rokov ak nie je zadané
    oneOffExtras: [], // Zatiaľ žiadne jednorazové (UI môžeme pridať neskôr)
    recurringExtra,
  };
}

/**
 * Komponent pre projekčný graf
 */
export function ProjectionChart({
  lumpSumEur,
  monthlyVklad,
  horizonYears,
  mix,
  debts,
  goalAssetsEur,
}: ProjectionChartProps) {
  const horizonMonths = Math.max(1, Math.round(horizonYears * 12));
  const annualYield = approxYieldAnnualFromMix(mix);

  // Investičné vstupy
  const investInput: InvestInput = {
    startLumpSum: lumpSumEur || 0,
    monthly: monthlyVklad || 0,
    annualYieldPct: annualYield * 100,
  };

  // Dlhové vstupy
  const debtInputs: DebtInput[] = debts
    .filter((d) => d.principal > 0)
    .map(mapDebtToInput);

  // Dependency key pre debts (aby useMemo správne reagoval na zmeny)
  const debtsKey = JSON.stringify(
    debts.map((d) => ({
      id: d.id,
      principal: d.principal,
      ratePa: d.ratePa,
      monthsLeft: d.monthsLeft,
      extraMonthly: d.extraMonthly,
    }))
  );

  // Simulácia
  const result = React.useMemo(() => {
    return simulateProjection({
      horizonMonths,
      debts: debtInputs,
      invest: investInput,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizonMonths, lumpSumEur, monthlyVklad, annualYield, debtsKey]);

  // Príprava dát pre Recharts (konvertuj mesiace → roky, zaokrúhli hodnoty)
  const chartData = result.series
    .filter((_, idx) => idx % 12 === 0 || idx === result.series.length - 1) // sample každý 12. mesiac (ročne) + posledný bod
    .map((p) => ({
      year: monthsToYears(p.month),
      investície: Math.round(p.investValue),
      dlhy: Math.round(p.totalDebtBalance),
    }));

  // Crossover marker (ak existuje)
  const crossoverYear =
    result.crossoverMonth !== null
      ? monthsToYears(result.crossoverMonth)
      : null;
  const currentYear = new Date().getFullYear();
  const crossoverCalendarYear =
    crossoverYear !== null ? Math.round(currentYear + crossoverYear) : null;

  // Prázdny stav
  if (chartData.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-sm text-slate-400">
        Nastavte investičný horizont a vstupy pre zobrazenie projekcie.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Prehľad výsledkov */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded bg-slate-800/50 ring-1 ring-white/5">
          <div className="text-slate-400 mb-0.5">
            Konečná hodnota (investície)
          </div>
          <div className="font-bold text-emerald-400 tabular-nums">
            {formatCurrency(result.finalInvestValue)}
          </div>
        </div>
        <div className="p-2 rounded bg-slate-800/50 ring-1 ring-white/5">
          <div className="text-slate-400 mb-0.5">
            Zostatok dlhov ({horizonYears} r)
          </div>
          <div className="font-bold text-red-400 tabular-nums">
            {formatCurrency(result.finalDebtBalance)}
          </div>
        </div>
      </div>

      {/* Crossover info */}
      {crossoverYear !== null && (
        <div className="p-3 rounded-lg bg-emerald-900/20 ring-1 ring-emerald-500/30 text-sm">
          <div className="font-medium text-emerald-400 mb-1">
            ✅ Bod prelomu dosiahnutý
          </div>
          <div className="text-slate-300">
            Investície prekročia zostatok dlhov po{" "}
            <span className="font-bold tabular-nums">
              {crossoverYear.toFixed(1)} rokoch
            </span>{" "}
            (cca {crossoverCalendarYear}).
          </div>
        </div>
      )}

      {/* Recharts graf */}
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 20, bottom: 45, left: 10 }}
          >
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis
              dataKey="year"
              stroke="#94a3b8"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              label={{
                value: "Roky",
                position: "insideBottom",
                offset: -5,
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickFormatter={(val: number) =>
                val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`
              }
              label={{
                value: "€",
                angle: -90,
                position: "insideLeft",
                fill: "#94a3b8",
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(val: number) => formatCurrency(val)}
              labelFormatter={(year: number) => `Rok ${year.toFixed(1)}`}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
              verticalAlign="bottom"
            />

            {/* Investičná krivka (zelená) */}
            <Line
              type="monotone"
              dataKey="investície"
              stroke="#10b981"
              strokeWidth={3}
              name="Investície (rast)"
              dot={false}
            />

            {/* Dlhová krivka (červená) */}
            {debtInputs.length > 0 && (
              <Line
                type="monotone"
                dataKey="dlhy"
                stroke="#ef4444"
                strokeWidth={3}
                name="Dlhy (zostatok)"
                dot={false}
              />
            )}

            {/* Cieľ (referenceline) */}
            {goalAssetsEur && goalAssetsEur > 0 && (
              <ReferenceLine
                y={goalAssetsEur}
                stroke="#facc15"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{
                  value: `Cieľ: ${formatCurrency(goalAssetsEur)}`,
                  position: "top",
                  fill: "#facc15",
                  fontSize: 11,
                }}
              />
            )}

            {/* Crossover marker (vertikálna čiara) */}
            {crossoverYear !== null && (
              <ReferenceLine
                x={crossoverYear}
                stroke="#22d3ee"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{
                  value: `Prelom (${crossoverCalendarYear})`,
                  position: "top",
                  fill: "#22d3ee",
                  fontSize: 11,
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* A11y description */}
      <div
        className="sr-only"
        role="img"
        aria-label={`Graf projekcie investícií a dlhov. ${
          crossoverYear !== null
            ? `Bod prelomu nastáva po ${crossoverYear.toFixed(1)} rokoch.`
            : "Investície neprekročia dlhy v tomto horizonte."
        }`}
      >
        Graf zobrazuje rast investícií (zelená čiara) a klesajúci zostatok dlhov
        (červená čiara) počas {horizonYears} rokov.
        {crossoverYear !== null &&
          ` Investície prekročia dlhy v roku ${crossoverCalendarYear}.`}
      </div>
    </div>
  );
}
