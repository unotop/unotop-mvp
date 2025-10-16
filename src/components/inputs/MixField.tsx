import React, { forwardRef } from "react";
import { clamp } from "../../utils/number";

export interface MixFieldProps {
  label: string;
  value: number;
  setValue: (v: number) => void;
  reUnlocked: boolean;
}

export const MixField: React.FC<
  MixFieldProps & {
    registerRef?: (label: string, el: HTMLInputElement | null) => void;
  }
> = ({ label, value, setValue, reUnlocked, registerRef }) => {
  const skin =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-ui-mode") === "pro"
      ? "range-skin--pro"
      : "range-skin--basic";
  // Per-field minimum (do not auto-enforce gold 10% here; invariants handled centrally)
  const hardMin = 0;
  const disabled = label === "Reality (komerčné)" && !reUnlocked;
  // Map simple emoji icons for main asset categories
  const icon = (() => {
    if (label.startsWith("ETF") || label.includes("ETF")) return "🌍";
    if (label.startsWith("Zlato")) return "🟡";
    if (label.startsWith("Dynamické")) return "⚙️";
    if (label.startsWith("Garantovaný dlhopis") || label.startsWith("Dlhopis"))
      return "🏦";
    if (label.startsWith("Krypto")) return "₿";
    if (label.startsWith("Hotovosť")) return "💶";
    if (label.startsWith("Reality")) return "🏠";
    return "";
  })();
  // Stable id (transform diacritics/spaces) for accessibility linking
  const baseId =
    "mix-" +
    label
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[()]/g, "")
      .replace(/č/g, "c")
      .replace(/á/g, "a")
      .replace(/í/g, "i")
      .replace(/ý/g, "y")
      .replace(/ľ/g, "l")
      .replace(/š/g, "s")
      .replace(/ť/g, "t")
      .replace(/ž/g, "z")
      .replace(/ň/g, "n")
      .replace(/ô/g, "o")
      .replace(/ď/g, "d")
      .replace(/é/g, "e")
      .replace(/ú/g, "u")
      .replace(/ä/g, "a")
      .replace(/,/g, "")
      .replace(/%/g, "");
  const numberId = baseId + "-number";
  const rangeId = baseId + "-range";
  const isGold = label.startsWith("Zlato");
  return (
    <label className="block text-[11px] font-medium text-slate-300 min-w-0">
      <span className="truncate block mb-1 leading-tight" title={label}>
        {label}
        {icon && <span aria-hidden="true"> {icon}</span>}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          className="w-20 shrink-0 rounded border border-slate-700 bg-slate-800/80 px-1.5 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40"
          value={value || 0}
          min={hardMin}
          max={100}
          step={0.5}
          id={numberId}
          aria-label={
            label.includes("ETF") ? `${label} (číselná hodnota)` : label
          }
          disabled={disabled}
          onChange={(e) =>
            setValue(clamp(Number(e.target.value || 0), hardMin, 100))
          }
          data-testid={isGold ? "input-gold-number" : undefined}
        />
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/70 text-slate-200 shrink-0">
          %
        </span>
        <input
          type="range"
          className={`flex-1 min-w-[140px] cursor-pointer accent-indigo-500 range-skin ${skin} h-[6px] disabled:opacity-40`}
          aria-label={label}
          data-asset-key={label}
          min={hardMin}
          max={100}
          step={0.5}
          value={value || 0}
          disabled={disabled}
          id={rangeId}
          data-alt-label={isGold ? "Zlato (fyzicke)" : undefined}
          onChange={(e) =>
            setValue(clamp(Number(e.target.value || 0), hardMin, 100))
          }
          ref={(el) => registerRef?.(label, el)}
          data-testid={isGold ? "slider-gold" : undefined}
        />
        {isGold && process.env.NODE_ENV === "test" && (
          <span className="sr-only" data-testid="gold-html-dump">
            {(() => {
              try {
                const el =
                  typeof document !== "undefined"
                    ? document.querySelector<HTMLInputElement>(`#${rangeId}`)
                    : null;
                if (el)
                  console.debug(
                    "[GoldFieldMount] range.outerHTML=",
                    el.outerHTML
                  );
              } catch {}
              return null;
            })()}
          </span>
        )}
        {process.env.NODE_ENV === "test" && isGold && (
          <span className="sr-only" data-testid="gold-label-dump">
            {(() => {
              try {
                console.debug("[GoldFieldMount] label=", label);
                console.debug(
                  "[GoldFieldMount] labelCharCodes=",
                  [...label].map((c) => c.charCodeAt(0))
                );
                console.debug("[GoldFieldMount] altLabel= Zlato (fyzicke)");
              } catch {}
              return null;
            })()}
          </span>
        )}
      </div>
      {disabled && (
        <div className="text-xs text-slate-500 mt-1">
          Odomkne sa pri príjme ≥ 3 500 € alebo jednorazovej investícii ≥ 300
          000 €
        </div>
      )}
    </label>
  );
};
