/**
 * Cash Reserve Warning - Upozorní na neoptimálnu hotovostnú rezervu
 */

import React from "react";

interface Props {
  optimal: number;
  current: number;
  message: string;
  onApply?: () => void;
}

export function CashReserveWarning({
  optimal,
  current,
  message,
  onApply,
}: Props) {
  // PR-13: Tri stavy pre IAD DK (pracujúcu rezervu)
  const TOLERANCE = 1.0; // ±1 p.b. tolerancia
  const isLow = current < optimal - TOLERANCE;
  const isHigh = current > optimal + TOLERANCE;
  const isOptimal = !isLow && !isHigh;

  if (isOptimal) {
    // Optimálne pásmo - zobraziť pozitívny feedback
    return (
      <div className="bg-green-500/10 border-green-500/30 border rounded-lg p-4 text-sm">
        <div className="flex items-start gap-3">
          <span className="text-2xl">✅</span>
          <div className="flex-1">
            <p className="font-semibold text-slate-200 mb-2">
              Pracujúca rezerva je v optimálnom pásme
            </p>
            <p className="text-slate-300">
              Vaša rezerva na IAD DK ({current.toFixed(1)}%) je blízko
              odporúčanej úrovne ({optimal.toFixed(1)}%). Môžete pokračovať v
              investovaní.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        isLow
          ? "bg-blue-500/10 border-blue-500/30"
          : "bg-purple-500/10 border-purple-500/30"
      } border rounded-lg p-4 text-sm`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{isLow ? "💵" : "💰"}</span>
        <div className="flex-1">
          <p className="font-semibold text-slate-200 mb-2">
            {isLow
              ? "Nižšia rezerva – zváž doplniť na 3–6 mes."
              : "Nadmerná rezerva na IAD DK"}
          </p>
          <p className="text-slate-300 mb-3">{message}</p>

          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-1">Súčasná IAD DK %</p>
              <p className="text-lg font-bold text-white">
                {current.toFixed(1)}%
              </p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-1">Optimálna IAD DK %</p>
              <p
                className={`text-lg font-bold ${
                  isLow ? "text-blue-400" : "text-purple-400"
                }`}
              >
                {optimal.toFixed(1)}%
              </p>
            </div>
          </div>

          {onApply && (
            <button
              onClick={onApply}
              className={`${
                isLow
                  ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300"
                  : "bg-purple-500/20 hover:bg-purple-500/30 text-purple-300"
              } px-4 py-2 rounded-md text-sm font-medium transition-colors`}
            >
              Aplikovať odporúčanie →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
