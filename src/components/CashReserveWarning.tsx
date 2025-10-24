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
  const isLow = current < optimal - 2;
  const isHigh = current > optimal + 2;

  if (!isLow && !isHigh) return null; // Optimal range

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
            {isLow ? "Odporúčanie k rezerve" : "Nadmerná hotovosť"}
          </p>
          <p className="text-slate-300 mb-3">{message}</p>

          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-1">Súčasná cash %</p>
              <p className="text-lg font-bold text-white">
                {current.toFixed(1)}%
              </p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-1">Optimálna cash %</p>
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
