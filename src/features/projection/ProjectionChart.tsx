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
import { approxYieldAnnualFromMix, type RiskPref } from "../mix/assetModel";

interface ProjectionChartProps {
  // Investičné vstupy
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  mix: MixItem[];
  riskPref: string; // "konzervativny" | "vyvazeny" | "rastovy"
  // Dlhy
  debts: Debt[];
  // Voliteľné
  goalAssetsEur?: number;
  hideDebts?: boolean; // BASIC režim - nezobrazuj dlhovú krivku
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
  riskPref,
  debts,
  goalAssetsEur,
  hideDebts = false, // default: zobraz všetko
}: ProjectionChartProps) {
  const horizonMonths = Math.max(1, Math.round(horizonYears * 12));

  // Validate riskPref
  const validRiskPref: RiskPref =
    riskPref === "konzervativny" || riskPref === "rastovy"
      ? (riskPref as RiskPref)
      : "vyvazeny";

  const annualYield = approxYieldAnnualFromMix(mix, validRiskPref);

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

  // Dependency key pre mix (aby useMemo reagoval na zmeny mixu)
  const mixKey = JSON.stringify(
    Array.isArray(mix) ? mix.map((m) => ({ key: m.key, pct: m.pct })) : []
  );

  // Simulácia
  const result = React.useMemo(() => {
    return simulateProjection({
      horizonMonths,
      debts: debtInputs,
      invest: investInput,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizonMonths, lumpSumEur, monthlyVklad, mixKey, debtsKey, riskPref]);

  // Príprava dát pre Recharts (konvertuj mesiace → roky, zaokrúhli hodnoty)
  // WRAPPNUTÉ v useMemo aby sa chartData nevytvárala pri každom renderi
  const chartData = React.useMemo(() => {
    return result.series
      .filter((_, idx) => idx % 12 === 0 || idx === result.series.length - 1) // sample každý 12. mesiac (ročne) + posledný bod
      .map((p) => ({
        year: monthsToYears(p.month),
        investície: Math.round(p.investValue),
        dlhy: Math.round(p.totalDebtBalance),
        čistý: Math.round(p.investValue - p.totalDebtBalance), // Net Worth = investície - dlhy
      }));
  }, [result.series]);

  // Debug: skontroluj chartData (dočasné) - ODSTRÁNENÉ aby nevypisovalo do konzoly
  // React.useEffect(() => {
  //   if (chartData.length > 0) {
  //     console.log(
  //       "ProjectionChart chartData:",
  //       chartData.slice(0, 3),
  //       "...",
  //       chartData[chartData.length - 1]
  //     );
  //   }
  // }, [chartData]);

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
      <div className="w-full" style={{ height: "320px" }}>
        <ResponsiveContainer width="100%" height={320}>
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
              domain={[0, "auto"]}
              padding={{ top: 20, bottom: 0 }}
              tickFormatter={(val: number) =>
                val >= 1000 ? `${(val / 1000).toFixed(0)}k €` : `${val} €`
              }
              width={60}
            />
            <Tooltip
              content={(props) => {
                const { active, payload, label } = props;
                if (!active || !payload || !payload.length) return null;

                const data = payload[0].payload;
                const rok = data.year;
                const očakávanýMajetok = data.čistý;

                // Vypočítaj celkový vklad (lump sum + mesačné vklady * roky * 12)
                const celkovýVklad = lumpSumEur + monthlyVklad * rok * 12;
                const zisk = očakávanýMajetok - celkovýVklad;

                return (
                  <div
                    style={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                      padding: "8px 10px",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                      Rok {rok.toFixed(1)}
                    </div>
                    <div style={{ color: "#10b981", marginBottom: "2px" }}>
                      Zisk: {formatCurrency(zisk)}
                    </div>
                    <div style={{ color: "#34d399" }}>
                      Očakávaný majetok: {formatCurrency(očakávanýMajetok)}
                    </div>
                    {!hideDebts && data.dlhy > 0 && (
                      <div style={{ color: "#ef4444", marginTop: "2px" }}>
                        Dlhy: {formatCurrency(data.dlhy)}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
              verticalAlign="bottom"
            />

            {/* Investičná krivka (modrá - úplne skrytá aj z legendy) */}
            <Line
              type="monotone"
              dataKey="investície"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Investície (rast)"
              dot={false}
              isAnimationActive={false}
              hide={true}
              legendType="none"
            />

            {/* Dlhová krivka (červená) - skryť v BASIC režime */}
            {!hideDebts && debtInputs.length > 0 && (
              <Line
                type="monotone"
                dataKey="dlhy"
                stroke="#ef4444"
                strokeWidth={2}
                name="Dlhy (zostatok)"
                dot={false}
                isAnimationActive={false}
              />
            )}

            {/* Očakávaný majetok (zelená) */}
            <Line
              type="monotone"
              dataKey="čistý"
              stroke="#10b981"
              strokeWidth={2.5}
              name="Očakávaný majetok"
              dot={false}
              isAnimationActive={false}
              strokeDasharray="0"
            />

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
        aria-label={`Graf projekcie investícií, dlhov a očakávaného majetku. ${
          crossoverYear !== null
            ? `Bod prelomu nastáva po ${crossoverYear.toFixed(1)} rokoch.`
            : "Investície neprekročia dlhy v tomto horizonte."
        }`}
      >
        Graf zobrazuje rast investícií (modrá čiara), klesajúci zostatok dlhov
        (červená čiara) a očakávaný majetok (zelená čiara) počas {horizonYears}{" "}
        rokov.
        {crossoverYear !== null &&
          ` Investície prekročia dlhy v roku ${crossoverCalendarYear}.`}
      </div>
    </div>
  );
}
