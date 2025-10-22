import React from "react";

interface ToolbarProps {
  onMenuToggle: () => void;
  modeUi: "BASIC" | "PRO";
  onModeToggle: () => void;
  onReset?: () => void;
  onShare?: () => void;
  canShare?: boolean;
}

export default function Toolbar({
  onMenuToggle,
  modeUi,
  onModeToggle,
  onReset,
  onShare,
  canShare,
}: ToolbarProps) {
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  // Close popover on outside click
  React.useEffect(() => {
    if (!showResetConfirm) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-reset-popover]")) {
        setShowResetConfirm(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showResetConfirm]);
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
            <img
              src="/unotop_logo_transparent2.png"
              alt="UNOTOP logo"
              className="h-8 w-auto"
            />
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-100">
                UNOTOP
              </span>
              <span className="text-[10px] text-slate-400 -mt-1">
                Váš investičný plánovač
              </span>
            </div>
          </div>
        </div>

        {/* Right: Share Button + Reset + Mode Toggle */}
        <div className="flex items-center gap-2">
          {/* Share Button (Odoslať projekciu) */}
          {onShare && (
            <button
              type="button"
              disabled={!canShare}
              onClick={onShare}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                canShare
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-slate-700 text-slate-400 opacity-60 cursor-not-allowed"
              }`}
              aria-label="Odoslať projekciu agentovi"
              title={
                canShare
                  ? "Odoslať projekciu agentovi"
                  : "Dokončite všetky kroky pred odoslaním"
              }
            >
              <span className="text-sm" aria-hidden="true">
                📨
              </span>
              <span className="hidden sm:inline">Odoslať</span>
            </button>
          )}

          {/* Reset Button (small, red) */}
          {onReset && (
            <div className="relative" data-reset-popover>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="px-2.5 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 ring-1 ring-red-500/30 hover:ring-red-500/50 transition-all text-xs font-medium flex items-center gap-1.5"
                aria-label="Resetovať nastavenie"
                title="Vymazať všetky uložené nastavenia"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="hidden sm:inline">Reset</span>
              </button>

              {/* Confirmation popover */}
              {showResetConfirm && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 rounded-lg shadow-xl ring-1 ring-white/10 p-4 z-50">
                  <div className="text-sm mb-3">
                    <div className="font-semibold text-red-400 mb-1">
                      ⚠️ Resetovať nastavenie?
                    </div>
                    <div className="text-slate-400 text-xs">
                      Vymažú sa všetky uložené údaje (príjem, výdavky,
                      investície, portfólio).
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onReset();
                        setShowResetConfirm(false);
                      }}
                      className="flex-1 px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
                    >
                      Áno, vymazať
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors"
                    >
                      Zrušiť
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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
