import React from "react";
import { readV3, writeV3 } from "../persist/v3";

interface WelcomeModalProps {
  onClose: () => void;
}

export default function WelcomeModal({ onClose }: WelcomeModalProps) {
  const [hideNext, setHideNext] = React.useState(false);

  React.useEffect(() => {
    // Lock scroll when modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleClose = () => {
    if (hideNext) {
      // Save preference to persist
      const cur = readV3();
      writeV3({ profile: { ...(cur.profile || {}), hideTour: true } as any });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-950/95 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="relative w-full max-w-xl my-4 sm:my-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl ring-1 ring-white/10 overflow-hidden">
        {/* Header with gradient accent */}
        <div className="bg-gradient-to-r from-emerald-600/20 to-blue-600/20 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6">
          <h1
            id="welcome-title"
            className="text-2xl sm:text-3xl font-bold text-white mb-2 flex items-center gap-2 sm:gap-3"
          >
            <span className="text-3xl sm:text-4xl">🎯</span>
            Vitajte v UNOTOP plánovači
          </h1>
          <p className="text-slate-300 text-base sm:text-lg">
            Váš osobný nástroj na investičné modelovanie
          </p>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
          {/* Feature list */}
          <div className="space-y-4">
            <Feature
              icon="💰"
              title="Plánujte svoje financie"
              description="Modelujte príjmy, výdavky, dlhy a investičné ciele v reálnom čase."
            />
            <Feature
              icon="📊"
              title="Vizualizujte portfólio"
              description="Sledujte vývoj majetku s interaktívnymi grafmi a projekciami."
            />
            <Feature
              icon="🎛️"
              title="Dva režimy: BASIC a PRO"
              description="BASIC pre rýchly štart, PRO pre pokročilé nastavenia a detailnú kontrolu."
            />
            <Feature
              icon="🔒"
              title="Súkromie zaručené"
              description="Dáta ostávajú len v tvojom prehliadači. Iba pri odoslaní projekcie odošleme kontaktné údaje bezpečne cez EmailJS na účel spätného kontaktu."
            />
            <div className="mt-2 pl-12">
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Zásady ochrany súkromia
              </a>
            </div>
          </div>

          {/* Checkbox: Nezobrazovať nabudúce */}
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <input
              type="checkbox"
              id="hide-tour"
              checked={hideNext}
              onChange={(e) => setHideNext(e.target.checked)}
              className="accent-emerald-500"
            />
            <label
              htmlFor="hide-tour"
              className="text-sm text-slate-300 cursor-pointer"
            >
              Nezobrazovať nabudúce
            </label>
          </div>

          {/* Quick tips */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
              <span>💡</span> Rýchly štart
            </h3>
            <ul className="text-sm text-slate-300 space-y-1 ml-6 list-disc">
              <li>
                Zadajte <strong>mesačný príjem</strong> a{" "}
                <strong>investičný vklad</strong>
              </li>
              <li>
                Vyberte si <strong>rizikový profil</strong> (Konzervatívny /
                Vyvážený / Dynamický)
              </li>
              <li>
                Kliknite na <strong>predpripravené portfólio</strong>
              </li>
              <li>
                Sledujte <strong>projekciu rastu</strong> v grafe vpravo
              </li>
            </ul>
          </div>

          {/* CTA Button */}
          <div className="flex justify-center pt-2 sm:pt-4">
            <button
              onClick={handleClose}
              className="px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 hover:scale-105 active:scale-95 text-sm sm:text-base"
              autoFocus
            >
              🚀 Začať plánovať
            </button>
          </div>

          {/* Footer note */}
          <p className="text-[10px] sm:text-xs text-slate-500 text-center pt-2">
            {hideNext
              ? "Sprievodca môžete znova spustiť v hornom menu"
              : "Toto okno sa zobrazuje iba pri prvom otvorení stránky"}
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 items-start">
      <span className="text-3xl flex-shrink-0">{icon}</span>
      <div>
        <h3 className="font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    </div>
  );
}
