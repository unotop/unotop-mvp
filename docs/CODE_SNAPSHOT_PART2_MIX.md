# UNOTOP MVP - Kompletný Kód Snapshot (Časť 2: Mix & Asset Model)

**Pokračovanie z časti 1...**

---

## 5. MIX LOGIC (Servisy a modely)

### src/features/mix/mix.service.ts

```typescript
export type MixItem = {
  key:
    | "gold"
    | "dyn"
    | "etf"
    | "bonds"
    | "cash"
    | "crypto"
    | "real"
    | "bond3y9";
  pct: number;
};

export function sum(list: MixItem[]) {
  return +list.reduce((a, b) => a + b.pct, 0).toFixed(2);
}

export function normalize(list: MixItem[]): MixItem[] {
  const s = sum(list) || 1;
  const out = list.map((i) => ({ ...i, pct: +((i.pct / s) * 100).toFixed(2) }));
  const diff = +(100 - sum(out)).toFixed(2);
  if (Math.abs(diff) > 0)
    out[out.length - 1] = {
      ...out[out.length - 1],
      pct: +(out[out.length - 1].pct + diff).toFixed(2),
    };
  return out;
}

export function setGoldTarget(list: MixItem[], target: number): MixItem[] {
  const gold = list.find((i) => i.key === "gold");
  if (!gold) return list;
  const others = list.filter((i) => i.key !== "gold");
  const remaining = Math.max(0, 100 - target);
  const otherSum = others.reduce((a, b) => a + b.pct, 0) || 1;
  const redistributed = others.map((o) => ({
    ...o,
    pct: +((o.pct / otherSum) * remaining).toFixed(2),
  }));
  return normalize([{ ...gold, pct: target }, ...redistributed]);
}

export function chipsFromState(list: MixItem[]): string[] {
  const gold = list.find((i) => i.key === "gold")?.pct || 0;
  const dyn = list.find((i) => i.key === "dyn")?.pct || 0;
  const crypto = list.find((i) => i.key === "crypto")?.pct || 0;
  const s = sum(list);
  const chips: string[] = [];
  if (gold >= 12) chips.push("Zlato dorovnané");
  if (dyn + crypto > 22) chips.push("Dyn+Krypto obmedzené");
  if (Math.abs(s - 100) < 0.01) chips.push("Súčet dorovnaný");
  // Risk cap chip
  try {
    const raw =
      localStorage.getItem("unotop:v3") || localStorage.getItem("unotop_v3");
    if (raw) {
      const parsed = JSON.parse(raw);
      const pref: string | undefined =
        parsed?.profile?.riskPref || parsed?.riskPref;
      const capMap: Record<string, number> = {
        konzervativny: 4.0,
        vyvazeny: 6.0,
        rastovy: 7.5,
      };
      const cap = capMap[pref || "vyvazeny"];
      const score = riskScore(list);
      if (score > cap) chips.push("⚠️ Nad limit rizika");
    }
  } catch {}
  return Array.from(new Set(chips));
}

// Simple risk scoring: weight dynamic + crypto + etf as higher risk
export function riskScore(list: MixItem[]): number {
  const dyn = list.find((i) => i.key === "dyn")?.pct || 0;
  const crypto = list.find((i) => i.key === "crypto")?.pct || 0;
  const etf = list.find((i) => i.key === "etf")?.pct || 0;
  // weights: dyn 0.15, crypto 0.25, etf 0.10; sum approximates risk index
  return +(dyn * 0.15 + crypto * 0.25 + etf * 0.1).toFixed(2);
}

export function applyRiskConstrainedMix(
  list: MixItem[],
  cap: number
): MixItem[] {
  let current = [...list];
  let score = riskScore(current);
  if (score <= cap) return normalize(current);
  // Identify risk components
  const riskKeys: MixItem["key"][] = ["dyn", "crypto", "etf"];
  const riskItems = current.filter((i) => riskKeys.includes(i.key));
  const safeItems = current.filter((i) => !riskKeys.includes(i.key));
  let riskSum = riskItems.reduce((a, b) => a + b.pct, 0) || 1;
  // Iteratively scale down risk block until score <= cap or minimal
  for (let iter = 0; iter < 10 && score > cap; iter++) {
    const factor = Math.max(0, cap / score); // target proportional factor
    riskItems.forEach((r) => {
      r.pct = +(r.pct * factor).toFixed(2);
    });
    // redistribute freed percentage to safe items proportionally
    const newRiskSum = riskItems.reduce((a, b) => a + b.pct, 0);
    const freed = Math.max(0, riskSum - newRiskSum);
    const safeSum = safeItems.reduce((a, b) => a + b.pct, 0) || 1;
    safeItems.forEach((s) => {
      s.pct = +(s.pct + (s.pct / safeSum) * freed).toFixed(2);
    });
    current = [...riskItems, ...safeItems];
    current = normalize(current);
    score = riskScore(current);
    riskSum = riskItems.reduce((a, b) => a + b.pct, 0) || 1;
  }
  return normalize(current);
}
```

