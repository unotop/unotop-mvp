/**
 * Bond Minimum Warning - Zobrazí sa, keď investor nemá dosť kapitálu na dlhopisy
 */

import React from "react";

interface Props {
  lumpSumEur: number;
  monthlyEur: number;
  totalFirstYear: number;
  missingAmount: number;
  monthsToReach: number | null;
}

export function BondMinimumWarning({
  lumpSumEur,
  monthlyEur,
  totalFirstYear,
  missingAmount,
  monthsToReach,
}: Props) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm">
      <div className="flex items-start gap-3">
        <span className="text-2xl">💡</span>
        <div className="flex-1">
          <p className="font-semibold text-amber-200 mb-2">Info o dlhopisoch</p>
          <p className="text-slate-300 mb-2">
            Dlhopisy možno zakúpiť od{" "}
            <span className="font-semibold text-white">2 500 EUR</span>.
          </p>
          <div className="bg-slate-900/40 rounded-md p-3 mb-3">
            <p className="text-slate-400 text-xs mb-1">
              Tvoj plán v prvom roku:
            </p>
            <div className="flex items-baseline gap-2">
              {lumpSumEur > 0 && (
                <span className="text-white font-medium">
                  {lumpSumEur.toLocaleString("sk-SK")} EUR jednorazovo
                </span>
              )}
              {lumpSumEur > 0 && monthlyEur > 0 && (
                <span className="text-slate-500">+</span>
              )}
              {monthlyEur > 0 && (
                <span className="text-white font-medium">
                  {monthlyEur.toLocaleString("sk-SK")} EUR × 12 mesiacov
                </span>
              )}
            </div>
            <p className="text-emerald-400 font-semibold mt-2">
              = {totalFirstYear.toLocaleString("sk-SK")} EUR
            </p>
          </div>

          {monthsToReach !== null ? (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3">
              <p className="text-blue-200 text-sm">
                📅 Pri mesačnom vklade {monthlyEur.toLocaleString("sk-SK")} EUR
                dosiahnete prah za{" "}
                <span className="font-bold text-blue-100">
                  {monthsToReach}{" "}
                  {monthsToReach === 1
                    ? "mesiac"
                    : monthsToReach < 5
                      ? "mesiace"
                      : "mesiacov"}
                </span>
                .
              </p>
              <p className="text-slate-400 text-xs mt-2">
                Dovtedy investujeme do hotovosti (70%) a ETF (30%).
              </p>
            </div>
          ) : (
            <p className="text-slate-400 text-xs">
              Zvýšte jednorazovú investíciu alebo mesačný vklad, aby ste mohli
              využiť dlhopisové produkty.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
