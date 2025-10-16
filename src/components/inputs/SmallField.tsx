import React, { useCallback } from "react";
import { clamp, parseMoneyStrict } from "../../utils/number";

export interface SmallFieldProps {
  label: string;
  ariaLabel?: string;
  value: number;
  setValue: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string; // unit like €, r, etc.
  rangeRef?: React.Ref<HTMLInputElement>; // optional ref for focusing slider externally
}

export const SmallField: React.FC<SmallFieldProps> = ({
  label,
  ariaLabel,
  value,
  setValue,
  min,
  max,
  step = 1,
  prefix,
  rangeRef,
}) => {
  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.currentTarget.type !== "range") return;
      const delta = e.shiftKey ? step * 10 : step;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        setValue(clamp(value + delta, min, max));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        setValue(clamp(value - delta, min, max));
      }
    },
    [min, max, step, value, setValue]
  );
  return (
    <label className="block text-[11px] font-medium text-slate-300 min-w-0">
      <span className="truncate block mb-1 leading-tight" title={label}>
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          className="w-24 shrink-0 rounded border border-slate-700 bg-slate-800/80 px-1.5 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={value}
          aria-label={ariaLabel ?? label}
          onChange={(e) => {
            const raw = e.target.value;
            const parsed = parseMoneyStrict(raw);
            if (Number.isNaN(parsed)) return; // ignore invalid partial
            setValue(clamp(parsed, min, max));
          }}
          onBlur={(e) => {
            const parsed = parseMoneyStrict(e.target.value);
            setValue(clamp(Number.isNaN(parsed) ? min : parsed, min, max));
          }}
        />
        {prefix && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/70 text-slate-200 shrink-0">
            {prefix}
          </span>
        )}
        <input
          type="range"
          className={`flex-1 min-w-[140px] cursor-pointer accent-indigo-500 range-skin ${
            typeof document !== "undefined" &&
            document.documentElement.getAttribute("data-ui-mode") === "pro"
              ? "range-skin--pro"
              : "range-skin--basic"
          }`}
          min={min}
          max={max}
          step={step}
          value={value}
          // Distinct aria-label for slider to avoid ambiguity with numeric/text input
          aria-label={(() => {
            if (label === "Jednorazová investícia")
              return "Jednorazová investícia – slider";
            if (label === "Mesačný vklad") return "Mesačný vklad – slider";
            // Odlišné aria-label pre slider aby regex 'Mesačný príjem' nezasiahol slider element
            if (label === "Mesačný príjem") return "Príjem – slider";
            return label + (prefix ? ` (${prefix})` : "");
          })()}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          onKeyDown={handleKey}
          onChange={(e) => setValue(clamp(Number(e.target.value), min, max))}
          ref={rangeRef}
        />
      </div>
    </label>
  );
};
