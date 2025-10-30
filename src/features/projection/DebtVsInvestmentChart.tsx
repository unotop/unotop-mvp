/**
 * PR-4 Task 8: DebtVsInvestmentChart
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
import { calculateFutureValue } from "../../engine/calculations";
import { approxYieldAnnualFromMix, type RiskPref } from "../mix/assetModel";
import type { MixItem } from "../mix/mix.service";
import type { Debt } from "../../persist/v3";
import { buildAmortSchedule } from "../../domain/amortization";

interface DebtVsInvestmentChartProps {
  mix: MixItem[];
  debts: Debt[];
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  riskPref: RiskPref;
}

interface DataPoint {
  year: number;
  investicia: number;
  dlh: number;
}

export const DebtVsInvestmentChart: React.FC<DebtVsInvestmentChartProps> = ({
  mix,
  debts,
  lumpSumEur,
  monthlyVklad,
  horizonYears,
  riskPref,
}) => {
  // Ak žiadne dlhy, nezobraziť
  if (!debts || debts.length === 0) {
    return null;
  }

  // Výpočet investície (ročne)
  const approxYield = approxYieldAnnualFromMix(mix, riskPref);
  const dataPoints: DataPoint[] = [];

  // Total debt balance v každom roku
  const getTotalDebtAtYear = (year: number): number => {
    return debts.reduce((sum, debt) => {
      const termMonths = debt.monthsLeft || 0;
      const targetMonth = year * 12;

      if (targetMonth >= termMonths) {
        return sum; // Dlh už splatený
      }

      // Build amortization schedule
      const schedule = buildAmortSchedule({
        principal: debt.principal,
        ratePa: debt.ratePa / 100, // % → decimal
        termMonths,
        monthlyPayment: debt.monthly - (debt.extraMonthly || 0), // Base payment
        extraMonthly: debt.extraMonthly || 0,
      });

      // Get balance at target month
      const monthData = schedule.months[targetMonth];
      return sum + (monthData?.balance || 0);
    }, 0);
  };

  // Generuj data body pre každý rok
  for (let year = 0; year <= horizonYears; year++) {
    const investmentFV = calculateFutureValue(
      lumpSumEur,
      monthlyVklad,
      year,
      approxYield
    );
    const debtBalance = getTotalDebtAtYear(year);

    dataPoints.push({
      year,
      investicia: Math.round(investmentFV),
      dlh: Math.round(debtBalance),
    });
  }

  // Nájdi crossover point (prvý rok kde investicia >= dlh a dlh > 0)
  const crossoverYear = dataPoints.find(
    (p, i) => i > 0 && p.investicia >= p.dlh && p.dlh > 0
  )?.year;

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
