/**
 * PR-4 Task 8: DebtVsInvestmentChart
 * PR-6 Task D: Refactored to accept pre-calculated series (from useProjection hook)
 *
 * Recharts-based chart showing:
 * - Investment growth (FV over time)
 * - Debt remaining balance (amortization)
 * - Crossover point (where investment >= debt)
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

interface DataPoint {
  year: number;
  investicia: number;
  dlh: number;
}

interface DebtVsInvestmentChartProps {
  fvSeries: number[]; // Ročné FV hodnoty [year0, year1, ..., yearN] (z useProjection)
  debtSeries: number[]; // Ročné debt zostatky [year0, year1, ..., yearN] (z useProjection)
  crossoverIndex: number | null; // Rok kedy investícia >= dlh (null ak nikdy)
}

export const DebtVsInvestmentChart: React.FC<DebtVsInvestmentChartProps> = ({
  fvSeries,
  debtSeries,
  crossoverIndex,
}) => {
  // Ak žiadne dlhy alebo prázdne series, nezobraziť
  if (
    !debtSeries ||
    debtSeries.length === 0 ||
    !fvSeries ||
    fvSeries.length === 0
  ) {
    return null;
  }

  // Build data points from series
  const dataPoints: DataPoint[] = [];
  const maxYears = Math.max(fvSeries.length, debtSeries.length);

  for (let year = 0; year < maxYears; year++) {
    dataPoints.push({
      year,
      investicia: fvSeries[year] || 0,
      dlh: debtSeries[year] || 0,
    });
  }

  // PR-6 Task D: crossoverIndex je už vypočítané v useProjection hook
  const crossoverYear = crossoverIndex;

  // Max value pre Y axis
  const maxValue = Math.max(
    ...dataPoints.map((p) => Math.max(p.investicia, p.dlh))
  );

  return (
    <div className="w-full">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-300">
          Investícia vs. Dlh
        </h4>
        {crossoverYear && (
          <p className="text-xs text-amber-400 mt-1">
            🎯 Priesečník v roku {crossoverYear} — investícia prekročí dlh
          </p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={dataPoints}
          margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
          <XAxis
            dataKey="year"
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            label={{
              value: "Rok",
              position: "insideBottom",
              offset: -5,
              style: { fill: "#94a3b8", fontSize: 12 },
            }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
            domain={[0, maxValue * 1.1]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #475569",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#cbd5e1" }}
            formatter={(value: number) => [
              `${value.toLocaleString("sk-SK")} €`,
              "",
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
            iconType="line"
          />

          {/* Crossover marker */}
          {crossoverYear && (
            <ReferenceLine
              x={crossoverYear}
              stroke="#fbbf24"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: `Rok ${crossoverYear}`,
                position: "top",
                fill: "#fbbf24",
                fontSize: 11,
              }}
            />
          )}

          {/* Lines */}
          <Line
            type="monotone"
            dataKey="investicia"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            name="Investícia"
          />
          <Line
            type="monotone"
            dataKey="dlh"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            name="Zostatok dlhu"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
