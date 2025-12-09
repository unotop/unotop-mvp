import React from "react";
import { isDev, getEnvName } from "../shared/env"; // PR-16: DEV fallback v toolbare

interface ToolbarProps {
  onMenuToggle: () => void;
  modeUi: "BASIC" | "PRO";
  onModeToggle: () => void;
  onReset?: () => void;
  onShare?: () => void;
  canShare?: boolean;
  onTourRestart?: () => void;
  onContactClick?: () => void; // PR-14: Kontakt button
  onAdminOpen?: () => void; // PR-16: DEV fallback admin button
}

export default function Toolbar({
  onMenuToggle,
  modeUi,
  onModeToggle,
  onReset,
  onShare,
  canShare,
  onTourRestart,
  onContactClick, // PR-14
  onAdminOpen, // PR-16
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
      <div className="max-w-[1320px] mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Hamburger + Logo + App Name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onMenuToggle}
            aria-label="Otvoriť menu"
            className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
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
          <div
            className="flex items-center gap-1.5 sm:gap-2 min-w-0 no-select"
            data-logo="true"
          >
            <img
              src="/unotop_logo.png"
              alt="UNOTOP logo"
              className="h-7 sm:h-8 w-auto flex-shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-base sm:text-lg font-bold tracking-tight text-slate-100 truncate">
                UNOTOP – majetkový plánovač
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 -mt-0.5 sm:-mt-1 hidden xs:block">
                Váš investičný plánovač
              </span>
            </div>
          </div>

          {/* PR-16: DEV fallback admin button (presunúté z bottom-right floating) */}
          {isDev() && onAdminOpen && (
            <button
              type="button"
              onClick={() => {
                console.log(
                  `[Toolbar] DEV admin button clicked in ${getEnvName()}`
                );
                onAdminOpen();
              }}
              className="p-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-700 text-white ring-1 ring-purple-400/50 hover:ring-purple-300 transition-all flex-shrink-0"
              title="Admin Console (DEV)"
              aria-label="Otvoriť admin konzolu (DEV)"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Right: Info + Share Button + Reset + Mode Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Info Button - Opens Welcome Modal */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("openWelcomeModal"))}
            className="p-1.5 sm:p-2 rounded-lg bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 hover:text-blue-300 ring-1 ring-blue-500/30 hover:ring-blue-500/50 transition-all flex-shrink-0"
            aria-label="Zobraziť návod"
            title="Zobraziť návod na použitie"
          >
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          {/* Onboarding Tour Button */}
          {onTourRestart && (
            <button
              type="button"
              onClick={onTourRestart}
              className="px-2 sm:px-3 py-1.5 rounded-lg bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 hover:text-blue-300 ring-1 ring-blue-500/30 hover:ring-blue-500/50 transition-all text-xs font-medium flex items-center gap-1 sm:gap-1.5 flex-shrink-0"
              aria-label="Spustiť sprievodcu – krátky návod, ako funguje plánovač"
              title="Spustiť sprievodcu – krátky návod, ako funguje plánovač"
            >
              <span className="text-xs sm:text-sm" aria-hidden="true">
                🎓
              </span>
              <span className="hidden sm:inline">Sprievodca</span>
            </button>
          )}

          {/* PR-14: Kontakt Button */}
          {onContactClick && (
            <button
              type="button"
              onClick={onContactClick}
              className="px-2 sm:px-3 py-1.5 rounded-lg bg-purple-900/30 hover:bg-purple-900/50 text-purple-400 hover:text-purple-300 ring-1 ring-purple-500/30 hover:ring-purple-500/50 transition-all text-xs font-medium flex items-center gap-1 sm:gap-1.5 flex-shrink-0"
              aria-label="Kontakt s autorom"
              title="Zobraziť informácie o autorovi"
            >
              <span className="text-xs sm:text-sm" aria-hidden="true">
                👤
              </span>
              <span className="hidden sm:inline">Kontakt</span>
            </button>
          )}

          {/* Share Button (Odoslať projekciu) */}
          {onShare && (
            <button
              type="button"
              disabled={!canShare}
              onClick={onShare}
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition-all flex-shrink-0 ${
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
              <span className="text-xs sm:text-sm" aria-hidden="true">
                📨
              </span>
              <span className="hidden sm:inline">Odoslať</span>
            </button>
          )}

          {/* Reset Button (small, red) */}
          {onReset && (
            <div className="relative flex-shrink-0" data-reset-popover>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 ring-1 ring-red-500/30 hover:ring-red-500/50 transition-all text-xs font-medium flex items-center gap-1 sm:gap-1.5"
                aria-label="Resetovať nastavenie"
                title="Vymazať všetky uložené nastavenia"
              >
                <svg
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5"
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
          <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-lg bg-slate-800/50 ring-1 ring-white/10 flex-shrink-0">
            <button
              type="button"
              onClick={() => modeUi !== "BASIC" && onModeToggle()}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded text-[10px] sm:text-xs font-medium transition-all ${
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
              onClick={onModeToggle}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded text-[10px] sm:text-xs font-medium transition-all ${
                modeUi === "PRO"
                  ? "bg-amber-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              aria-pressed={modeUi === "PRO"}
              aria-label="Prepnúť na PRO režim"
              title="PRO režim je v aktívnom vývoji"
            >
              PRO
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
