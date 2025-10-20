import React from 'react';

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
  { id: 'profil', label: 'Profil & Rezerva', sectionId: 'sec0', icon: '👤' },
  { id: 'cashflow', label: 'Cashflow', sectionId: 'sec1', icon: '💰' },
  { id: 'invest', label: 'Investície', sectionId: 'sec2', icon: '📈' },
  { id: 'mix', label: 'Portfólio Mix', sectionId: 'sec3', icon: '🎯' },
  { id: 'debts', label: 'Dlhy & Hypotéky', sectionId: 'sec4', icon: '🏦' },
  { id: 'metrics', label: 'Metriky', sectionId: 'sec5', icon: '📊' },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [activeSection, setActiveSection] = React.useState<string>('sec0');

  // IntersectionObserver pre tracking aktívnej sekcie
  React.useEffect(() => {
    // Skip IntersectionObserver in test environment (JSDOM)
    if (typeof IntersectionObserver === 'undefined') return;

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

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
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Mobile: zavri sidebar po kliknutí
      if (window.innerWidth < 1024) {
        onClose();
      }
    }
  };

  // Esc key handler (mobile overlay)
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Mobile backdrop (overlay) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-slate-900/95 backdrop-blur-sm
          border-r border-white/10 z-50 
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        role="navigation"
        aria-label="Hlavné menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <span>UNOTOP</span>
          </h2>
          {/* Close button (mobile only) */}
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white transition-colors p-2"
            aria-label="Zavrieť menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer (optional info) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <p className="text-xs text-slate-500 text-center">
            v0.6.0-beta
          </p>
        </div>
      </aside>
    </>
  );
}
