import React from "react";
import type { MixItem } from "../persist/v3";
import { TEST_IDS } from "../testIds";

interface InfoMixLineProps {
  mix: MixItem[];
}

const ASSET_LABELS: Record<
  string,
  { icon: string; name: string; order: number }
> = {
  gold: { icon: "🟡", name: "Zlato", order: 1 },
  etf: { icon: "📊", name: "ETF svet", order: 2 },
  dyn: { icon: "🔄", name: "Dyn. riadenie", order: 3 },
  bonds: { icon: "📈", name: "Dlhopis 7.5%", order: 4 },
  bond3y9: { icon: "📈", name: "Dlhopis 9%", order: 5 },
  cash: { icon: "💵", name: "IAD depozitné konto", order: 6 },
  crypto: { icon: "₿", name: "Krypto", order: 7 },
  real: { icon: "🏢", name: "Reality", order: 8 },
  other: { icon: "📦", name: "Ostatné", order: 9 },
};

export function InfoMixLine({ mix }: InfoMixLineProps) {
  // Defensive guard: mix môže byť undefined v testoch
  if (!Array.isArray(mix) || mix.length === 0) return null;

  // Filter out 0% assets
  const activeAssets = mix
    .filter((item) => item.pct > 0)
    .map((item) => ({
      ...item,
      label: ASSET_LABELS[item.key] || {
        icon: "📦",
        name: item.key,
        order: 99,
      },
    }))
    .sort((a, b) => a.label.order - b.label.order);

  if (activeAssets.length === 0) return null;

  return (
    <div
      data-testid={TEST_IDS.MIXLINE}
      className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 max-sm:leading-relaxed"
    >
      {activeAssets.map((asset, idx) => (
        <React.Fragment key={asset.key}>
          {idx > 0 && <span className="text-slate-400">|</span>}
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true">{asset.label.icon}</span>
            <span className="font-medium">{asset.label.name}</span>
            <span className="text-slate-500">{asset.pct.toFixed(0)}%</span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}
