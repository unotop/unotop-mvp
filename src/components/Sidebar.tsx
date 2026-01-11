import React from "react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "BASIC" | "PRO"; // Determines which nav items to show
  // Action callbacks (toolbar buttons)
  modeUi?: "BASIC" | "PRO";
  onModeToggle?: () => void;
  onReset?: () => void;
  onShare?: () => void;
  canShare?: boolean;
  onTourRestart?: () => void;
  onContactClick?: () => void;
  onInfoClick?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  sectionId: string;
  icon: string;
  showInBasic?: boolean; // If false, hide in BASIC mode
}

const NAV_ITEMS_BASIC: NavItem[] = [
  {
    id: "settings",
    label: "Vstupné údaje",
    sectionId: "sec0",
    icon: "clipboard", // Heroicon in render
    showInBasic: true,
  },
  {
    id: "portfolio",
    label: "Portfólio",
    sectionId: "sec3",
    icon: "chart-pie", // Heroicon in render
    showInBasic: true,
  },
];

const NAV_ITEMS_PRO: NavItem[] = [
  {
    id: "profil",
    label: "Profil & Rezerva",
    sectionId: "sec0",
    icon: "👤",
    showInBasic: false,
  },
  {
    id: "cashflow",
    label: "Cashflow",
    sectionId: "sec1",
    icon: "💰",
    showInBasic: false,
  },
  {
    id: "invest",
    label: "Investície",
    sectionId: "sec2",
    icon: "📈",
    showInBasic: false,
  },
  {
    id: "mix",
    label: "Portfólio Mix",
    sectionId: "sec3",
    icon: "🎯",
    showInBasic: false,
  },
  {
    id: "debts",
    label: "Dlhy & Hypotéky",
    sectionId: "sec4",
    icon: "🏦",
    showInBasic: false,
  },
  {
    id: "metrics",
    label: "Metriky",
    sectionId: "sec5",
    icon: "📊",
    showInBasic: false,
  },
];

