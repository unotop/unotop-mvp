import React from "react";
import { writeV3, readV3 } from "../../persist/v3";
import { useUncontrolledValueInput } from "../_hooks/useUncontrolledValueInput";
import { calculateFutureValue } from "../../engine/calculations";
import { approxYieldAnnualFromMix } from "../mix/assetModel";
import type { MixItem } from "../mix/mix.service";

interface InvestSectionProps {
  open: boolean;
  onToggle: () => void;
}

/**
 * InvestSection (sec2: Investičné nastavenia)
 * Investment parameters: lump sum, monthly contribution, horizon, goal
 */
export const InvestSection: React.FC<InvestSectionProps> = ({
  open,
  onToggle,
}) => {
  const seed = readV3();

  // Local state (synced to persist)
  const [lumpSumEur, setLumpSumEur] = React.useState(
    () => (seed.profile?.lumpSumEur as any) || 0
  );
  const [horizonYears, setHorizonYears] = React.useState(
    () => (seed.profile?.horizonYears as any) || 10
  );
  const [goalAssetsEur, setGoalAssetsEur] = React.useState(
    () => (seed.profile?.goalAssetsEur as any) || 0
  );

  // Uncontrolled hooks for text inputs (debounced persist)
  const lumpSumCtl = useUncontrolledValueInput({
    initial: lumpSumEur,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, n),
    commit: (n) => {
      setLumpSumEur(n);
      const cur = readV3();
      writeV3({ profile: { ...(cur.profile || {}), lumpSumEur: n } as any });
    },
  });

  const horizonCtl = useUncontrolledValueInput({
    initial: horizonYears,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(1, Math.min(50, n)),
    commit: (n) => {
      setHorizonYears(n);
      const cur = readV3();
      writeV3({ profile: { ...(cur.profile || {}), horizonYears: n } as any });
    },
  });

  const goalCtl = useUncontrolledValueInput({
    initial: goalAssetsEur,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, n),
    commit: (n) => {
      setGoalAssetsEur(n);
      const cur = readV3();
      writeV3({ profile: { ...(cur.profile || {}), goalAssetsEur: n } as any });
    },
  });

  // Recommendation logic: "Zvýš vklad"
  const renderRecommendation = () => {
    const lump = lumpSumEur || 0;
    const v3 = readV3();
    const monthly = (v3 as any).monthly || 0;
    const years = horizonYears || 10;
    const goal = goalAssetsEur || 0;

    if (goal <= 0) return null;

    const mix = (v3.mix || [
      { key: "gold", pct: 12 },
      { key: "dyn", pct: 20 },
      { key: "etf", pct: 40 },
      { key: "bonds", pct: 20 },
      { key: "cash", pct: 5 },
      { key: "crypto", pct: 2 },
      { key: "real", pct: 1 },
    ]) as MixItem[];

    const riskPref = (v3.profile?.riskPref ||
      (v3 as any).riskPref ||
      "vyvazeny") as "konzervativny" | "vyvazeny" | "rastovy";
    const approx = approxYieldAnnualFromMix(mix, riskPref);
    const fv = calculateFutureValue(lump, monthly, years, approx);

    if (fv >= goal) return null;

    // Calculate recommended monthly to hit goal
    const fvLump = lump * Math.pow(1 + approx, years);
    const diff = goal - fvLump;
    let recommended = 0;

    if (approx > 0) {
      const factor = 12 * ((Math.pow(1 + approx, years) - 1) / approx);
      recommended = diff / factor;
    } else {
      recommended = diff / (12 * years);
    }

    recommended = Math.max(0, Math.ceil(recommended));

    return (
      <div
        className="mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-xs text-amber-300"
        role="status"
        aria-live="polite"
      >
        ⚠️ Nedosiahnete cieľ (odhad {fv.toFixed(0)} € vs. cieľ {goal.toFixed(0)}{" "}
        €).
        <button
          type="button"
          className="ml-2 px-2 py-1 rounded bg-amber-600 text-white text-xs hover:bg-amber-700 transition-colors"
          onClick={() => {
            const cur = readV3();
            writeV3({
              profile: {
                ...(cur.profile || {}),
                monthlyVklad: recommended,
              } as any,
              monthly: recommended,
            });
            // Note: No local state update needed (read from v3)
          }}
        >
          Zvýš vklad na {recommended} €/mes.
        </button>
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        aria-controls="sec2"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-3 rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors text-left font-semibold"
      >
        <span id="invest-title">Investičné nastavenia</span>
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${open ? "" : "rotate-180"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <section
          id="sec2"
          role="region"
          aria-labelledby="invest-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5 transition-all duration-300"
        >
          {/* Note: Mesačný vklad nastavte v sekcii Cashflow */}
          <p className="text-xs text-slate-400 italic mb-4">
            💡 Mesačný vklad nastavte v sekcii{" "}
            <strong>Cashflow &amp; rezerva</strong>
          </p>

          {/* 2×2 Grid of visual cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Card: Jednorazová investícia */}
            <div className="group relative p-4 rounded-xl bg-gradient-to-br from-slate-800/60 to-slate-800/40 ring-1 ring-white/5 hover:ring-emerald-500/40 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/10 hover:scale-[1.02]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl" aria-hidden="true">
                  💰
                </span>
                <label
                  htmlFor="lump-sum-input"
                  className="text-sm font-semibold text-slate-200"
                >
                  Jednorazová investícia
                </label>
              </div>
              <input
                id="lump-sum-input"
                type="text"
                role="textbox"
                inputMode="decimal"
                aria-label="Jednorazová investícia"
                ref={lumpSumCtl.ref}
                onChange={lumpSumCtl.onChange}
                onBlur={lumpSumCtl.onBlur}
                defaultValue={lumpSumCtl.defaultValue}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 ring-1 ring-white/5 text-sm focus:ring-2 focus:ring-emerald-500/50 transition-all"
                placeholder="0 €"
              />
            </div>

            {/* Card: Horizont */}
            <div className="group relative p-4 rounded-xl bg-gradient-to-br from-slate-800/60 to-slate-800/40 ring-1 ring-white/5 hover:ring-blue-500/40 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/10 hover:scale-[1.02]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl" aria-hidden="true">
                  📅
                </span>
                <label
                  htmlFor="horizon-input"
                  className="text-sm font-semibold text-slate-200"
                >
                  Horizont
                </label>
              </div>
              <input
                id="horizon-input"
                type="text"
                role="textbox"
                inputMode="decimal"
                aria-label="Horizont (roky)"
                ref={horizonCtl.ref}
                onChange={horizonCtl.onChange}
                onBlur={horizonCtl.onBlur}
                defaultValue={horizonCtl.defaultValue}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 ring-1 ring-white/5 text-sm focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="10 rokov"
              />
            </div>

            {/* Card: Mesačný vklad (link to Cashflow) */}
            <div
              className="group relative p-4 rounded-xl bg-gradient-to-br from-amber-900/20 to-amber-800/10 ring-1 ring-amber-500/20 hover:ring-amber-500/40 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer"
              onClick={() => {
                // Scroll to Cashflow section
                const cashflowSection = document.getElementById("sec1");
                if (cashflowSection) {
                  cashflowSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                  // Open cashflow section if closed
                  const cashflowButton = document.querySelector(
                    '[aria-controls="sec1"]'
                  ) as HTMLButtonElement;
                  if (
                    cashflowButton?.getAttribute("aria-expanded") === "false"
                  ) {
                    cashflowButton.click();
                  }
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Prejsť na nastavenie mesačného vkladu v sekcii Cashflow"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.currentTarget.click();
                }
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl" aria-hidden="true">
                  💸
                </span>
                <span className="text-sm font-semibold text-amber-300">
                  Mesačný vklad
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-400/80">
                  Nastavte v sekcii Cashflow
                </span>
                <svg
                  className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </div>
            </div>

            {/* Card: Cieľ majetku */}
            <div className="group relative p-4 rounded-xl bg-gradient-to-br from-slate-800/60 to-slate-800/40 ring-1 ring-white/5 hover:ring-violet-500/40 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/10 hover:scale-[1.02]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl" aria-hidden="true">
                  🎯
                </span>
                <label
                  htmlFor="goal-input"
                  className="text-sm font-semibold text-slate-200"
                >
                  Cieľ majetku
                </label>
              </div>
              <input
                id="goal-input"
                type="text"
                role="textbox"
                inputMode="decimal"
                aria-label="Cieľ majetku"
                ref={goalCtl.ref}
                onChange={goalCtl.onChange}
                onBlur={goalCtl.onBlur}
                defaultValue={goalCtl.defaultValue}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 ring-1 ring-white/5 text-sm focus:ring-2 focus:ring-violet-500/50 transition-all"
                placeholder="50 000 €"
              />
            </div>
          </div>

          {/* Recommendation: Zvýš vklad */}
          {renderRecommendation()}
        </section>
      )}
    </>
  );
};
