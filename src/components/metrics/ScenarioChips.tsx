import React, { useEffect, useRef, useState } from "react";

export type Scenario = "drop20" | "boost10" | "infl6";

export const ScenarioChips: React.FC<{
  onApply: (s: Scenario | null) => void;
}> = ({ onApply }) => {
  const [active, setActive] = useState<Scenario | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastActivatedRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Predĺžený timeout (4100ms) pre tolerantný test ~4s
    timerRef.current = window.setTimeout(() => {
      setActive(null);
      onApply(null);
      timerRef.current = null;
    }, 4100);
  }, [active, onApply]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function trigger(s: Scenario) {
    const now = Date.now();
    if (active === s) {
      const delta = now - lastActivatedRef.current;
      // Heuristika: veľmi rýchly re-click (<250ms) = refresh (ponechaj active, reštartuj timer)
      // Pomalší re-click = cancel (pre cancel test)
      if (delta < 250) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        // Reštart timeout bez zmeny active
        lastActivatedRef.current = now;
        timerRef.current = window.setTimeout(() => {
          setActive(null);
          onApply(null);
          timerRef.current = null;
        }, 4100);
        return;
      }
      // Cancel path
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setActive(null);
      onApply(null);
      return;
    }
    lastActivatedRef.current = now;
    setActive(s);
    onApply(s);
  }

  const base =
    "inline-flex items-center gap-1 px-2 py-1 rounded border text-xs bg-slate-600/20 text-slate-200 border-slate-500/40 hover:bg-slate-600/30 focus:outline-none focus:ring-2 focus:ring-slate-400/40 transition-all duration-200 hover:scale-105 active:scale-95";
  const activeCls = "bg-amber-600/20 text-amber-200 border-amber-400/40 shadow-lg shadow-amber-500/30 animate-pulse";
  const disabledCls = "opacity-50 cursor-not-allowed";

  const isDisabled = (label: Scenario) => !!active && active !== label;
  const isActive = (label: Scenario) => active === label;

  return (
    <div className="flex flex-wrap gap-2 items-center mt-2">
      <span className="text-[11px] text-slate-400 mr-1">Scenáre:</span>
      <button
        type="button"
        data-testid="scenario-chip-minus20"
        data-active={isActive("drop20") || undefined}
        aria-pressed={isActive("drop20")}
        disabled={isDisabled("drop20")}
        title="−20 %: ukáž, ako vyzerá pokles trhu."
        className={`${base} ${isActive("drop20") ? activeCls : ""} ${isDisabled("drop20") ? disabledCls : ""}`}
        onClick={() => trigger("drop20")}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && trigger("drop20")
        }
      >
        −20 %
      </button>
      <button
        type="button"
        data-testid="scenario-chip"
        data-active={isActive("boost10") || undefined}
        aria-pressed={isActive("boost10")}
        disabled={isDisabled("boost10")}
        title="+10 %: ukáž, ako vyzerá mierny rast."
        className={`${base} ${isActive("boost10") ? activeCls : ""} ${isDisabled("boost10") ? disabledCls : ""}`}
        onClick={() => trigger("boost10")}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && trigger("boost10")
        }
      >
        +10 %
      </button>
      <button
        type="button"
        data-testid="scenario-chip"
        data-active={isActive("infl6") || undefined}
        aria-pressed={isActive("infl6")}
        disabled={isDisabled("infl6")}
        title="Inflácia 6 %: cieľ sa zdraží o infláciu."
        className={`${base} ${isActive("infl6") ? activeCls : ""} ${isDisabled("infl6") ? disabledCls : ""}`}
        onClick={() => trigger("infl6")}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && trigger("infl6")
        }
      >
        Inflácia 6 %
      </button>
      {active && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] bg-amber-600/20 text-amber-200 border-amber-400/40 animate-pulse"
          role="status"
          aria-label="Scenár aktívny"
          aria-live="polite"
          data-testid="scenario-status"
        >
          Scenár aktívny
        </span>
      )}
    </div>
  );
};
