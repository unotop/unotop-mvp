import React from "react";

interface ToolbarProps {
  onMenuToggle: () => void;
  modeUi: "BASIC" | "PRO";
  onModeToggle: () => void;
}

export default function Toolbar({
  onMenuToggle,
  modeUi,
  onModeToggle,
}: ToolbarProps) {
  return (
    <header
      className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-white/10"
      role="banner"
    >
      <div className="max-w-[1320px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Left: Hamburger + Logo + App Name */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            aria-label="Otvoriť menu"
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl" role="img" aria-label="Logo">
              🏆
            </span>
            <span className="text-xl font-bold tracking-tight">UNOTOP</span>
          </div>
        </div>

        {/* Right: Mode Toggle only (Share je v sticky right panel) */}
        <div className="flex items-center gap-2">
          {/* BASIC/PRO Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-800/50 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => modeUi !== "BASIC" && onModeToggle()}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                modeUi === "BASIC"
                  ? "bg-emerald-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              aria-pressed={modeUi === "BASIC"}
              aria-label="Prepnúť na BASIC režim"
            >
              BASIC
            </button>
            <button
              type="button"
              onClick={() => modeUi !== "PRO" && onModeToggle()}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                modeUi === "PRO"
                  ? "bg-amber-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              aria-pressed={modeUi === "PRO"}
              aria-label="Prepnúť na PRO režim"
            >
              PRO
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
