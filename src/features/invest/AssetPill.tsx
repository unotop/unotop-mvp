/**
 * AssetPill - Kompaktný komponent pre zobrazenie asset statusu
 *
 * PR-36+: Refactor "Sila vášho plánu" - 3 stavy assets
 */

export type AssetStatus = "active" | "available" | "locked";

interface AssetPillProps {
  assetKey: string;
  label: string;
  status: AssetStatus;
  maxPct?: number; // Pre ACTIVE stav: max % v portfóliu
  minVolume?: number; // Pre LOCKED stav: minimálna suma
}

const STATUS_STYLES: Record<
  AssetStatus,
  { bg: string; text: string; ring: string }
> = {
  active: {
    bg: "bg-emerald-900/40",
    text: "text-emerald-300",
    ring: "ring-emerald-800/60",
  },
  available: {
    bg: "bg-slate-700/20",
    text: "text-slate-400",
    ring: "ring-slate-700/30",
  },
  locked: {
    bg: "bg-slate-800/20",
    text: "text-slate-500",
    ring: "ring-slate-700/20",
  },
};

export default function AssetPill({
  assetKey,
  label,
  status,
  maxPct,
  minVolume,
}: AssetPillProps) {
  const style = STATUS_STYLES[status];

  let tooltip = "";
  if (status === "active" && maxPct !== undefined) {
    tooltip = `${label} – používa sa až do ${maxPct.toFixed(0)} % v portfóliu`;
  } else if (status === "available") {
    tooltip = `${label} – dostupné, ale bez alokácie`;
  } else if (status === "locked" && minVolume !== undefined) {
    tooltip = `${label} – od ${minVolume.toLocaleString("sk-SK")} €`;
  }

  return (
    <div
      data-testid={`asset-pill-${assetKey}`}
      className={`relative flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition-all duration-200 ${style.bg} ${style.text} ${style.ring} ${
        status === "active" ? "hover:ring-emerald-600/80" : ""
      }`}
      title={tooltip}
    >
      {/* Icon indicator */}
      <div className="flex items-center gap-1.5 min-w-0">
        <div
          className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
            status === "active"
              ? "bg-emerald-400"
              : status === "available"
                ? "bg-slate-500"
                : "bg-slate-600"
          }`}
        />
        <span className="truncate">{label}</span>
      </div>

      {/* Max % pre ACTIVE */}
      {status === "active" && maxPct !== undefined && maxPct > 0 && (
        <span className="text-[10px] text-emerald-400/80 font-bold flex-shrink-0">
          {maxPct.toFixed(0)}%
        </span>
      )}

      {/* "bez alokácie" pre AVAILABLE */}
      {status === "available" && (
        <span className="text-[9px] text-slate-500 italic flex-shrink-0">
          dostupné
        </span>
      )}

      {/* Lock icon pre LOCKED */}
      {status === "locked" && (
        <svg
          className="h-3 w-3 text-slate-600 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      )}
    </div>
  );
}
