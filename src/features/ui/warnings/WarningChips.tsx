/**
 * WarningChips - Zobrazuje warnings pre scope 'mix' a 'risk'
 *
 * Umiestnenie: Pod MixPanel (inline v sekcii zloženia portfólia)
 * A11y: aria-live="polite", role="status", klávesové Dismiss (Esc)
 */

import React from "react";
import {
  WarningCenter,
  type Warning,
  type WarningScope,
} from "./WarningCenter";

interface WarningChipsProps {
  scope?: WarningScope;
  className?: string;
}

export const WarningChips: React.FC<WarningChipsProps> = ({
  scope,
  className = "",
}) => {
  const [warnings, setWarnings] = React.useState<Warning[]>([]);

  React.useEffect(() => {
    const updateWarnings = (allWarnings: Warning[]) => {
      if (scope) {
        setWarnings(allWarnings.filter((w) => w.scope === scope));
      } else {
        // Zobraz len mix a risk warnings (nie global)
        setWarnings(
          allWarnings.filter((w) => w.scope === "mix" || w.scope === "risk")
        );
      }
    };

    // Initial load
    updateWarnings(WarningCenter.getAll());

    // Subscribe na zmeny
    return WarningCenter.subscribe(updateWarnings);
  }, [scope]);

  if (warnings.length === 0) return null;

  const getIcon = (type: Warning["type"]) => {
    switch (type) {
      case "info":
        return "ℹ️";
      case "warning":
        return "⚠️";
      case "error":
        return "⛔";
      default:
        return "💬";
    }
  };

  const getColorClasses = (type: Warning["type"]) => {
    switch (type) {
      case "info":
        return "bg-blue-900/30 ring-blue-500/30 text-blue-300";
      case "warning":
        return "bg-amber-900/30 ring-amber-500/30 text-amber-300";
      case "error":
        return "bg-red-900/30 ring-red-500/30 text-red-300";
      default:
        return "bg-slate-700/30 ring-slate-500/30 text-slate-300";
    }
  };

  return (
    <div
      className={`flex flex-wrap gap-2 ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {warnings.map((warning) => (
        <div
          key={warning.id}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1 text-sm ${getColorClasses(warning.type)} transition-all duration-200`}
        >
          <span aria-hidden="true">{getIcon(warning.type)}</span>
          <span>{warning.message}</span>
          <button
            type="button"
            onClick={() => WarningCenter.dismiss(warning.id)}
            aria-label="Zavrieť upozornenie"
            className="ml-1 p-0.5 rounded hover:bg-white/10 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};
