import React from "react";
import { formatMoneySk } from "../utils/format";

export const FVHighlightCard: React.FC<{
  fvValue: number;
  goal: number;
  onClick?: () => void;
}> = ({ fvValue, goal, onClick }) => {
  const ratio = goal > 0 ? Math.max(0, Math.min(1, fvValue / goal)) : 0;
  const pct = Math.round(ratio * 100);
  return (
    <div
      data-testid="fv-highlight-card"
      className="mt-3 p-3 rounded border border-slate-700 bg-slate-900/60 text-[12px] text-slate-200"
      role="region"
      aria-labelledby="fv-highlight-h"
      onClick={onClick}
    >
      <div id="fv-highlight-h" className="font-medium mb-1">
        Odhadovaný budúci majetok
      </div>
      <div className="text-2xl sm:text-3xl font-semibold font-mono font-tabular-nums text-slate-100">
        {formatMoneySk(Math.max(0, fvValue))}
      </div>
      {goal > 0 && (
        <div className="mt-2">
          <div className="text-[11px] text-slate-400" aria-live="polite">
            Plnenie cieľa: {pct} %
          </div>
          <div
            className="h-2 rounded bg-slate-800 overflow-hidden mt-1"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            data-testid="fv-progress"
          >
            <div
              className="h-full bg-emerald-500/70"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
