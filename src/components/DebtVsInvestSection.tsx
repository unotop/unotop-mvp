import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { buildAmortSchedule } from "../domain/amortization";
import {
  selectPortfolioFVOverTime,
  firstCrossoverIndex,
} from "../selectors/portfolio";
import { euro } from "../utils/number";

export type Debt = import("../domain/debts").Debt;

export const DebtVsInvestSection: React.FC<{
  debts: Debt[];
  years: number;
  lumpSum: number;
  monthlyContrib: number;
  erPa: number;
  extraMonthly: number;
  extraOnce: number;
  extraOnceAtMonth: number;
  onExtraMonthly: (n: number) => void;
  onExtraOnce: (n: number) => void;
  onExtraOnceAtMonth: (n: number) => void;
  mergePreview: boolean;
  onMergePreview: (v: boolean) => void;
}> = ({
  debts,
  years,
  lumpSum,
  monthlyContrib,
  erPa,
  extraMonthly,
  extraOnce,
  extraOnceAtMonth,
  onExtraMonthly,
  onExtraOnce,
  onExtraOnceAtMonth,
  mergePreview,
  onMergePreview,
}) => {
  const mortgages = debts.filter((d) => d.type === "hypoteka");
  if (!mortgages.length) return null;

  const portfolio = useMemo(
    () => selectPortfolioFVOverTime(years, lumpSum, monthlyContrib, erPa),
    [years, lumpSum, monthlyContrib, erPa]
  );

  const schedules = useMemo(() => {
    const arr = mortgages.map((m) =>
      buildAmortSchedule({
        principal: Math.max(0, m.balance || 0),
        ratePa: Math.max(0, m.rate_pa || 0),
        termMonths: Math.max(0, m.months_remaining || 0),
        monthlyPayment: Math.max(0, m.monthly_payment || 0),
        extraMonthly: Math.max(0, extraMonthly || 0),
        extraOnce: Math.max(0, extraOnce || 0),
        extraOnceAtMonth: Math.max(0, extraOnceAtMonth || 0),
      })
    );
    if (!mergePreview || arr.length === 1) return arr;
    // Merge preview: sum balances and weight interest; we reuse first schedule months as baseline
    const maxLen = Math.max(...arr.map((r) => r.months.length));
    const merged = new Array(maxLen).fill(null).map((_, i) => ({
      month: i + 1,
      balance: arr.reduce((s, r) => s + (r.months[i]?.balance || 0), 0),
    }));
    return [
      {
        months: merged as any,
        negativeAmort: arr.some((r) => r.negativeAmort),
      } as any,
    ];
  }, [mortgages, extraMonthly, extraOnce, extraOnceAtMonth, mergePreview]);

  // Prepare combined chart data (month-indexed)
  const maxMonths = Math.max(
    portfolio.length,
    ...schedules.map((s) => s.months.length)
  );
  const data = new Array(maxMonths).fill(0).map((_, i) => ({
    month: i === 0 ? 1 : i, // ensure first visible tick is 1
    fv: portfolio[i]?.value ?? portfolio.at(-1)?.value ?? 0,
    balance: schedules.reduce((s, r) => s + (r.months[i]?.balance ?? 0), 0),
  }));

  const crossMonth = firstCrossoverIndex(
    data.map((d) => ({ month: d.month, value: d.fv })),
    data.map((d) => ({ month: d.month, balance: d.balance }))
  );

  return (
    <section
      className="rounded-xl border border-slate-800 bg-slate-950/60"
      role="region"
      aria-labelledby="sec6"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <h2 id="sec6" className="text-sm font-semibold">
          Hypotéka vs. investície
        </h2>
      </div>
      <div className="p-3 space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pb-1">
          <label className="flex items-center gap-2">
            <span>Extra mesačný vklad (€)</span>
            <input
              aria-label="Extra mesačný vklad (€)"
              type="number"
              className="w-28 bg-slate-900 border border-slate-700 rounded px-2 py-1"
              value={extraMonthly}
              onChange={(e) => onExtraMonthly(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2">
            <span>Jednorazový extra vklad (€)</span>
            <input
              aria-label="Jednorazový extra vklad (€)"
              type="number"
              className="w-28 bg-slate-900 border border-slate-700 rounded px-2 py-1"
              value={extraOnce}
              onChange={(e) => onExtraOnce(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2">
            <span>Mesiac vykonania</span>
            <input
              aria-label="Mesiac vykonania extra vkladu"
              type="number"
              className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1"
              value={extraOnceAtMonth}
              onChange={(e) => onExtraOnceAtMonth(Number(e.target.value))}
            />
          </label>
        </div>

        <div aria-describedby="sec6-note" className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 10, right: 10, bottom: 10, left: 0 }}
            >
              <XAxis dataKey="month" tickFormatter={(v) => `${v}`} />
              <YAxis
                tickFormatter={(v) => euro(Number(v), 0)}
                width={70}
                domain={[0, "dataMax"]}
              />
              <Tooltip
                formatter={(v: any) => euro(Number(v), 0)}
                labelFormatter={(l: any) => `Mesiac ${l}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="balance"
                name="Zostatok hypotéky"
                stroke="#60a5fa"
                dot={false}
                strokeWidth={1.6}
              />
              <Line
                type="monotone"
                dataKey="fv"
                name="Hodnota portfólia"
                stroke="#34d399"
                dot={false}
                strokeWidth={1.6}
              />
              {typeof crossMonth === "number" && (
                <ReferenceLine
                  x={crossMonth}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  label={{ position: "top", value: "Prelomenie" }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Accessible labels for series names */}
        <ul className="sr-only">
          <li>Zostatok hypotéky</li>
          <li>Hodnota portfólia</li>
        </ul>

        <div id="sec6-note" className="text-slate-300">
          {typeof crossMonth === "number" ? (
            <span>
              Pri zadanom nastavení dosiahne portfólio hodnotu zostatku hypotéky
              v mesiaci {crossMonth} (≈ {crossMonth} mes.).
            </span>
          ) : (
            <span>
              Pri tomto nastavení portfólio nedosiahne zostatok v sledovanom
              horizonte.
            </span>
          )}
        </div>

        {mortgages.length > 1 && (
          <div className="mt-2 p-2 rounded border border-slate-700 bg-slate-900/60">
            <div className="flex items-center justify-between">
              <div className="font-medium">Náhľad refinancovania</div>
              <label className="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={mergePreview}
                  onChange={(e) => onMergePreview(e.target.checked)}
                />
                <span>Zlúčiť v náhľade</span>
              </label>
            </div>
            <div className="text-[11px] text-slate-400">
              Súčet istín:{" "}
              {euro(
                mortgages.reduce((s, m) => s + (m.balance || 0), 0),
                0
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
