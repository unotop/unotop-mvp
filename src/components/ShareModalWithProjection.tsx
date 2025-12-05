/**
 * ShareModalWithProjection.tsx
 *
 * UI-WIRING FIX: Share modal používa useProjection hook pre konzistentné výpočty
 * Zobrazuje rovnaké FV/výnos/riziko ako ProjectionMetricsPanel
 */

import React from "react";
import { readV3 } from "../persist/v3";
import type { MixItem } from "../features/mix/mix.service"; // Correct MixItem type
import { useProjection } from "../features/projection/useProjection";
import type { RiskPref } from "../features/mix/assetModel";
import { toRealValue, toRealYield } from "../utils/inflation"; // PR-27: Inflation adjustment

interface ShareModalWithProjectionProps {
  onClose: () => void;
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  goalAssetsEur: number;
  riskPref: string;
}

export function ShareModalWithProjection({
  onClose,
  lumpSumEur,
  monthlyVklad,
  horizonYears,
  goalAssetsEur,
  riskPref,
}: ShareModalWithProjectionProps) {
  const v3Data = readV3();
  const mix: MixItem[] = (v3Data.mix as any) || [];
  const debts = v3Data.debts || [];

  // Validate riskPref
  const validRiskPref: RiskPref =
    riskPref === "konzervativny" || riskPref === "rastovy"
      ? (riskPref as RiskPref)
      : "vyvazeny";

  // UI-WIRING: Použiť useProjection (rovnaký výpočet ako v ProjectionMetricsPanel)
  const projection = useProjection({
    lumpSumEur,
    monthlyVklad,
    horizonYears,
    goalAssetsEur,
    mix: Array.isArray(mix) && mix.length > 0 ? mix : [],
    debts: debts || [],
    riskPref: validRiskPref,
  });

  const { fvFinal, approxYield, goalProgress } = projection;
  const pct = Math.round(goalProgress);

  // PR-27: Apply inflation adjustment (match StickyBottomBar display)
  const displayFV = toRealValue(fvFinal, horizonYears);
  const displayYield = toRealYield(approxYield);

  // Helper pre formátovanie majetku (rovnaký ako StickyBottomBar)
  const formatWealth = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(2)} M €`;
    }
    if (absValue >= 1_000) {
      return `${(value / 1_000).toFixed(0)} k €`;
    }
    return `${value.toFixed(0)} €`;
  };

  // Generate deeplink
  const handleSendEmail = () => {
    const state = {
      profile: {
        lumpSumEur,
        horizonYears,
        goalAssetsEur,
      },
      monthly: monthlyVklad,
      mix,
    };
    const encoded = btoa(JSON.stringify(state));
    const deeplink = `${window.location.origin}${window.location.pathname}#state=${encodeURIComponent(encoded)}`;

    // Email template
    const subject = "Investičná projekcia - Unotop";
    const body = `Dobrý deň,

pridávam vám moju investičnú projekciu:

📊 Parametre:
- Jednorazový vklad: ${lumpSumEur.toFixed(0)} €
- Mesačný vklad: ${monthlyVklad.toFixed(0)} €
- Investičný horizont: ${horizonYears} rokov
- Cieľ majetku: ${goalAssetsEur.toFixed(0)} €

💰 Projekcia:
- Hodnota po ${horizonYears} rokoch: ${formatWealth(displayFV)} (reálna hodnota, po inflácii)
- Progres k cieľu: ${pct}%
- Odhad výnosu p.a.: ${(displayYield * 100).toFixed(1)}% (reálny, po inflácii)

🔗 Interaktívna projekcia:
${deeplink}

S pozdravom`;

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;

    onClose();
  };

  return (
    <div
      role="dialog"
      aria-label="Zdieľať nastavenie"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="bg-slate-900 rounded-xl p-6 ring-1 ring-white/10 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold">📧 Odoslať projekciu</h2>

        {/* Preview FV + Mix - USED FROM useProjection */}
        <div className="p-4 rounded-lg bg-slate-800/50 ring-1 ring-white/5 space-y-3 text-sm">
          <div className="font-medium text-slate-300">Vaša projekcia:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400">
                Hodnota po {horizonYears} rokoch:
              </span>
              <div className="font-bold text-emerald-400 tabular-nums">
                {formatWealth(displayFV)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                reálna hodnota (po inflácii)
              </div>
            </div>
            <div>
              <span className="text-slate-400">Progres k cieľu:</span>
              <div className="font-bold text-amber-400 tabular-nums">
                {pct}%
              </div>
            </div>
            <div>
              <span className="text-slate-400">Jednorazový vklad:</span>
              <div className="font-medium tabular-nums">
                {lumpSumEur.toFixed(0)} €
              </div>
            </div>
            <div>
              <span className="text-slate-400">Mesačný vklad:</span>
              <div className="font-medium tabular-nums">
                {monthlyVklad.toFixed(0)} €
              </div>
            </div>
            <div>
              <span className="text-slate-400">Odhad výnosu p.a.:</span>
              <div className="font-medium text-blue-400 tabular-nums">
                {(displayYield * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                reálny (po inflácii)
              </div>
            </div>
          </div>

          {/* Mix portfólia */}
          {mix.length > 0 && (
            <div className="pt-2 border-t border-white/5">
              <div className="text-slate-400 mb-1">Mix portfólia:</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {mix
                  .filter((i) => i.pct > 0)
                  .map((item) => {
                    const labels: Record<string, string> = {
                      gold: "🥇 Zlato",
                      dyn: "📊 Dyn. riadenie",
                      etf: "🌍 ETF svet",
                      bonds: "📜 Dlhopis 7,5% (5r)",
                      bond3y9: "💰 Dlhopis 9% (3r)",
                      cash: "💵 Pracujúca rezerva – IAD DK",
                      crypto: "₿ Krypto",
                      real: "🏘️ Reality",
                      other: "📦 Ostatné",
                    };
                    return (
                      <div key={item.key} className="flex justify-between">
                        <span className="text-slate-300">
                          {labels[item.key] || item.key}
                        </span>
                        <span className="font-medium tabular-nums">
                          {item.pct.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
              </div>
              {/* Info o dlhopisoch ak sú oba prítomné */}
              {mix.some((m) => m.key === "bonds" && m.pct > 0) &&
                mix.some((m) => m.key === "bond3y9" && m.pct > 0) && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-slate-400 space-y-1">
                    <div className="flex items-start gap-1">
                      <span className="shrink-0">📜</span>
                      <span>
                        Dlhopis 7,5%: korporátny, krytý biznisom firmy, 5-ročná
                        splatnosť
                      </span>
                    </div>
                    <div className="flex items-start gap-1">
                      <span className="shrink-0">💰</span>
                      <span>
                        Dlhopis 9%: mesačné výplaty po dobu 36 mesiacov, lepšia
                        likvidita
                      </span>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Email input */}
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-300">
            Email finančného advisora
          </span>
          <input
            autoFocus
            aria-label="Email agenta"
            type="email"
            placeholder="advisor@example.com"
            className="w-full bg-slate-800 rounded-lg px-4 py-2.5 text-sm ring-1 ring-white/5 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
          />
        </label>

        {/* CTA buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-medium text-sm hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
            onClick={handleSendEmail}
          >
            📨 Odoslať email
          </button>
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
            onClick={onClose}
          >
            Zrušiť
          </button>
        </div>
      </div>
    </div>
  );
}
