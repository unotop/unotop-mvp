import { useRef } from "react";

interface RiskGaugeProps {
  value: number; // 0..10
  threshold?: number; // threshold marker (default 7.5)
  showThresholdTick?: boolean; // default true
  showThresholdDot?: boolean; // default true (still only shows if value > threshold)
  size?: "md" | "lg"; // visual size variant (md default)
}

// Helper: polar conversion (0° at top, sweep clockwise)
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Single arc path from startDeg to endDeg (degrees, 0° top, clockwise)
function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const sweep = endDeg - startDeg;
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  const dir = sweep >= 0 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} ${dir} ${end.x} ${end.y}`;
}

export function RiskGauge({
  value,
  threshold = 7.5,
  showThresholdTick = true,
  showThresholdDot = true,
  size = "md",
}: RiskGaugeProps) {
  const clamp = (v: number, min = 0, max = 10) =>
    Math.min(max, Math.max(min, v));
  const current = clamp(value);
  const prevRef = useRef<number>(current);
  const delta = Math.abs(current - prevRef.current);
  const announce = delta > 0.1;
  if (delta > 0) prevRef.current = current;

  // Size mapping
  const pixelSize = size === "lg" ? 260 : 220;
  const stroke = 22; // reverted bar thickness (keeping enlarged needle)
  // We want a visual 2px gap at arc radius r. Arc length L = r * thetaRad -> thetaDeg = (L / r) * (180/PI)
  // So for 2px gap: gapDeg = (2 / r) * (180 / Math.PI)
  const gapDeg = (2 / (pixelSize / 2)) * (180 / Math.PI); // approximate using outer radius for consistent visual size
  const cx = pixelSize / 2;
  const cy = pixelSize / 2 + 2; // slight downward shift
  const r = pixelSize / 2 - stroke * 0.7;
  const valueToDeg = (v: number) => -90 + (clamp(v) / 10) * 180;

  // Pásma: zelená 0-4, žltá 4-7, červená 7-10
  const SEGMENTS = [
    { from: 0, to: 4, color: "#10b981" }, // green-500 (tailwind)
    { from: 4, to: 7, color: "#fbbf24" }, // yellow-400
    { from: 7, to: 10, color: "#ef4444" }, // red-500
  ];

  // Background track (full 180°)
  const trackPath = arcPath(cx, cy, r, -90, 90);

  const segmentPaths = SEGMENTS.map((seg, i) => {
    // raw degree span per segment
    const startFull = valueToDeg(seg.from);
    const endFull = valueToDeg(seg.to);
    let startDeg = startFull;
    let endDeg = endFull;
    if (i > 0) startDeg += gapDeg / 2;
    if (i < SEGMENTS.length - 1) endDeg -= gapDeg / 2;
    if (endDeg <= startDeg) return null; // safeguard
    const d = arcPath(cx, cy, r, startDeg, endDeg);
    return (
      <path
        key={i}
        d={d}
        fill="none"
        stroke={seg.color}
        strokeWidth={stroke}
        strokeLinecap="butt"
      />
    );
  });

  // Threshold marker (tick + dot)
  // Refined so the tick stays fully INSIDE the track thickness to avoid any stray artifact outside the semicircle.
  const thDeg = valueToDeg(threshold);
  const thRad = (thDeg * Math.PI) / 180;
  // Track thickness spans roughly (r - stroke/2) .. (r + stroke/2) visually; keep our tick slightly inset.
  const tickOuterR = r - stroke * 0.15; // inside outer edge
  const tickInnerR = r - stroke * 0.85; // near inner edge
  const thx1 = cx + tickInnerR * Math.cos(thRad);
  const thy1 = cy + tickInnerR * Math.sin(thRad);
  const thx2 = cx + tickOuterR * Math.cos(thRad);
  const thy2 = cy + tickOuterR * Math.sin(thRad);
  const dotR = 2;
  const dotCx = cx + (r - stroke * 0.5) * Math.cos(thRad);
  const dotCy = cy + (r - stroke * 0.5) * Math.sin(thRad);

  // Needle (triangle)
  const needleAngleDeg = valueToDeg(current);
  // Make needle visually smaller now that stroke is thicker: fixed geometry decoupled from stroke
  const needleGap = 10; // closer to arc (reduced gap)
  const needleLen = r - stroke / 2 - needleGap;
  const baseWidth = size === "lg" ? 14 : 12; // slightly wider
  const backLen = size === "lg" ? 20 : 18; // slightly longer tail

  const big = current.toFixed(1);
  const full = current.toFixed(2);
  // Removed detail line; only big number + small label remain

  return (
    <div
      className="flex flex-col items-center select-none"
      role="meter"
      aria-label={`Risk gauge: ${current.toFixed(1)}/10`}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-valuenow={Number(full)}
    >
      <svg
        width={pixelSize}
        height={pixelSize * 0.62}
        viewBox={`0 0 ${pixelSize} ${pixelSize * 0.62}`}
        className="overflow-visible"
      >
        <defs>
          {/* ClipPath inset by 1px inside track outer edge */}
          <clipPath id={`rg-clip-${size}`}>
            {(() => {
              const insetR = r - 1; // 1px inset
              const d = arcPath(cx, cy, insetR, -90, 90);
              return (
                <path
                  d={d}
                  fill="none"
                  stroke="white"
                  strokeWidth={stroke + 2}
                />
              );
            })()}
          </clipPath>
        </defs>
        <g clipPath={`url(#rg-clip-${size})`}>
          {/* Track */}
          <path
            d={trackPath}
            fill="none"
            stroke="#2B2F3A"
            strokeWidth={stroke}
            strokeLinecap="butt"
          />
          {/* Segments */}
          {segmentPaths}
          {/* Threshold tick & optional dot (dot only if value > threshold) */}
          {showThresholdTick && (
            <g data-testid="risk-threshold">
              <line
                x1={thx1}
                y1={thy1}
                x2={thx2}
                y2={thy2}
                stroke="#D06464"
                strokeWidth={2}
                strokeLinecap="round"
              />
              {showThresholdDot && current > threshold && (
                <circle
                  data-testid="risk-threshold-dot"
                  cx={dotCx}
                  cy={dotCy}
                  r={dotR}
                  fill="#D06464"
                />
              )}
            </g>
          )}
        </g>
        {/* Needle */}
        <g
          data-testid="risk-needle"
          style={{
            transition: "transform 220ms ease-out",
            transformOrigin: `${cx}px ${cy}px`,
            transform: `rotate(${needleAngleDeg - 90}deg)`,
          }}
        >
          {(() => {
            const neutralTipX = cx + needleLen;
            const neutralTipY = cy;
            const bcx = cx - backLen;
            const bcy = cy;
            const half = baseWidth / 2;
            return (
              <polygon
                points={`${neutralTipX},${neutralTipY} ${bcx},${bcy - half} ${bcx},${bcy + half}`}
                fill="#F5C74B"
                stroke="#1A1F2B"
                strokeWidth={1}
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
              />
            );
          })()}
          <circle
            cx={cx}
            cy={cy}
            r={6}
            fill="#1F2430"
            stroke="#3A4150"
            strokeWidth={2}
          />
        </g>
      </svg>
      {/* Typography block (simplified) */}
      <div className="-mt-3 flex flex-col items-center">
        <div
          className="text-[64px] leading-none font-semibold tracking-tight text-[#E6EAF2]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {big}
        </div>
        <div className="mt-1 text-[12px] tracking-[0.08em] text-[#9098A8] lowercase">
          riziko / 10
        </div>
      </div>
    </div>
  );
}

export default RiskGauge;
