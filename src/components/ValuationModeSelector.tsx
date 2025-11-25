/**
 * PR-27: Voľba zhodnotenia (nominálne vs. reálne)
 *
 * Segmented toggle pre prepínanie medzi:
 * - Zhodnotenie po odpočítaní inflácie (default)
 * - Nominálne zhodnotenie
 *
 * Umiestnenie: Pravý panel medzi "Vaša projekcia" a graf
 */

import React from "react";
import { readV3, writeV3 } from "../persist/v3";
import {
  VALUATION_MODE_LABELS,
  INFLATION_CAPTION,
} from "../config/inflation.config";

interface ValuationModeSelectorProps {
  /** Current valuation mode */
  mode: "real" | "nominal";
  /** Callback when mode changes */
  onChange: (mode: "real" | "nominal") => void;
}

export default function ValuationModeSelector({
  mode,
  onChange,
}: ValuationModeSelectorProps) {
  const handleToggle = (newMode: "real" | "nominal") => {
    if (newMode === mode) return; // Already active

    // Notify parent (parent handles persist)
    onChange(newMode);
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 shadow-lg ring-1 ring-white/10">
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-300">
          Voľba zhodnotenia:
        </h3>
      </div>

      {/* Segmented Toggle (aria-pressed pattern) */}
      <div
        className="grid grid-cols-2 gap-2 mb-3"
        role="group"
        aria-label="Voľba zhodnotenia"
      >
        {/* Real Mode (default) */}
        <button
          type="button"
          onClick={() => handleToggle("real")}
          aria-pressed={mode === "real"}
          className={`
            px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200
            ${
              mode === "real"
                ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white"
            }
          `}
        >
          {VALUATION_MODE_LABELS.real}
        </button>

        {/* Nominal Mode */}
        <button
          type="button"
          onClick={() => handleToggle("nominal")}
          aria-pressed={mode === "nominal"}
          className={`
            px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200
            ${
              mode === "nominal"
                ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25"
                : "bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white"
            }
          `}
        >
          {VALUATION_MODE_LABELS.nominal}
        </button>
      </div>

      {/* Caption */}
      <p className="text-[10px] text-slate-400 text-center">
        {INFLATION_CAPTION}
      </p>
    </div>
  );
}

// Named export pre compatibility s ES module imports
export { ValuationModeSelector };