export default function Sidebar({
  isOpen,
  onClose,
  mode = "BASIC",
  modeUi,
  onModeToggle,
  onReset,
  onShare,
  canShare,
  onTourRestart,
  onContactClick,
  onInfoClick,
}: SidebarProps) {
  const [activeSection, setActiveSection] = React.useState<string>("sec0");
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  // Select nav items based on mode
  const NAV_ITEMS = mode === "BASIC" ? NAV_ITEMS_BASIC : NAV_ITEMS_PRO;

  // IntersectionObserver pre tracking aktívnej sekcie
  React.useEffect(() => {
    // Skip IntersectionObserver in test environment (JSDOM)
    if (typeof IntersectionObserver === "undefined") return;

    const observerOptions = {
      root: null,
      rootMargin: "-20% 0px -70% 0px",
      threshold: 0,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(
      observerCallback,
      observerOptions
    );

    NAV_ITEMS.forEach((item) => {
      const el = document.getElementById(item.sectionId);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Smooth scroll to section
  const handleNavClick = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // Zavri sidebar po kliknutí (desktop aj mobile)
      onClose();
    }
  };

  // Esc key handler
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop (overlay) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel - vždy overlay */}
      <aside
        className={`
          fixed top-16 left-0 bottom-0 w-64 bg-slate-900/95 backdrop-blur-sm
          border-r border-white/10 z-50 
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          overflow-y-auto
        `}
        role="navigation"
        aria-label="Hlavné menu"
      >
        {/* Navigation links */}
        <nav className="p-4 pb-24 space-y-3">
          {/* Section 1: Navigation */}
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.sectionId;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.sectionId)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                        : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                    }
                  `}
                  aria-current={isActive ? "page" : undefined}
                >
                  {/* Heroicon based on item.icon */}
                  {item.icon === "clipboard" ? (
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  ) : item.icon === "chart-pie" ? (
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
                      />
                    </svg>
                  ) : (
                    <span className="text-xl">{item.icon}</span>
                  )}
                  <span className="font-medium text-sm">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 my-3" />

          {/* Section 2: Action Buttons */}
          <div className="space-y-1">
            {/* Info Button */}
            {onInfoClick && (
              <button
                type="button"
                onClick={() => {
                  onInfoClick();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-blue-900/30 hover:text-blue-300 transition-all duration-200 group"
                aria-label="Zobraziť návod"
              >
                <svg
                  className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110"
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
                <span className="font-medium text-sm">Intro</span>
              </button>
            )}

            {/* Onboarding Tour Button */}
            {onTourRestart && (
              <button
                type="button"
                onClick={() => {
                  onTourRestart();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-blue-900/30 hover:text-blue-300 transition-all duration-200 group"
                aria-label="Spustiť sprievodcu"
              >
                <svg
                  className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 14l9-5-9-5-9 5 9 5z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
                  />
                </svg>
                <span className="font-medium text-sm">Návod</span>
              </button>
            )}

            {/* Contact Button */}
            {onContactClick && (
              <button
                type="button"
                onClick={() => {
                  onContactClick();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-purple-900/30 hover:text-purple-300 transition-all duration-200 group"
                aria-label="Kontakt s autorom"
              >
                <svg
                  className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span className="font-medium text-sm">Kontakt</span>
              </button>
            )}

            {/* Reset Button */}
            {onReset && (
              <div className="relative">
                {!showResetConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-900/30 hover:text-red-300 transition-all duration-200 group"
                    aria-label="Resetovať nastavenie"
                  >
                    <svg
                      className="w-5 h-5 flex-shrink-0 transition-transform group-hover:rotate-180"
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
                    <span className="font-medium text-sm">Reset nastavení</span>
                  </button>
                ) : (
                  <div className="bg-slate-800 rounded-lg p-3 ring-1 ring-red-500/30">
                    <div className="text-xs text-slate-400 mb-2">
                      ⚠️ Vymazať všetky údaje?
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onReset();
                          setShowResetConfirm(false);
                          onClose();
                        }}
                        className="flex-1 px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
                      >
                        Áno
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResetConfirm(false)}
                        className="flex-1 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors"
                      >
                        Nie
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Share Button */}
            {onShare && (
              <button
                type="button"
                disabled={!canShare}
                onClick={() => {
                  if (canShare) {
                    onShare();
                    onClose();
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                  canShare
                    ? "text-slate-300 hover:bg-emerald-900/30 hover:text-emerald-300"
                    : "text-slate-500 opacity-50 cursor-not-allowed"
                }`}
                aria-label="Odoslať projekciu agentovi"
                title={
                  canShare
                    ? "Odoslať projekciu agentovi"
                    : "Dokončite všetky kroky pred odoslaním"
                }
              >
                <svg
                  className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110 group-hover:translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                <span className="font-medium text-sm">Odoslať projekciu</span>
              </button>
            )}
          </div>

          {/* Divider */}
          {onModeToggle && <div className="border-t border-white/10 my-3" />}

          {/* Section 3: Mode Toggle */}
          {onModeToggle && modeUi && (
            <div className="px-2">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-800/50 ring-1 ring-white/10">
                <button
                  type="button"
                  onClick={() => {
                    if (modeUi !== "BASIC") {
                      onModeToggle();
                      onClose();
                    }
                  }}
                  className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-all ${
                    modeUi === "BASIC"
                      ? "bg-emerald-600 text-white shadow-lg"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  aria-pressed={modeUi === "BASIC"}
                  aria-label="Prepnúť na BASIC režim"
                  data-testid="mode-toggle-sidebar-basic"
                >
                  BASIC
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (modeUi !== "PRO") {
                      onModeToggle();
                      onClose();
                    }
                  }}
                  className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-all ${
                    modeUi === "PRO"
                      ? "bg-amber-600 text-white shadow-lg"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  aria-pressed={modeUi === "PRO"}
                  aria-label="Prepnúť na PRO režim (sidebar menu)"
                  data-testid="mode-toggle-sidebar-pro"
                >
                  PRO
                </button>
              </div>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
