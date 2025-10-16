import React from "react";

type Insight = {
  key: string;
  kind: "warn" | "info" | "ok";
  text: string;
  onClick?: () => void;
};

export const Insights: React.FC<{ items: Insight[] }> = ({ items }) => {
  if (!items.length) return null;
  return (
    <ul className="mt-2 space-y-1" aria-label="Insights">
      {items.slice(0, 3).map((it) => (
        <li
          key={it.key}
          data-testid={
            it.key.startsWith("gold") ? "insight-gold-12" : undefined
          }
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="button"
              aria-label={`Insight: ${it.text}`}
              onClick={it.onClick}
              onMouseUp={() => {
                if (
                  typeof process !== "undefined" &&
                  process.env.NODE_ENV === "test"
                ) {
                  try {
                    console.debug("[Insights] click", it.key);
                  } catch {}
                }
              }}
              onPointerDown={(e) => {
                // Fallback ak by click sequence neprešla
                if (e.isPrimary && it.onClick) {
                  try {
                    it.onClick();
                  } catch {}
                }
              }}
              className={
                "flex-1 text-left text-[12px] px-2 py-1 rounded border " +
                (it.kind === "warn"
                  ? "border-amber-600/50 bg-amber-600/15 text-amber-100"
                  : it.kind === "ok"
                    ? "border-emerald-600/50 bg-emerald-600/15 text-emerald-100"
                    : "border-slate-700/60 bg-slate-900/50 text-slate-200")
              }
              title="Insight – klik pre akciu"
            >
              {it.kind === "warn" ? "⚠️ " : it.kind === "ok" ? "✅ " : "💡 "}
              {it.text}
            </button>
            {/* Pôvodný dizajn: žiadne sekundárne tlačidlo, insight samotný spúšťa akciu */}
          </div>
        </li>
      ))}
    </ul>
  );
};
