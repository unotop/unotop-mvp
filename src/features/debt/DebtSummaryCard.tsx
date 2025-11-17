/**
 * PR-13 Task 2: DebtSummaryCard - refactor na list view
 *
 * Zobrazuje každý dlh osobitne s ikonou typu, detailmi a tlačidlami edit/delete.
 * Používa useProjection hook pre konzistentný výpočet vyplatenia.
 */

import React from "react";
import type { Debt } from "../../persist/v3";
import { useProjection } from "../projection/useProjection";
import { readV3 } from "../../persist/v3";
import type { RiskPref } from "../mix/assetModel";
import type { MixItem } from "../mix/mix.service";

interface DebtSummaryCardProps {
  debts: Debt[];
  onEdit?: (debt: Debt) => void;
  onDelete?: (debtId: string) => void;
  // PR-13 Fix: Prijímať crossoverIndex zvonku (aby reagovalo na zmeny)
  crossoverIndex?: number | null;
}

export const DebtSummaryCard: React.FC<DebtSummaryCardProps> = ({
  debts,
  onEdit,
  onDelete,
  crossoverIndex: externalCrossoverIndex,
}) => {
  if (debts.length === 0) return null;

  // PR-13 Fix: Použiť props ak existuje, inak fallback na useProjection
  const v3 = readV3();
  const profile = v3.profile || {};

  const projection = useProjection({
    lumpSumEur: profile.lumpSumEur || 0,
    monthlyVklad: (v3 as any).monthly || 0,
    horizonYears: profile.horizonYears || 10,
    goalAssetsEur: profile.goalAssetsEur || 0,
    mix: (v3.mix || []) as MixItem[],
    debts,
    riskPref: (profile.riskPref as RiskPref) || "vyvazeny",
  });

  const crossoverIndex = externalCrossoverIndex ?? projection.crossoverIndex;

  // Celková mesačná splátka
  const totalMonthly = debts.reduce((sum, d) => sum + (d.monthly || 0), 0);

  // PR-13 Fix: Formátovanie crossover roku (nie mesiaca payoff)
  const formatEarlyPayoffYear = (yearIndex: number | null): string => {
    if (yearIndex === null) return "—";
    const now = new Date();
    const targetYear = now.getFullYear() + yearIndex;
    return `${targetYear}`;
  };

  // Ikona podľa typu
  const getDebtIcon = (type?: "mortgage" | "consumer"): string => {
    if (type === "mortgage") return "🏠";
    if (type === "consumer") return "💳";
    return "💰";
  };

  return (
    <div className="mt-4 p-4 rounded-xl ring-1 ring-white/5 bg-slate-900/40 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <span>💰</span>
          <span>Súhrn dlhov ({debts.length})</span>
        </h4>
      </div>

      {/* Zoznam dlhov */}
      <div className="space-y-3">
        {debts.map((debt) => (
          <div
            key={debt.id}
            className="p-3 rounded-lg bg-slate-800/50 ring-1 ring-white/5 hover:ring-white/10 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              {/* Ľavá strana - Info */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getDebtIcon(debt.type)}</span>
                  <span className="font-medium text-white">{debt.name}</span>
                  {debt.type && (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                      {debt.type === "mortgage" ? "Hypotéka" : "Spotrebný"}
                    </span>
                  )}
                </div>

                {/* Detaily */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <div className="text-slate-500">Zostatok</div>
                    <div className="font-semibold text-white tabular-nums">
                      {debt.principal?.toLocaleString("sk-SK")} €
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Splátka/mes.</div>
                    <div className="font-semibold text-white tabular-nums">
                      {debt.monthly?.toFixed(0)} €
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Úrok p.a.</div>
                    <div className="font-semibold text-emerald-400 tabular-nums">
                      {debt.ratePa?.toFixed(1)} %
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Zostáva</div>
                    <div className="font-semibold text-slate-300 tabular-nums">
                      {debt.monthsLeft
                        ? `${Math.round(debt.monthsLeft / 12)} r.`
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* Extra splátka (ak je) */}
                {debt.extraMonthly && debt.extraMonthly > 0 && (
                  <div className="text-xs text-amber-400">
                    💡 +{debt.extraMonthly.toFixed(0)} € extra mesačne
                  </div>
                )}
              </div>

              {/* Pravá strana - Akcie */}
              <div className="flex flex-col gap-2">
                {onEdit && (
                  <button
                    onClick={() => onEdit(debt)}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                    title="Upraviť"
                    aria-label={`Upraviť dlh ${debt.name}`}
                  >
                    ✏️
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(debt.id)}
                    className="p-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-colors"
                    title="Zmazať"
                    aria-label={`Zmazať dlh ${debt.name}`}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sumár */}
      <div className="pt-3 border-t border-white/5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {/* Celková mesačná splátka */}
          <div>
            <div className="text-xs text-slate-500">Celková splátka/mes.</div>
            <div className="text-base font-bold text-white tabular-nums">
              {totalMonthly.toFixed(2)} €
            </div>
          </div>

          {/* Predčasné vyplatenie úverov - crossover */}
          <div>
            <div className="text-xs text-slate-500">
              Predčasné vyplatenie úverov
            </div>
            <div className="text-base font-bold text-slate-300 tabular-nums">
              {formatEarlyPayoffYear(crossoverIndex)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
