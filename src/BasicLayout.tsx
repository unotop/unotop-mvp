import React from "react";
import PageLayout from "./app/PageLayout";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import { BasicSettingsPanel } from "./features/basic/BasicSettingsPanel";
import PortfolioSelector from "./features/portfolio/PortfolioSelector";
import { ProjectionMetricsPanel } from "./features/overview/ProjectionMetricsPanel";
import { readV3, writeV3 } from "./persist/v3";
import { createMixListener } from "./persist/mixEvents";
import type { MixItem } from "./features/mix/mix.service";

/**
 * BasicLayout - jednoduchá verzia pre nováčikov
 * Left: Nastavenia (profil+cashflow+invest) + Portfolio
 * Right: Projekcia & Metriky (spojené)
 */
export default function BasicLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [open0, setOpen0] = React.useState(true); // Settings panel
  const [open3, setOpen3] = React.useState(true); // Portfolio panel
  const [shareOpen, setShareOpen] = React.useState(false);
  const shareBtnRef = React.useRef<HTMLButtonElement>(null);

  const seed = readV3();
  const modeUi = (seed.profile?.modeUi as any) || "BASIC";

  // Mix sync from localStorage
  const [mix, setMix] = React.useState<MixItem[]>(() => {
    const v3 = readV3();
    return (v3.mix || []) as MixItem[];
  });

  // Investment params sync (pre ProjectionMetricsPanel reaktivitu)
  const [investParams, setInvestParams] = React.useState(() => {
    const v3 = readV3();
    return {
      lumpSumEur: (v3.profile?.lumpSumEur as any) || 0,
      monthlyVklad: (v3 as any).monthly || 0,
      horizonYears: (v3.profile?.horizonYears as any) || 10,
      goalAssetsEur: (v3.profile?.goalAssetsEur as any) || 0,
    };
  });

  React.useEffect(() => {
    const unsub = createMixListener((newMix) => {
      setMix(newMix as MixItem[]);
    });
    return unsub;
  }, []);

  // Sync invest params from persist (100ms polling)
  React.useEffect(() => {
    const interval = setInterval(() => {
      const v3 = readV3();
      setInvestParams({
        lumpSumEur: (v3.profile?.lumpSumEur as any) || 0,
        monthlyVklad: (v3 as any).monthly || 0,
        horizonYears: (v3.profile?.horizonYears as any) || 10,
        goalAssetsEur: (v3.profile?.goalAssetsEur as any) || 0,
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleModeToggle = () => {
    const cur = readV3();
    const newMode = modeUi === "BASIC" ? "PRO" : "BASIC";
    writeV3({ profile: { ...(cur.profile || {}), modeUi: newMode } as any });
    window.location.reload(); // Force refresh to switch layout
  };

  const left = (
    <div className="min-w-0 space-y-4" data-testid="left-col">
      <BasicSettingsPanel open={open0} onToggle={() => setOpen0((v) => !v)} />

      {/* Portfolio selector */}
      <button
        type="button"
        aria-controls="sec3"
        aria-expanded={open3}
        onClick={() => setOpen3((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-3 rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors text-left font-semibold"
      >
        <span id="portfolio-title">Zloženie portfólia</span>
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${open3 ? "" : "rotate-180"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open3 && (
        <section
          id="sec3"
          role="region"
          aria-labelledby="portfolio-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5 transition-all duration-300"
        >
          <div className="mb-4" data-testid="mixpanel-slot">
            <PortfolioSelector />
          </div>
        </section>
      )}
    </div>
  );

  const right = (
    <div className="space-y-4">
      <ProjectionMetricsPanel
        mix={mix}
        lumpSumEur={investParams.lumpSumEur}
        monthlyVklad={investParams.monthlyVklad}
        horizonYears={investParams.horizonYears}
        goalAssetsEur={investParams.goalAssetsEur}
        riskPref={
          seed.profile?.riskPref || (seed as any).riskPref || "vyvazeny"
        }
      />

      {/* Share CTA */}
      <section className="w-full min-w-0 rounded-2xl ring-1 ring-emerald-500/30 bg-gradient-to-br from-emerald-900/40 to-emerald-950/20 p-4 md:p-5">
        <button
          ref={shareBtnRef}
          type="button"
          onClick={() => setShareOpen(true)}
          className="group relative w-full px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold text-lg shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 overflow-hidden"
          aria-label="Zdieľať s advisorom"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          <div className="relative flex items-center justify-center gap-3">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            <span>Odoslať advisorovi</span>
          </div>
        </button>
        <p className="mt-3 text-xs text-center text-slate-400">
          Zdieľajte vašu projekciu emailom
        </p>
      </section>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Toolbar
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        modeUi={modeUi}
        onModeToggle={handleModeToggle}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <PageLayout left={left} right={right} />

      {/* Share modal placeholder - implementujeme neskôr ak treba */}
      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="bg-slate-900 p-6 rounded-xl max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Zdieľať projekciu</h2>
            <p className="text-sm text-slate-400 mb-4">
              TODO: Share modal (použiť z LegacyApp)
            </p>
            <button
              className="px-4 py-2 bg-emerald-600 rounded"
              onClick={() => setShareOpen(false)}
            >
              Zavrieť
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