### src/features/mix/assetModel.ts (PLNÝ SÚBOR)

```typescript
/**
 * assetModel.ts - Centrálny zdroj pravdy pre výnosy a riziká aktív
 * Všetky výnosy sú p.a. (per annum), riziko je 0-10 škála
 */

import type { MixItem } from "./mix.service";

export type RiskPref = "konzervativny" | "vyvazeny" | "rastovy";
export type AssetKey = MixItem["key"];

/**
 * Výnosy p.a. pre každé aktívum × profil
 */
const ASSET_YIELDS: Record<
  AssetKey,
  { konzervativny: number; vyvazeny: number; rastovy: number }
> = {
  etf: { konzervativny: 0.09, vyvazeny: 0.14, rastovy: 0.18 },
  gold: { konzervativny: 0.07, vyvazeny: 0.095, rastovy: 0.11 },
  crypto: { konzervativny: 0.12, vyvazeny: 0.2, rastovy: 0.35 },
  dyn: {
    konzervativny: Math.pow(1 + 0.02, 12) - 1, // ~26.82 %
    vyvazeny: Math.pow(1 + 0.03, 12) - 1, // ~42.58 %
    rastovy: Math.pow(1 + 0.04, 12) - 1, // ~60.10 %
  },
  bonds: { konzervativny: 0.075, vyvazeny: 0.075, rastovy: 0.075 },
  bond3y9: { konzervativny: 0.09, vyvazeny: 0.09, rastovy: 0.09 },
  cash: { konzervativny: 0.0, vyvazeny: 0.0, rastovy: 0.0 },
  real: { konzervativny: 0.075, vyvazeny: 0.087, rastovy: 0.095 },
};

/**
 * Riziko 0-10 pre každé aktívum × profil
 */
const ASSET_RISKS: Record<
  AssetKey,
  { konzervativny: number; vyvazeny: number; rastovy: number }
> = {
  etf: { konzervativny: 5, vyvazeny: 5, rastovy: 6 },
  gold: { konzervativny: 2, vyvazeny: 2, rastovy: 3 },
  crypto: { konzervativny: 9, vyvazeny: 9, rastovy: 9 },
  dyn: { konzervativny: 8, vyvazeny: 9, rastovy: 9 },
  bonds: { konzervativny: 2, vyvazeny: 2, rastovy: 2 },
  bond3y9: { konzervativny: 2, vyvazeny: 2, rastovy: 2 },
  cash: { konzervativny: 2, vyvazeny: 2, rastovy: 2 },
  real: { konzervativny: 4, vyvazeny: 4, rastovy: 5 },
};

export const RISK_CAPS: Record<RiskPref, number> = {
  konzervativny: 4.0,
  vyvazeny: 6.0,
  rastovy: 7.5,
};

export function getAssetYield(key: AssetKey, riskPref: RiskPref): number {
  return ASSET_YIELDS[key]?.[riskPref] ?? 0.04;
}

export function getAssetRisk(
  key: AssetKey,
  riskPref: RiskPref,
  crisisBias = 0
): number {
  const baseRisk = ASSET_RISKS[key]?.[riskPref] ?? 5;
  if (crisisBias > 0 && (key === "crypto" || key === "dyn")) {
    return Math.min(10, baseRisk + crisisBias);
  }
  return baseRisk;
}

export function getScaledRisk(
  assetKey: AssetKey,
  allocationPct: number,
  baseRisk: number
): number {
  if (assetKey === "dyn") {
    if (allocationPct <= 11) return baseRisk;
    if (allocationPct <= 21) return baseRisk + 2;
    if (allocationPct <= 31) return baseRisk + 4;
    const excess = allocationPct - 31;
    return Math.min(15, baseRisk + 4 + excess * 0.5);
  }

  if (allocationPct <= 30) return baseRisk;
  if (allocationPct <= 40) return baseRisk + 2;
  const excess = allocationPct - 40;
  return Math.min(15, baseRisk + 4 + excess * 0.3);
}

export function approxYieldAnnualFromMix(
  mix: MixItem[],
  riskPref: RiskPref
): number {
  if (!Array.isArray(mix) || mix.length === 0) return 0.04;
  const totalPct = mix.reduce((sum, m) => sum + m.pct, 0);
  if (totalPct < 1) return 0.04;

  let weightedYield = 0;
  for (const item of mix) {
    const weight = item.pct / 100;
    const yield_pa = getAssetYield(item.key, riskPref);
    weightedYield += weight * yield_pa;
  }
  return weightedYield;
}

export function riskScore0to10(
  mix: MixItem[],
  riskPref: RiskPref,
  crisisBias = 0
): number {
  if (!Array.isArray(mix) || mix.length === 0) return 5.0;
  const totalPct = mix.reduce((sum, m) => sum + m.pct, 0);
  if (totalPct < 1) return 5.0;

  const dynPct = mix.find((m) => m.key === "dyn")?.pct ?? 0;
  const cryptoPct = mix.find((m) => m.key === "crypto")?.pct ?? 0;
  const penalty = dynPct + cryptoPct > 22 ? 1 : 0;
  const effectiveBias = crisisBias + penalty;

  let weightedRisk = 0;
  for (const item of mix) {
    const weight = item.pct / 100;
    const baseRisk = getAssetRisk(item.key, riskPref, effectiveBias);
    const scaledRisk = getScaledRisk(item.key, item.pct, baseRisk);
    weightedRisk += weight * scaledRisk;
  }
  return Math.min(10, Math.max(0, weightedRisk));
}

export function getRiskCap(riskPref: RiskPref): number {
  return RISK_CAPS[riskPref];
}
```

