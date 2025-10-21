import React from "react";
import { TEST_IDS } from "../../testIds";

export interface StatusChip {
  id: string;
  icon: string;
  label: string;
  variant: "success" | "warning" | "error" | "info";
  tooltip?: string;
}

interface StatusChipsProps {
  chips: StatusChip[];
}

const VARIANT_STYLES = {
  success: {
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/40",
    text: "text-emerald-300",
    hoverBg: "hover:bg-emerald-500/20",
    hoverRing: "hover:ring-emerald-500/60",
  },
  warning: {
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/40",
    text: "text-amber-300",
    hoverBg: "hover:bg-amber-500/20",
    hoverRing: "hover:ring-amber-500/60",
  },
  error: {
    bg: "bg-red-500/10",
    ring: "ring-red-500/40",
    text: "text-red-300",
    hoverBg: "hover:bg-red-500/20",
    hoverRing: "hover:ring-red-500/60",
  },
  info: {
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/40",
    text: "text-blue-300",
    hoverBg: "hover:bg-blue-500/20",
    hoverRing: "hover:ring-blue-500/60",
  },
};

/**
 * Enhanced status chips with color-coding and tooltips
 * Used for mix validation feedback (sum, risk, constraints)
 */
export const StatusChips: React.FC<StatusChipsProps> = ({ chips }) => {
  if (chips.length === 0) return null;

  return (
    <div
      data-testid={TEST_IDS.CHIPS_STRIP}
      className="flex flex-wrap gap-2 animate-fadeIn"
    >
      {chips.map((chip) => {
        const styles = VARIANT_STYLES[chip.variant];
        return (
          <span
            key={chip.id}
            data-testid={TEST_IDS.SCENARIO_CHIP}
            title={chip.tooltip}
            className={`
              group relative
              px-3 py-1.5
              text-xs font-medium
              rounded-lg
              ${styles.bg} ${styles.ring} ${styles.text}
              ${styles.hoverBg} ${styles.hoverRing}
              ring-1
              transition-all duration-200
              hover:scale-105 hover:shadow-lg
              cursor-default
            `}
          >
            <span className="flex items-center gap-1.5">
              <span role="img" aria-label={chip.label}>
                {chip.icon}
              </span>
              <span>{chip.label}</span>
            </span>

            {/* Tooltip (enhanced on hover) */}
            {chip.tooltip && (
              <span
                className={`
                  absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                  hidden group-hover:block
                  px-2 py-1
                  text-[10px] text-slate-200
                  bg-slate-800 rounded
                  ring-1 ring-white/20
                  whitespace-nowrap
                  z-50
                  animate-fadeIn
                `}
                role="tooltip"
              >
                {chip.tooltip}
                {/* Arrow */}
                <span
                  className="
                    absolute top-full left-1/2 -translate-x-1/2
                    w-0 h-0
                    border-l-4 border-l-transparent
                    border-r-4 border-r-transparent
                    border-t-4 border-t-slate-800
                  "
                />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
};
