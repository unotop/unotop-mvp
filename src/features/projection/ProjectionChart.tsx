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
import { monthsToYears, formatCurrency } from "./engine";
import { useProjection } from "./useProjection";
import type { RiskPref } from "../mix/assetModel";
import { toRealValue, getBothValues } from "../../utils/inflation"; // PR-27

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
  valuationMode?: "real" | "nominal"; // PR-27: Inflation adjustment
}

/**
 * Komponent pre projekčný graf
 * PR-11: Unifikovaný na useProjection() hook (single source of truth)
 */
export function ProjectionChart({
  lumpSumEur,
  monthlyVklad,
  horizonYears,
  mix,
  riskPref,
  debts,
  goalAssetsEur,
  hideDebts = false,
  valuationMode = "real", // PR-27: Default to real
}: ProjectionChartProps) {
  // Validate riskPref
  const validRiskPref: RiskPref =
    riskPref === "konzervativny" || riskPref === "rastovy"
      ? (riskPref as RiskPref)
      : "vyvazeny";

  // PR-11: Použiť useProjection hook namiesto simulateProjection
  const projection = useProjection({
    lumpSumEur,
    monthlyVklad,
    horizonYears,
    goalAssetsEur: goalAssetsEur || 0,
    mix: Array.isArray(mix) && mix.length > 0 ? mix : [],
    debts: debts || [],
    riskPref: validRiskPref,
  });

  const {
    fvSeries,
    debtSeries,
    investedSeries,
    crossoverIndex,
    effectiveHorizonYears,
  } = projection;

  // PR-11: Príprava dát pre Recharts (ročné vzorky)
  const chartData = React.useMemo(() => {
    const data = [];
    for (let year = 0; year <= effectiveHorizonYears; year++) {
      const wealth = fvSeries[year] || 0;
      const debt = debtSeries[year] || 0;
      const invested = investedSeries[year] || 0;

      // PR-27: Apply inflation adjustment based on valuationMode
      const displayWealth =
        valuationMode === "real" ? toRealValue(wealth, year) : wealth;
      const displayDebt =
        valuationMode === "real" ? toRealValue(debt, year) : debt;
      const displayInvested =
        valuationMode === "real" ? toRealValue(invested, year) : invested;

      // PR-11: Profit = wealth - invested (NIE wealth - debt!)
      const profit = displayWealth - displayInvested;

      data.push({
        year,
        majetok: Math.max(0, Math.round(displayWealth)), // Clamp ≥ 0
        dlhy: Math.max(0, Math.round(displayDebt)), // Clamp ≥ 0
        vložené: Math.round(displayInvested),
        zisk: Math.round(profit), // Môže byť záporný
        // PR-27: Store both values for tooltip
        _nominalWealth: Math.round(wealth),
        _realWealth: Math.round(toRealValue(wealth, year)),
      });
    }
    return data;
  }, [
    fvSeries,
    debtSeries,
    investedSeries,
    effectiveHorizonYears,
    valuationMode,
  ]);

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

  // PR-11: Crossover marker (používa crossoverIndex z useProjection)
  const crossoverYear = crossoverIndex !== null ? crossoverIndex : null;
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
      {/* Titulok grafu */}
      <h3 className="text-lg font-semibold text-slate-200">
        Projekcia majetku (investícia vs. dlh)
      </h3>

      {/* Crossover info */}
      {crossoverYear !== null && (
        <div className="p-3 rounded-lg bg-emerald-900/20 ring-1 ring-emerald-500/30 text-sm">
          <div className="font-medium text-emerald-400 mb-1">
            ✅ Bod prelomu dosiahnutý
          </div>
          <div className="text-slate-300">
            {crossoverYear === 0 ? (
              <>
                Investície už teraz prekračujú zostatok dlhov{" "}
                <span className="font-bold text-emerald-400">
                  (prelomenie: Štart)
                </span>
              </>
            ) : (
              <>
                Investície prekročia zostatok dlhov po{" "}
                <span className="font-bold tabular-nums">
                  {crossoverYear.toFixed(1)} rokoch
                </span>{" "}
                (cca {crossoverCalendarYear}).
              </>
            )}
          </div>
        </div>
      )}

      {/* Recharts graf */}
      <div className="w-full" style={{ height: "320px" }}>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 20, bottom: 30, left: 10 }}
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
              domain={["auto", "auto"]} // PR-10 Fix: Support negative values (dlhy > investície na začiatku)
              padding={{ top: 20, bottom: 20 }}
              tickFormatter={(val: number) => {
                const absVal = Math.abs(val);
                if (absVal >= 1000) {
                  return `${(val / 1000).toFixed(0)}k €`;
                }
                return `${val} €`;
              }}
              width={60}
            />
            <Tooltip
              content={(props) => {
                const { active, payload } = props;
                if (!active || !payload || !payload.length) return null;

                const data = payload[0].payload;
                const rok = data.year;
                const majetok = data.majetok;
                const vložené = data.vložené;
                const zisk = data.zisk;
                // PR-27: Dual values (real + nominal)
                const nominalWealth = data._nominalWealth || majetok;
                const realWealth = data._realWealth || majetok;

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
                      {rok === 0 ? "Štart" : `Rok ${rok}`}
                    </div>
                    {/* PR-27: Show primary value based on mode, secondary below */}
                    {valuationMode === "real" ? (
                      <>
                        <div style={{ color: "#34d399" }}>
                          V dnešných cenách:{" "}
                          {formatCurrency(Math.max(0, majetok))}
                        </div>
                        <div
                          style={{
                            color: "#94a3b8",
                            fontSize: "10px",
                            marginTop: "2px",
                          }}
                        >
                          Nominálne:{" "}
                          {formatCurrency(Math.max(0, nominalWealth))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ color: "#34d399" }}>
                          Nominálne: {formatCurrency(Math.max(0, majetok))}
                        </div>
                        <div
                          style={{
                            color: "#94a3b8",
                            fontSize: "10px",
                            marginTop: "2px",
                          }}
                        >
                          V dnešných cenách:{" "}
                          {formatCurrency(Math.max(0, realWealth))}
                        </div>
                      </>
                    )}
                    <div style={{ color: "#60a5fa", marginTop: "2px" }}>
                      Vložené celkom: {formatCurrency(Math.max(0, vložené))}
                    </div>
                    {/* PR-12: Rok 0 zobrazí len "Investované", nie zisk */}
                    {rok === 0 ? (
                      <div style={{ color: "#60a5fa", marginTop: "2px" }}>
                        Investované: {formatCurrency(Math.max(0, vložené))}
                      </div>
                    ) : (
                      <div
                        style={{
                          color: zisk >= 0 ? "#10b981" : "#fb923c",
                          marginTop: "2px",
                        }}
                      >
                        {zisk >= 0 ? "Zisk" : "Strata"}:{" "}
                        {formatCurrency(Math.max(0, Math.abs(zisk)))}
                      </div>
                    )}
                    {!hideDebts && data.dlhy > 0 && (
                      <div style={{ color: "#ef4444", marginTop: "2px" }}>
                        Dlhy: {formatCurrency(Math.max(0, data.dlhy))}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{
                fontSize: "12px",
                paddingTop: "12px",
                paddingLeft: "70px", // YAxis width (60) + left margin (10)
                paddingRight: "20px", // right margin
              }}
              verticalAlign="bottom"
            />

            {/* Majetková krivka (zelená - rast od 0) */}
            <Line
              type="monotone"
              dataKey="majetok"
              stroke="#10b981"
              strokeWidth={2.5}
              name="Majetok (očakávaný)"
              dot={false}
              isAnimationActive={false}
            />

            {/* Dlhová krivka (červená - pokles od sumy dlhu) - skryť v BASIC režime alebo ak nie sú dlhy */}
            {!hideDebts && (debts || []).length > 0 && (
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
                  position: "insideTopRight",
                  fill: "#22d3ee",
                  fontSize: 11,
                  offset: 5,
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
