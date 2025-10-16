import React from "react";

export const TopHoldings: React.FC<{
  mix: Record<string, number>;
  onClickAsset?: (k: string) => void;
}> = ({ mix, onClickAsset }) => {
  const items = Object.entries(mix)
    .filter(([, v]) => (v || 0) > 0)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, 3);
  if (!items.length) return null;
  return (
    <div className="hidden md:block mt-2 text-[12px] text-slate-200">
      <div className="text-slate-400 mb-1">Top podiely</div>
      <ul className="flex flex-wrap gap-1.5">
        {items.map(([k, v]) => (
          <li key={k}>
            <span
              role="button"
              tabIndex={0}
              data-testid="top-holding-chip"
              onClick={() => onClickAsset?.(k)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClickAsset?.(k);
                }
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] bg-slate-600/20 text-slate-300 border border-slate-500/40 hover:bg-slate-600/30 focus:outline-none focus:ring-1 focus:ring-slate-400/40 cursor-pointer select-none"
              aria-label={`Top podiel: ${k} ${v}%`}
            >
              <span className="font-medium">{k}</span>
              <span className="text-slate-400">{v.toFixed(1)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
