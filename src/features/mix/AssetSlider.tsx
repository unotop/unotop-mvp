import React from "react";
import { getAssetStyle, type AssetKey } from "./assetStyles";
import { useUncontrolledValueInput } from "../_hooks/useUncontrolledValueInput";

type UncontrolledInputHook = ReturnType<typeof useUncontrolledValueInput>;

interface AssetSliderProps {
  assetKey: AssetKey;
  pct: number;
  sum: number;
  controller: UncontrolledInputHook;
  onCommit: (pct: number) => void;
  testIdSlider?: string;
  testIdInput?: string;
}

/**
 * Enhanced asset slider with color-coding and visual polish
 * Used in PRO mode for fancy portfolio editing
 */
export const AssetSlider: React.FC<AssetSliderProps> = ({
  assetKey,
  pct,
  sum,
  controller,
  onCommit,
  testIdSlider,
  testIdInput,
}) => {
  const style = getAssetStyle(assetKey);
  const maxAllowed = Math.min(100, 100 - (sum - pct));

  // Slider track custom styling (gradient fill effect)
  const sliderTrackStyle = {
    background: `linear-gradient(to right, 
      var(--tw-gradient-from) 0%, 
      var(--tw-gradient-to) ${pct}%, 
      rgb(51 65 85 / 0.3) ${pct}%, 
      rgb(51 65 85 / 0.3) 100%)`,
  } as React.CSSProperties;

  return (
    <div
      className={`
        group relative
        p-3 rounded-lg
        bg-gradient-to-r ${style.bgGradient}
        ring-1 ${style.ringColor}
        transition-all duration-200
        ${style.hoverShadow} hover:shadow-lg
        hover:scale-[1.01]
      `}
    >
      {/* Header: Icon + Label + Value */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg" role="img" aria-label={style.label}>
            {style.icon}
          </span>
          <label
            htmlFor={`txt-${assetKey}`}
            className="text-xs font-medium text-slate-200"
          >
            {style.label}
          </label>
        </div>
        <span
          className={`
            tabular-nums text-sm font-bold
            text-${style.color}-300
            group-hover:text-${style.color}-200
            transition-colors
          `}
        >
          {Math.round(pct)}%
        </span>
      </div>

      {/* Slider + Textbox Row */}
      <div className="flex items-center gap-3">
        {/* Number Input */}
        <input
          id={`txt-${assetKey}`}
          type="number"
          min={0}
          max={100}
          step={1}
          inputMode="decimal"
          aria-label={style.label}
          data-testid={testIdInput}
          ref={controller.ref}
          onChange={controller.onChange}
          onBlur={controller.onBlur}
          className={`
            w-16 px-2 py-1 
            rounded border-0
            bg-slate-900/60 
            text-xs text-slate-200
            ring-1 ring-${style.color}-500/30
            focus:ring-2 focus:ring-${style.color}-500/60
            focus:outline-none
            transition-all
          `}
        />

        {/* Range Slider */}
        <div className="flex-1 relative">
          <input
            type="range"
            min={0}
            max={100}
            value={pct}
            disabled={sum >= 100 && pct === 0}
            onChange={(e) => {
              const requested = Number(e.target.value);
              const v = Math.min(requested, maxAllowed);
              onCommit(v);
              controller.syncToDom(v);
            }}
            data-testid={testIdSlider}
            aria-label={style.label}
            style={sliderTrackStyle}
            className={`
              w-full h-2 rounded-full
              appearance-none cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              
              /* Webkit (Chrome, Safari) */
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-${style.color}-400
              [&::-webkit-slider-thumb]:ring-2
              [&::-webkit-slider-thumb]:ring-${style.color}-500/60
              [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:shadow-${style.color}-500/30
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:hover:scale-110
              [&::-webkit-slider-thumb]:hover:shadow-xl
              [&::-webkit-slider-thumb]:active:scale-95
              
              /* Firefox */
              [&::-moz-range-thumb]:appearance-none
              [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:h-4
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-${style.color}-400
              [&::-moz-range-thumb]:border-2
              [&::-moz-range-thumb]:border-${style.color}-500
              [&::-moz-range-thumb]:cursor-pointer
              [&::-moz-range-thumb]:transition-all
            `}
          />
        </div>
      </div>

      {/* Overflow warning (if max hit) */}
      {sum > 100 && pct > 0 && (
        <div className="mt-1 text-[10px] text-amber-400/80 animate-pulse">
          ⚠️ Suma portfólia presahuje 100%
        </div>
      )}
    </div>
  );
};
