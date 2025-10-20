import React from "react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: string;
  label: string;
  sectionId: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "profil", label: "Profil & Rezerva", sectionId: "sec0", icon: "👤" },
  { id: "cashflow", label: "Cashflow", sectionId: "sec1", icon: "💰" },
  { id: "invest", label: "Investície", sectionId: "sec2", icon: "📈" },
  { id: "mix", label: "Portfólio Mix", sectionId: "sec3", icon: "🎯" },
  { id: "debts", label: "Dlhy & Hypotéky", sectionId: "sec4", icon: "🏦" },
  { id: "metrics", label: "Metriky", sectionId: "sec5", icon: "📊" },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [activeSection, setActiveSection] = React.useState<string>("sec0");

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
        `}
        role="navigation"
        aria-label="Hlavné menu"
      >
        {/* Navigation links */}
        <nav className="p-4 space-y-1">
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
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