---

## 6. KOMPONENTY (UI building blocks)

### src/components/Toolbar.tsx

```tsx
import React from "react";

interface ToolbarProps {
  onMenuToggle: () => void;
  modeUi: "BASIC" | "PRO";
  onModeToggle: () => void;
  onReset?: () => void;
  onShare?: () => void;
  canShare?: boolean;
  onTourRestart?: () => void;
}

export default function Toolbar({
  onMenuToggle,
  modeUi,
  onModeToggle,
  onReset,
  onShare,
  canShare,
  onTourRestart,
}: ToolbarProps) {
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  React.useEffect(() => {
    if (!showResetConfirm) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-reset-popover]")) {
        setShowResetConfirm(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showResetConfirm]);

  return (
    <header
      className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-white/10"
      role="banner"
    >
      <div className="max-w-[1320px] mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Hamburger + Logo + App Name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onMenuToggle}
            aria-label="Otvoriť menu"
            className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <img
              src="/unotop_logo.png"
              alt="UNOTOP logo"
              className="h-7 sm:h-8 w-auto flex-shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-base sm:text-lg font-bold tracking-tight text-slate-100 truncate">
                UNOTOP
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 -mt-0.5 sm:-mt-1 hidden xs:block">
                Váš investičný plánovač
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Reset Button */}
          {onReset && (
            <div className="relative flex-shrink-0" data-reset-popover>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 ring-1 ring-red-500/30 hover:ring-red-500/50 transition-all text-xs font-medium"
                aria-label="Resetovať nastavenie"
              >
                <svg
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="hidden sm:inline ml-1">Reset</span>
              </button>
              {showResetConfirm && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 rounded-lg shadow-xl ring-1 ring-white/10 p-4 z-50">
                  <div className="text-sm mb-3">
                    <div className="font-semibold text-red-400 mb-1">
                      ⚠️ Resetovať nastavenie?
                    </div>
                    <div className="text-slate-400 text-xs">
                      Vymažú sa všetky uložené údaje.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onReset();
                        setShowResetConfirm(false);
                      }}
                      className="flex-1 px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-medium"
                    >
                      Áno, vymazať
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium"
                    >
                      Zrušiť
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode Toggle */}
          <button
            type="button"
            onClick={onModeToggle}
            className="px-2 sm:px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-medium transition-colors flex items-center gap-1"
            aria-label={`Prepnúť na ${modeUi === "BASIC" ? "PRO" : "BASIC"} režim`}
          >
            <span className="hidden sm:inline">
              {modeUi === "BASIC" ? "PRO" : "BASIC"}
            </span>
            <span className="sm:hidden">
              {modeUi === "BASIC" ? "🔬" : "🎯"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
```

---

**Pokračovanie v časti 3...**
