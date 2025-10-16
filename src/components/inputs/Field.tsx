import { clamp } from "../../utils/number";
import React from "react";

interface FieldProps {
  label: string;
  value: number;
  setValue: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
}

export function Field({
  label,
  value,
  setValue,
  min = 0,
  max = 100,
  step = 1,
  prefix,
}: FieldProps) {
  const toNumber = (x: any) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  };
  const onNum = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValue(clamp(toNumber(e.target.value), min, max));
  const onRange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValue(clamp(toNumber(e.target.value), min, max));
  const skin =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-ui-mode") === "pro"
      ? "range-skin--pro"
      : "range-skin--basic";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-slate-200">{label}</label>
        <div className="flex items-center gap-1">
          {prefix && <span className="text-slate-400 text-sm">{prefix}</span>}
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={onNum}
            className="w-24 rounded-lg bg-slate-950/60 border border-slate-800 px-2 py-1 text-sm text-right"
          />
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onRange}
        className={`w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer range-skin ${skin}`}
      />
    </div>
  );
}
