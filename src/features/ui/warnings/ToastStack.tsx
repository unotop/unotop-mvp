/**
 * ToastStack - Zobrazuje global warnings vpravo hore
 *
 * Umiestnenie: Top-right corner (fixed position)
 * A11y: aria-live="assertive" pre errors, "polite" pre info/warning
 * Esc zatvorí najnovší toast
 */

import React from "react";
import { WarningCenter, type Warning } from "./WarningCenter";

export const ToastStack: React.FC = () => {
  const [toasts, setToasts] = React.useState<Warning[]>([]);

  React.useEffect(() => {
    const updateToasts = (allWarnings: Warning[]) => {
      // Zobraz len global scope warnings
      setToasts(allWarnings.filter((w) => w.scope === "global"));
    };

    // Initial load
    updateToasts(WarningCenter.getAll());

    // Subscribe na zmeny
    return WarningCenter.subscribe(updateToasts);
  }, []);

  React.useEffect(() => {
    // Esc zavrie najnovší toast
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && toasts.length > 0) {
        const latest = toasts[toasts.length - 1];
        WarningCenter.dismiss(latest.id);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [toasts]);

  if (toasts.length === 0) return null;

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
        return "bg-blue-900 ring-blue-500/50 text-blue-100";
      case "warning":
        return "bg-amber-900 ring-amber-500/50 text-amber-100";
      case "error":
        return "bg-red-900 ring-red-500/50 text-red-100";
      default:
        return "bg-slate-800 ring-slate-500/50 text-slate-100";
    }
  };

  const getAriaLive = (type: Warning["type"]): "assertive" | "polite" => {
    return type === "error" ? "assertive" : "polite";
  };

  return (
    <div
      className="fixed top-20 right-4 z-[1100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none"
      role="region"
      aria-label="Systémové upozornenia"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live={getAriaLive(toast.type)}
          aria-atomic="true"
          className={`flex items-start gap-3 p-4 rounded-lg ring-1 shadow-xl ${getColorClasses(toast.type)} pointer-events-auto animate-slideInRight`}
        >
          <span aria-hidden="true" className="text-xl flex-shrink-0 mt-0.5">
            {getIcon(toast.type)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => WarningCenter.dismiss(toast.id)}
            aria-label="Zavrieť"
            className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
          >
            <svg
              className="w-4 h-4"
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
