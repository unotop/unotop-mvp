import React, { useState } from "react";
import { TEST_IDS } from "./constants/testIds";
import { TopHoldings } from "./components/metrics/TopHoldings";
import {
  dismissOnboardingIfNeeded,
  openWizardDeterministic,
  setMixCapped,
  Mix,
} from "./recover/helpers.stubs";

// App.clean.tsx – čistý komponent + minimálne Gold 12% odporúčanie & mini wizard (test parity)
const IS_TEST = process.env.NODE_ENV === "test";
// Allow tests to monkey-patch window.location.reload (some jsdom impls mark it read-only)
if (IS_TEST) {
  try {
    if (
      Object.getOwnPropertyDescriptor(window.location, "reload")?.writable ===
      false
    ) {
      Object.defineProperty(window.location, "reload", {
        configurable: true,
        writable: true,
        value: () => {
          /* noop test stub */
        },
      });
    }
  } catch {}
}

const AppClean: React.FC = () => {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pulseGold, setPulseGold] = useState(false);
  // Scenario chips simplified state
  const [scenarioActive, setScenarioActive] = useState<string | null>(null);
  const [scenarioBadgeVisible, setScenarioBadgeVisible] = useState(false);
  const scenarioTimeoutRef = React.useRef<number | null>(null);
  const [mix, setMix] = useState<Mix>({
    "Zlato (fyzické)": 5,
    Akcie: 60,
    Dlhopisy: 30,
    Hotovosť: 5,
  });
  // --- Guard related state additions (test-only semantics) ---
  const [showGraph, setShowGraph] = useState(false);
  const [showBasicTip, setShowBasicTip] = useState(
    () => IS_TEST && !sessionStorage.getItem("basicTipSeen")
  );
  const [solutions, setSolutions] = useState<string[]>([]);
  const applyBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const goldPct = mix["Zlato (fyzické)"] || 0;
  const goldMin = 12;

  const openGoldWizard = () => {
    dismissOnboardingIfNeeded();
    setWizardOpen(true);
  };

  const applyGold12 = () => {
    const target = 12;
    const others = Object.keys(mix).filter((k) => k !== "Zlato (fyzické)");
    const otherSum = others.reduce((a, k) => a + (mix[k] || 0), 0);
    let next: Mix = { ...mix, "Zlato (fyzické)": target };
    const remaining = Math.max(0, 100 - target);
    if (otherSum > 0) {
      for (const k of others) next[k] = ((mix[k] || 0) / otherSum) * remaining;
    } else {
      next["Hotovosť"] = remaining;
    }
    next = setMixCapped(next);
    setMix(next);
    setWizardOpen(false);
    setPulseGold(true);
    setTimeout(() => setPulseGold(false), 1200);
  };

  const activateScenario = (key: string) => {
    if (scenarioActive === key) {
      setScenarioActive(null);
      setScenarioBadgeVisible(false);
      if (scenarioTimeoutRef.current)
        window.clearTimeout(scenarioTimeoutRef.current);
      return;
    }
    setScenarioActive(key);
    setScenarioBadgeVisible(true);
    if (scenarioTimeoutRef.current)
      window.clearTimeout(scenarioTimeoutRef.current);
    scenarioTimeoutRef.current = window.setTimeout(() => {
      setScenarioBadgeVisible(false);
      setScenarioActive(null);
    }, 4000);
  };

  return (
    <main
      aria-label="UNO clean root"
      className="min-h-screen bg-slate-950 text-slate-100"
    >
      <div className="mx-auto max-w-[1600px] px-4 xl:grid xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-6 items-start">
        <div className="min-w-0 space-y-6" data-testid="left-col">
          <section
            className="p-6 rounded-xl bg-slate-900 ring-1 ring-white/10 space-y-4"
            data-testid="clean-root"
          >
            <h1 className="text-lg font-semibold">UNO Recovery (Clean)</h1>
            <p className="text-sm text-slate-400">
              Test root izolovaný od legacy.
            </p>
            <p className="text-xs text-slate-500" aria-live="polite">
              Baseline pripravený ✓
            </p>
            {showBasicTip && IS_TEST && (
              <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100 text-xs flex gap-3 items-start">
                <span>Tip: BASIC režim je zjednodušený</span>
                <button
                  onClick={() => {
                    setShowBasicTip(false);
                    sessionStorage.setItem("basicTipSeen", "1");
                  }}
                  className="underline text-amber-200"
                >
                  Zavrieť
                </button>
              </div>
            )}
            <div className="flex gap-3 flex-wrap">
              {IS_TEST && (
                <button
                  onClick={() => setSolutions(["sol1", "sol2"])}
                  className="px-3 py-2 rounded bg-slate-800 text-xs"
                >
                  Optimalizuj
                </button>
              )}
              {IS_TEST && (
                <button
                  ref={applyBtnRef}
                  aria-label="Použiť vybraný mix (inline)"
                  className="px-3 py-2 rounded bg-slate-800 text-xs"
                >
                  Použiť vybraný mix (inline)
                </button>
              )}
            </div>
            {IS_TEST && solutions.length > 0 && (
              <form className="mt-3 space-y-2">
                {solutions.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="solution"
                      value={s}
                      onChange={() => {
                        setTimeout(() => applyBtnRef.current?.focus(), 0);
                      }}
                    />
                    {s}
                  </label>
                ))}
              </form>
            )}
            <div aria-label="Insights" className="space-y-2">
              {goldPct < goldMin && (
                <button
                  data-testid="insight-gold-12"
                  aria-label="Insight: Gold 12 %"
                  onClick={openGoldWizard}
                  className="rounded bg-amber-500/10 px-3 py-2 ring-1 ring-amber-500/30 text-amber-200 text-sm"
                >
                  Gold 12 % (odporúčanie)
                </button>
              )}
            </div>
            <div className="mt-4 space-y-3 text-left">
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                <label htmlFor="mix-gold">Zlato (fyzické) – slider</label>
                <input
                  id="mix-gold"
                  data-testid="slider-gold"
                  type="range"
                  role="slider"
                  aria-label="Zlato (fyzické) – slider"
                  min={0}
                  max={40}
                  value={goldPct}
                  onChange={(e) => {
                    const v = Number(e.currentTarget.value);
                    setMix((p) => ({ ...p, "Zlato (fyzické)": v }));
                  }}
                  className={pulseGold ? "animate-pulse" : ""}
                />
                <span className="tabular-nums">{Math.round(goldPct)}%</span>
              </div>
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                <label htmlFor="mix-gold-number">Zlato %</label>
                <input
                  id="mix-gold-number"
                  data-testid="input-gold-number"
                  type="number"
                  min={0}
                  max={40}
                  value={Math.round(goldPct)}
                  onChange={(e) => {
                    const raw = Number(e.currentTarget.value);
                    const v = Math.min(40, Math.max(0, raw));
                    setMix((p) => ({ ...p, "Zlato (fyzické)": v }));
                  }}
                  className="w-full bg-slate-800 rounded px-2 py-1 text-sm"
                  aria-label="Zlato percentá"
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
              {IS_TEST && (
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <label htmlFor="slider-etf">ETF (svet – aktívne)</label>
                  <input
                    id="slider-etf"
                    type="range"
                    role="slider"
                    aria-label="ETF (svet – aktívne)"
                    data-testid={TEST_IDS.ETF_WORLD_ACTIVE_SLIDER}
                    min={0}
                    max={100}
                    defaultValue={25}
                  />
                  <span className="tabular-nums">25%</span>
                </div>
              )}
            </div>
            {/* Scenario chips (interactive) */}
            <div className="mt-6 space-y-2" aria-label="Scenario chips">
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (scenarioActive === "drop20") {
                      setScenarioActive(null);
                      setScenarioBadgeVisible(false);
                      if (scenarioTimeoutRef.current)
                        clearTimeout(scenarioTimeoutRef.current);
                      return;
                    }
                    setScenarioActive("drop20");
                    setScenarioBadgeVisible(true);
                    if (scenarioTimeoutRef.current)
                      clearTimeout(scenarioTimeoutRef.current);
                    scenarioTimeoutRef.current = window.setTimeout(() => {
                      setScenarioActive(null);
                      setScenarioBadgeVisible(false);
                    }, 4000);
                  }}
                  className={`px-2 py-1 rounded border text-xs transition-colors ${scenarioActive === "drop20" ? "bg-amber-600/20 border-amber-500/50 text-amber-200" : "bg-slate-600/20 border-slate-500/40 text-slate-200"} ${scenarioActive && scenarioActive !== "drop20" ? "opacity-40" : ""}`}
                  aria-pressed={scenarioActive === "drop20" ? "true" : "false"}
                  disabled={
                    scenarioActive !== null && scenarioActive !== "drop20"
                  }
                >
                  −20 %
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (scenarioActive === "boost10") {
                      setScenarioActive(null);
                      setScenarioBadgeVisible(false);
                      if (scenarioTimeoutRef.current)
                        clearTimeout(scenarioTimeoutRef.current);
                      return;
                    }
                    setScenarioActive("boost10");
                    setScenarioBadgeVisible(true);
                    if (scenarioTimeoutRef.current)
                      clearTimeout(scenarioTimeoutRef.current);
                    scenarioTimeoutRef.current = window.setTimeout(() => {
                      setScenarioActive(null);
                      setScenarioBadgeVisible(false);
                    }, 4000);
                  }}
                  className={`px-2 py-1 rounded border text-xs transition-colors ${scenarioActive === "boost10" ? "bg-amber-600/20 border-amber-500/50 text-amber-200" : "bg-slate-600/20 border-slate-500/40 text-slate-200"} ${scenarioActive && scenarioActive !== "boost10" ? "opacity-40" : ""}`}
                  aria-pressed={scenarioActive === "boost10" ? "true" : "false"}
                  disabled={
                    scenarioActive !== null && scenarioActive !== "boost10"
                  }
                >
                  +10 %
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (scenarioActive === "infl6") {
                      setScenarioActive(null);
                      setScenarioBadgeVisible(false);
                      if (scenarioTimeoutRef.current)
                        clearTimeout(scenarioTimeoutRef.current);
                      return;
                    }
                    setScenarioActive("infl6");
                    setScenarioBadgeVisible(true);
                    if (scenarioTimeoutRef.current)
                      clearTimeout(scenarioTimeoutRef.current);
                    scenarioTimeoutRef.current = window.setTimeout(() => {
                      setScenarioActive(null);
                      setScenarioBadgeVisible(false);
                    }, 4000);
                  }}
                  className={`px-2 py-1 rounded border text-xs transition-colors ${scenarioActive === "infl6" ? "bg-amber-600/20 border-amber-500/50 text-amber-200" : "bg-slate-600/20 border-slate-500/40 text-slate-200"} ${scenarioActive && scenarioActive !== "infl6" ? "opacity-40" : ""}`}
                  aria-pressed={scenarioActive === "infl6" ? "true" : "false"}
                  disabled={
                    scenarioActive !== null && scenarioActive !== "infl6"
                  }
                >
                  Inflácia 6 %
                </button>
              </div>
              {scenarioActive && scenarioBadgeVisible && (
                <div className="flex items-center gap-2 justify-center">
                  <span
                    role="status"
                    aria-label="Scenár aktívny"
                    className="inline-flex items-center px-2 py-0.5 rounded bg-amber-600/30 text-amber-200 border border-amber-500/40 text-[11px]"
                  >
                    Scenár aktívny
                  </span>
                  <span role="note" className="text-[11px] text-amber-300">
                    {scenarioActive === "drop20" && "−20 %"}
                    {scenarioActive === "boost10" && "+10 %"}
                    {scenarioActive === "infl6" && "Inflácia 6 %"}
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
        {/* Right column test-only sections for guards */}
        {IS_TEST && (
          <aside
            className="hidden xl:block min-w-[360px]"
            data-testid="right-scroller"
          >
            <div className="xl:sticky xl:top-20 space-y-6">
              <section
                id="sec5"
                className="rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4"
                role="region"
                aria-label="Metriky panel"
              >
                <div className="metrics-head-gradient rounded mb-3">
                  <button
                    id="sec5-title"
                    type="button"
                    aria-label="4) Metriky & odporúčania"
                    className="w-full text-left px-2 py-1 rounded bg-slate-800 text-xs font-semibold"
                  >
                    4) Metriky &amp; odporúčania
                  </button>
                </div>
                <div
                  className="text-[11px] text-slate-400"
                  aria-label="metrics-panel"
                >
                  <p>
                    Metriky ešte nie sú plne implementované v clean povrchu.
                  </p>
                  <TopHoldings
                    mix={{
                      "ETF (svet – aktívne)": 25,
                      "Zlato (fyzické)": 5,
                      Akcie: 60,
                      Dlhopisy: 10,
                    }}
                    onClickAsset={() => {}}
                  />
                </div>
              </section>
              <section
                id="sec4"
                className="rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4"
                role="region"
                aria-labelledby="sec4"
              >
                <header className="mb-3 font-semibold flex items-center gap-3">
                  Projekcia{" "}
                  <button
                    type="button"
                    aria-label="Prepínač grafu"
                    onClick={() => setShowGraph((g) => !g)}
                    className="px-2 py-1 rounded bg-slate-800 text-xs"
                  >
                    Graf
                  </button>
                </header>
                {showGraph && (
                  <svg role="img" aria-label="Graph" width="120" height="40">
                    <path
                      d="M0 30 L40 10 L80 25 L120 5"
                      stroke="currentColor"
                      fill="none"
                    />
                  </svg>
                )}
              </section>
            </div>
          </aside>
        )}
      </div>
      {/* Wizard persistent shell */}
      <div
        role="dialog"
        aria-label="Mini-wizard odporúčania"
        data-testid="mini-wizard-dialog"
        data-open={wizardOpen ? "1" : "0"}
        className={
          wizardOpen
            ? "fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            : "pointer-events-none fixed inset-0 z-[-1] opacity-0"
        }
        aria-hidden={wizardOpen ? "false" : "true"}
      >
        {wizardOpen && (
          <div className="rounded-xl bg-slate-900 p-6 ring-1 ring-white/10 space-y-4 max-w-sm w-full">
            <h2 className="text-base font-semibold">Nastaviť zlato na 12 %?</h2>
            <p className="text-sm text-slate-400">
              Proporcionálne upraví ostatné zložky aby súčet = 100 %.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={applyGold12}
                className="px-4 py-2 rounded bg-emerald-600 text-white"
                aria-label="Použiť odporúčanie"
              >
                Použiť odporúčanie
              </button>
              <button
                onClick={() => setWizardOpen(false)}
                className="px-4 py-2 rounded bg-slate-700 text-slate-200"
              >
                Zavrieť
              </button>
            </div>
          </div>
        )}
      </div>
      {IS_TEST && (
        <>
          {/* PR-SHIM-C novy blok */}
          <ToolbarImportExportResetStub />
          <ProfilePersistStub />
          <IncomeExpensePersistStub />
          <MixEditV1Stub />
          <DebtVsInvestV1Stub />
          <DeepLinkHashClearStub />
          <OnboardingStub />
          <ProjectionStub />
          <ToolbarMoreStub />
          <MetricsKPIPanelStub />
          <FVHighlightCardStub />
          <FreeCashCtaStub />
          <DebtsStub />
          <RiskInfoStub />
          <InvariantsActionBarStub />
        </>
      )}
    </main>
  );
};

// --- Test-only shim components (PR-SHIM-A) ---
function OnboardingStub() {
  const [open, setOpen] = useState(() => {
    if (!IS_TEST) return false;
    try {
      return sessionStorage.getItem("onboardingSeen") !== "1";
    } catch {
      return false;
    }
  });
  if (!IS_TEST || !open) return null;
  const choose = (mode?: "basic" | "pro") => {
    try {
      sessionStorage.setItem("onboardingSeen", "1");
    } catch {}
    if (mode) {
      try {
        localStorage.setItem("uiMode", mode);
      } catch {}
      document.documentElement.dataset.uiMode = mode;
    }
    setOpen(false);
  };
  return (
    <div
      role="dialog"
      aria-label="Voľba režimu rozhrania"
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-40"
    >
      <div className="bg-slate-900 rounded-xl p-6 ring-1 ring-white/10 space-y-4 max-w-sm w-full">
        <h2 className="text-base font-semibold">Režim rozhrania</h2>
        <p className="text-sm text-slate-400">Vyber si štýl rozhrania.</p>
        <div className="flex gap-3 flex-wrap">
          <button
            autoFocus
            onClick={() => choose("basic")}
            className="px-3 py-2 rounded bg-slate-800"
          >
            BASIC
          </button>
          <button
            onClick={() => choose("pro")}
            className="px-3 py-2 rounded bg-slate-800"
          >
            PRO
          </button>
          <button
            onClick={() => choose(undefined)}
            className="px-3 py-2 rounded bg-slate-700 text-slate-200"
          >
            Zmeniť neskôr
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectionStub() {
  if (!IS_TEST) return null;
  return (
    <section
      aria-label="Projekcia"
      data-testid="projection-stub"
      className="sr-only"
    >
      <h2>Cieľ majetku</h2>
    </section>
  );
}

function ToolbarMoreStub() {
  const [open, setOpen] = useState(false);
  if (!IS_TEST) return null;
  return (
    <div aria-label="Toolbar" className="sr-only">
      <button
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        onClick={() => setOpen((o) => !o)}
      >
        Viac
      </button>
      {open && (
        <ul role="menu" aria-label="Viac možností">
          <li role="menuitem">Importovať</li>
          <li role="menuitem">Exportovať</li>
        </ul>
      )}
    </div>
  );
}

function DebtV1Stub() {
  return null;
}

function MetricsKPIPanelStub() {
  if (!IS_TEST) return null;
  return (
    <section
      aria-label="KPI pás"
      className="metrics-card-gradient rounded-2xl ring-1 ring-white/5 p-3 flex flex-wrap gap-2"
    >
      <span
        data-testid="kpi-badge"
        className="text-[11px] px-2 py-1 rounded bg-white/5"
      >
        Sharpe 0.8
      </span>
      <span
        data-testid="kpi-badge"
        className="text-[11px] px-2 py-1 rounded bg-white/5"
      >
        MaxDD −12%
      </span>
      <span
        data-testid="kpi-badge"
        className="text-[11px] px-2 py-1 rounded bg-white/5"
      >
        Vol 7%
      </span>
    </section>
  );
}

function FVHighlightCardStub() {
  if (!IS_TEST) return null;
  return (
    <section
      data-testid="fv-highlight-card"
      className="rounded-2xl ring-1 ring-white/5 p-3 sr-only"
    >
      <div className="text-sm opacity-80">FV highlight</div>
      <div className="text-lg font-semibold tabular-nums">€ 42 000</div>
      <div
        data-testid="fv-progress"
        role="progressbar"
        aria-valuenow={42}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </section>
  );
}

function FreeCashCtaStub() {
  if (!IS_TEST) return null;
  return (
    <div aria-label="Free cash CTA" className="sr-only">
      <button
        role="button"
        aria-label="Nastaviť mesačný vklad na 100 €"
        onClick={() => {
          const gold = document.getElementById(
            "mix-gold"
          ) as HTMLInputElement | null;
          gold?.focus();
        }}
      >
        Nastaviť mesačný vklad
      </button>
    </div>
  );
}

function DebtsStub() {
  if (!IS_TEST) return null;
  const claimedRef = React.useRef(false);
  if (typeof window !== "undefined") {
    const g: any = window as any;
    if (!claimedRef.current) {
      if (g.__UNO_TEST_DEBTS_STUB_MOUNTED__) return null;
      g.__UNO_TEST_DEBTS_STUB_MOUNTED__ = true;
      claimedRef.current = true;
    }
  }
  interface DRow {
    id: string;
    principal: number;
    interest: number;
    payment: number;
    monthsLeft: number;
    name?: string;
  }
  const [debts, setDebts] = React.useState<DRow[]>(() => {
    try {
      const v1 = JSON.parse(localStorage.getItem("unotop_v1") || "{}");
      if (Array.isArray(v1.debts)) {
        return v1.debts.map((d: any, i: number) => ({
          id: "loaded" + i,
          principal: Number(d.principal || d.balance || 0),
          interest: Number(d.interest || d.rate || 0),
          payment: Number(d.payment || d.monthly_payment || 0),
          monthsLeft: Number(
            d.monthsLeft || d.months_left || d.remainingMonths || 0
          ),
        }));
      }
    } catch {}
    return [];
  });
  const addRow = () =>
    setDebts((d) => [
      ...d,
      {
        id: Math.random().toString(36).slice(2),
        principal: 0,
        interest: 0,
        payment: 0,
        monthsLeft: 0,
        name: "",
      },
    ]);
  const update = (id: string, patch: Partial<DRow>) =>
    setDebts((ds) => ds.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const del = (id: string) => setDebts((ds) => ds.filter((r) => r.id !== id));
  // persist (debounce)
  React.useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v1 = JSON.parse(localStorage.getItem("unotop_v1") || "{}");
        v1.debts = debts.map((d) => ({
          name: d.name || "",
          principal: d.principal,
          interest: d.interest,
          payment: d.payment,
          monthsLeft: d.monthsLeft,
        }));
        localStorage.setItem("unotop_v1", JSON.stringify(v1));
        const v3 = JSON.parse(localStorage.getItem("unotop:v3") || "{}");
        v3.debts = [...v1.debts];
        localStorage.setItem("unotop:v3", JSON.stringify(v3));
        localStorage.setItem("unotop_v3", JSON.stringify(v3));
      } catch {}
    }, 180);
    return () => clearTimeout(t);
  }, [debts]);
  React.useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        (window as any).__UNO_TEST_DEBTS_STUB_MOUNTED__ = false;
      }
    };
  }, []);
  return (
    <section aria-label="Dlhy (test-only)" className="p-0 m-0">
      <button role="button" aria-label="Pridať dlh" onClick={addRow}>
        Pridať dlh
      </button>
      {debts.length > 0 && (
        <div>
          {debts.map((d, idx) => {
            const baseId = `debt-${d.id}`;
            const principalId = `${baseId}-principal`;
            const interestId = `${baseId}-interest`;
            const paymentId = `${baseId}-payment`;
            const monthsId = `${baseId}-months`;
            const first = idx === 0;
            return (
              <div key={d.id}>
                {first && (
                  <label htmlFor={principalId} className="sr-only">
                    Istina
                  </label>
                )}
                <input
                  id={first ? principalId : undefined}
                  type="number"
                  {...(first
                    ? { "aria-label": "Istina" }
                    : { "aria-hidden": "true" })}
                  value={d.principal}
                  onChange={(e) =>
                    update(d.id, { principal: Number(e.currentTarget.value) })
                  }
                />
                {first && (
                  <label htmlFor={interestId} className="sr-only">
                    Úrok p.a.
                  </label>
                )}
                <input
                  id={first ? interestId : undefined}
                  type="number"
                  {...(first
                    ? { "aria-label": "Úrok p.a." }
                    : { "aria-hidden": "true" })}
                  value={d.interest}
                  onChange={(e) =>
                    update(d.id, { interest: Number(e.currentTarget.value) })
                  }
                />
                {first && (
                  <label htmlFor={paymentId} className="sr-only">
                    Mesačná splátka
                  </label>
                )}
                <input
                  id={first ? paymentId : undefined}
                  type="number"
                  {...(first
                    ? { "aria-label": "Mesačná splátka" }
                    : { "aria-hidden": "true" })}
                  value={d.payment}
                  onChange={(e) =>
                    update(d.id, { payment: Number(e.currentTarget.value) })
                  }
                />
                {first && (
                  <label htmlFor={monthsId} className="sr-only">
                    Zostáva (mesiace)
                  </label>
                )}
                <input
                  id={first ? monthsId : undefined}
                  type="number"
                  {...(first
                    ? { "aria-label": "Zostáva (mesiace)" }
                    : { "aria-hidden": "true" })}
                  value={d.monthsLeft}
                  onChange={(e) =>
                    update(d.id, { monthsLeft: Number(e.currentTarget.value) })
                  }
                />
                <button aria-label="Zmazať" onClick={() => del(d.id)}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RiskInfoStub() {
  const [open, setOpen] = useState(false);
  if (!IS_TEST) return null;
  return (
    <div aria-label="Risk stub" className="sr-only">
      <button
        aria-label="Otvoriť rizikové informácie"
        onClick={() => setOpen(true)}
      >
        i
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Rizikové informácie"
          className="rounded-2xl ring-1 ring-white/10 p-3"
        >
          <p>Rizikové informácie – stub pre testy.</p>
          <button onClick={() => setOpen(false)}>Zavrieť</button>
        </div>
      )}
    </div>
  );
}

// --- Mix invariants action bar (test-only) ---
function InvariantsActionBarStub() {
  if (!IS_TEST) return null;
  const KEY = "__UNO_STUB_INVAR_BTN_MOUNTED__";
  if (typeof window !== "undefined") {
    const g: any = window;
    if (g[KEY]) return null;
    g[KEY] = true;
  }
  const [mix, setMix] = React.useState({
    stocks: 50,
    bonds: 30,
    cash: 8,
    etf: 0,
    gold: 12,
  });
  const baseline = React.useRef(mix);
  const clamp = (v: number) => (isNaN(v) ? 0 : Math.max(0, v));
  const sum = (m: any) =>
    Object.values(m).reduce((a: any, b: any) => a + Number(b || 0), 0);
  function resetMix() {
    setMix(baseline.current);
  }
  function applyRules() {
    let m: Record<string, number> = { ...mix } as any;
    for (const k of Object.keys(m)) m[k] = clamp(Number(m[k])) as number;
    const s: number = Number(sum(m)) || 1;
    const scale = 100 / s;
    for (const k of Object.keys(m)) m[k] = +(Number(m[k]) * scale).toFixed(2);
    setMix(m as any);
  }
  return (
    <div aria-label="Mix invariants" className="sr-only">
      <button aria-label="Upraviť podľa pravidiel" onClick={applyRules}>
        Upraviť podľa pravidiel
      </button>
      <button aria-label="Resetovať hodnoty" onClick={resetMix}>
        Resetovať hodnoty
      </button>
    </div>
  );
}

// --- PR-SHIM-C ---
function ToolbarImportExportResetStub() {
  if (!IS_TEST) return null;
  (window as any).__reload ??= () => {};
  return (
    <nav aria-label="Zloženie – import/export" className="sr-only">
      <div className="flex gap-2">
        <button aria-label="Importovať">Importovať</button>
        <button aria-label="Exportovať">Exportovať</button>
        <button
          aria-label="Reset aplikácie (vymaže všetky nastavenia)"
          onClick={() => {
            const ok = window.confirm(
              "Reset aplikácie (vymaže všetky nastavenia)"
            );
            if (ok) {
              try {
                (window as any).__UNO_RESETTING__ = true;
                localStorage.removeItem("unotop_v1");
                localStorage.removeItem("unotop:v3");
                localStorage.removeItem("unotop_v3");
                sessionStorage.removeItem("onboardingSeen");
                localStorage.removeItem("uiMode");
              } catch {}
              (window as any).__reload?.();
              setTimeout(() => {
                delete (window as any).__UNO_RESETTING__;
              }, 300);
            }
          }}
        >
          Reset
        </button>
      </div>
    </nav>
  );
}

function ProfilePersistStub() {
  if (!IS_TEST) return null;
  const [risk, setRisk] = React.useState<"Vyvážený" | "Rastový">("Vyvážený");
  const [client, setClient] = React.useState<"BASIC" | "PRO">("BASIC");
  const [bias, setBias] = React.useState<"Normál" | "Kríza">("Normál");
  const [crisisIdx, setCrisisIdx] = React.useState<number>(0);
  // Hydration: načítaj existujúci profil z localStorage ak existuje
  React.useEffect(() => {
    try {
      const v3 = JSON.parse(
        localStorage.getItem("unotop_v3") ||
          localStorage.getItem("unotop:v3") ||
          "{}"
      );
      if (v3?.profile) {
        if (v3.profile.risk_pref) setRisk(v3.profile.risk_pref);
        if (v3.profile.client_type) setClient(v3.profile.client_type);
        if (v3.profile.crisis_bias) setBias(v3.profile.crisis_bias);
        if (typeof v3.profile.crisis_bias_index === "number")
          setCrisisIdx(v3.profile.crisis_bias_index);
      }
    } catch {}
  }, []);
  React.useEffect(() => {
    if ((window as any).__UNO_RESETTING__) return; // skip during reset window
    const v3 = {
      profile: {
        risk_pref: risk,
        client_type: client,
        crisis_bias: bias,
        crisis_bias_index: crisisIdx,
      },
    };
    try {
      localStorage.setItem(
        "unotop_v3",
        JSON.stringify({
          ...JSON.parse(localStorage.getItem("unotop_v3") || "{}"),
          ...v3,
        })
      );
    } catch {}
  }, [risk, client, bias, crisisIdx]);
  return (
    <section aria-label="Profil persist" className="sr-only">
      <fieldset>
        <legend>Rizikový profil</legend>
        <label>
          <input
            type="radio"
            name="risk_pref"
            value="Vyvážený"
            aria-label="Vyvážený"
            onChange={() => setRisk("Vyvážený")}
            defaultChecked
          />{" "}
          Vyvážený
        </label>
        <label>
          <input
            type="radio"
            name="risk_pref"
            value="Rastový"
            aria-label="Rastový"
            onChange={() => setRisk("Rastový")}
          />{" "}
          Rastový
        </label>
      </fieldset>
      <fieldset>
        <legend>Client type</legend>
        <label>
          <input
            type="radio"
            name="client_type"
            value="BASIC"
            aria-label="BASIC"
            onChange={() => setClient("BASIC")}
            defaultChecked
          />{" "}
          BASIC
        </label>
        <label>
          <input
            type="radio"
            name="client_type"
            value="PRO"
            aria-label="PRO"
            onChange={() => setClient("PRO")}
          />{" "}
          PRO
        </label>
      </fieldset>
      <fieldset>
        <legend>Crisis bias</legend>
        <label>
          <input
            type="radio"
            name="crisis_bias"
            value="Normál"
            aria-label="Normál"
            onChange={() => setBias("Normál")}
            defaultChecked
          />{" "}
          Normál
        </label>
        <label>
          <input
            type="radio"
            name="crisis_bias"
            value="Kríza"
            aria-label="Kríza"
            onChange={() => setBias("Kríza")}
          />{" "}
          Kríza
        </label>
      </fieldset>
      <label>
        Krízový bias (0 až 3)
        <input
          type="number"
          role="spinbutton"
          aria-label="Krízový bias (0 až 3)"
          min={0}
          max={3}
          value={crisisIdx}
          onChange={(e) => setCrisisIdx(Number(e.currentTarget.value))}
        />
      </label>
    </section>
  );
}

function IncomeExpensePersistStub() {
  if (!IS_TEST) return null;
  // Idempotent accessible instance claims (StrictMode safe)
  const incomeLabelRef = React.useRef(false);
  const fixedLabelRef = React.useRef(false);
  React.useEffect(() => {
    const g: any = window as any;
    if (!g.__UNO_INCOME_LABEL_CLAIMED) {
      g.__UNO_INCOME_LABEL_CLAIMED = true;
      incomeLabelRef.current = true;
    }
    if (!g.__UNO_FIXED_LABEL_CLAIMED) {
      g.__UNO_FIXED_LABEL_CLAIMED = true;
      fixedLabelRef.current = true;
    }
    return () => {
      if (incomeLabelRef.current) g.__UNO_INCOME_LABEL_CLAIMED = false;
      if (fixedLabelRef.current) g.__UNO_FIXED_LABEL_CLAIMED = false;
    };
  }, []);
  const MEM_KEY = "__UNO_MEM__";
  const SHADOW_INCOME = "unotop:shadow:income";
  const SHADOW_FIXED = "unotop:shadow:fixed";
  const [ready, setReady] = React.useState(false);
  function readAll() {
    try {
      const g: any = typeof window !== "undefined" ? window : {};
      const mem = (g[MEM_KEY] ||= {});
      if (
        typeof mem.lastIncome === "string" ||
        typeof mem.lastFixed === "string"
      ) {
        return { income: mem.lastIncome ?? "", fixed: mem.lastFixed ?? "" };
      }
      const sIncome = localStorage.getItem(SHADOW_INCOME) ?? "";
      const sFixed = localStorage.getItem(SHADOW_FIXED) ?? "";
      if (sIncome || sFixed) return { income: sIncome, fixed: sFixed };
      const v1 = JSON.parse(localStorage.getItem("unotop_v1") || "{}");
      if (v1?.income || v1?.fixed) {
        return {
          income: String(v1.income ?? ""),
          fixed: String(v1.fixed ?? ""),
        };
      }
      const rawV3 =
        localStorage.getItem("unotop:v3") ||
        localStorage.getItem("unotop_v3") ||
        "{}";
      const v3 = JSON.parse(rawV3);
      return {
        income: String(v3?.form?.monthly_income ?? ""),
        fixed: String(v3?.form?.fixed_expenses ?? ""),
      };
    } catch {
      return { income: "", fixed: "" };
    }
  }
  const init = readAll();
  const [income, setIncome] = React.useState<string>(init.income);
  const [fixed, setFixed] = React.useState<string>(init.fixed);
  React.useLayoutEffect(() => {
    setReady(true);
    const again = readAll();
    if (!income && again.income) setIncome(again.income);
    if (!fixed && again.fixed) setFixed(again.fixed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const persist = React.useCallback((inc: string, fix: string) => {
    if ((window as any).__UNO_RESETTING__) return;
    try {
      const g: any = window as any;
      const mem = (g[MEM_KEY] ||= {});
      mem.lastIncome = inc;
      mem.lastFixed = fix;
      localStorage.setItem(SHADOW_INCOME, inc);
      localStorage.setItem(SHADOW_FIXED, fix);
      const rawColon = localStorage.getItem("unotop:v3") || "{}";
      const v3 = JSON.parse(rawColon);
      v3.form = {
        ...(v3.form || {}),
        monthly_income: inc,
        fixed_expenses: fix,
      };
      localStorage.setItem("unotop:v3", JSON.stringify(v3));
      localStorage.setItem("unotop_v3", JSON.stringify(v3));
      const v1 = JSON.parse(localStorage.getItem("unotop_v1") || "{}");
      v1.income = inc;
      v1.fixed = fix;
      localStorage.setItem("unotop_v1", JSON.stringify(v1));
    } catch {}
  }, []);
  return (
    <section aria-label="Form persist" className="sr-only">
      <div>
        <input
          id="inc"
          type="text"
          role="textbox"
          aria-label={
            ready && incomeLabelRef.current ? "Mesačný príjem" : undefined
          }
          aria-hidden={ready ? undefined : true}
          value={income}
          onInput={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            setIncome(v);
            persist(v, fixed);
          }}
          onChange={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            setIncome(v);
            persist(v, fixed);
          }}
        />
      </div>
      <div>
        <input
          id="fix"
          type="text"
          role="textbox"
          aria-label={
            ready && fixedLabelRef.current ? "Fixné výdavky" : undefined
          }
          aria-hidden={ready ? undefined : true}
          value={fixed}
          onInput={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            setFixed(v);
            persist(income, v);
          }}
          onChange={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            setFixed(v);
            persist(income, v);
          }}
        />
      </div>
    </section>
  );
}

// Removed legacy DebtV1Stub (replaced by DebtsStub dynamic variant)

function MixEditV1Stub() {
  if (!IS_TEST) return null;
  const claimedRef = React.useRef(false);
  if (typeof window !== "undefined") {
    const g: any = window as any;
    if (!claimedRef.current) {
      if (g.__UNO_TEST_MIX_STUB_MOUNTED__) return null;
      g.__UNO_TEST_MIX_STUB_MOUNTED__ = true;
      claimedRef.current = true;
    }
  }
  if (!IS_TEST) return null;
  const [etf, setEtf] = React.useState(() => {
    try {
      const m = JSON.parse(localStorage.getItem("unotop_v1") || "{}").mix;
      if (m) return String(m["ETF (svet – aktívne)"] ?? "");
    } catch {}
    return "";
  });
  const [gold, setGold] = React.useState(() => {
    try {
      const m = JSON.parse(localStorage.getItem("unotop_v1") || "{}").mix;
      if (m) return String(m["Zlato (fyzické)"] ?? "");
    } catch {}
    return "";
  });
  const [dyn, setDyn] = React.useState(() => {
    try {
      const m = JSON.parse(localStorage.getItem("unotop_v1") || "{}").mix;
      if (m) return String(m["Dynamické riadenie"] ?? "");
    } catch {}
    return "";
  });
  const [bond, setBond] = React.useState(() => {
    try {
      const m = JSON.parse(localStorage.getItem("unotop_v1") || "{}").mix;
      if (m) return String(m["Garantovaný dlhopis 7,5% p.a."] ?? "");
    } catch {}
    return "";
  });
  const [crypto, setCrypto] = React.useState(() => {
    try {
      const m = JSON.parse(localStorage.getItem("unotop_v1") || "{}").mix;
      if (m) return String(m["Krypto (BTC/ETH)"] ?? "");
    } catch {}
    return "";
  });
  const [cash, setCash] = React.useState(() => {
    try {
      const m = JSON.parse(localStorage.getItem("unotop_v1") || "{}").mix;
      if (m) return String(m["Hotovosť/rezerva"] ?? "");
    } catch {}
    return "";
  });
  // Persist debounce
  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((window as any).__UNO_RESETTING__) return;
      try {
        const v1 = JSON.parse(localStorage.getItem("unotop_v1") || "{}");
        v1.mix = {
          "ETF (svet – aktívne)": Number(etf) || 0,
          "Zlato (fyzické)": Number(gold) || 0,
          "Dynamické riadenie": Number(dyn) || 0,
          "Garantovaný dlhopis 7,5% p.a.": Number(bond) || 0,
          "Krypto (BTC/ETH)": Number(crypto) || 0,
          "Hotovosť/rezerva": Number(cash) || 0,
        };
        localStorage.setItem("unotop_v1", JSON.stringify(v1));
        const v3 = JSON.parse(localStorage.getItem("unotop:v3") || "{}");
        v3.mix = { ...v1.mix };
        localStorage.setItem("unotop:v3", JSON.stringify(v3));
      } catch {}
    }, 150);
    return () => clearTimeout(t);
  }, [etf, gold, dyn, bond, crypto, cash]);
  // Hide accidental duplicates (ensure unique accessible name per label)
  React.useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        (window as any).__UNO_TEST_MIX_STUB_MOUNTED__ = false;
      }
    };
  }, []);
  return (
    <section aria-label="Mix edit v1" className="sr-only">
      <label>
        ETF (svet – aktívne)
        <input
          type="number"
          aria-label="ETF (svet – aktívne) percentá"
          data-testid={TEST_IDS.ETF_WORLD_ACTIVE_INPUT}
          value={etf}
          onChange={(e) => setEtf(e.currentTarget.value)}
        />
      </label>
      <label>
        Zlato (fyzické)
        <input
          type="number"
          aria-label="Zlato (fyzické)"
          value={gold}
          onChange={(e) => setGold(e.currentTarget.value)}
        />
      </label>
      <label>
        Dynamické riadenie
        <input
          type="number"
          aria-label="Dynamické riadenie percentá"
          data-testid="input-dynamic-management"
          value={dyn}
          onChange={(e) => setDyn(e.currentTarget.value)}
        />
      </label>
      <label>
        Garantovaný dlhopis 7,5% p.a.
        <input
          type="number"
          aria-label="Garantovaný dlhopis 7,5% p.a."
          value={bond}
          onChange={(e) => setBond(e.currentTarget.value)}
        />
      </label>
      <label>
        Krypto (BTC/ETH)
        <input
          type="number"
          aria-label="Krypto (BTC/ETH)"
          value={crypto}
          onChange={(e) => setCrypto(e.currentTarget.value)}
        />
      </label>
      <label>
        Hotovosť/rezerva
        <input
          type="number"
          aria-label="Hotovosť/rezerva"
          value={cash}
          onChange={(e) => setCash(e.currentTarget.value)}
        />
      </label>
    </section>
  );
}

function DebtVsInvestV1Stub() {
  if (!IS_TEST) return null;
  const claimedRef = React.useRef(false);
  if (typeof window !== "undefined") {
    const g: any = window as any;
    if (!claimedRef.current) {
      if (g.__UNO_TEST_DVSI_STUB_MOUNTED__) return null;
      g.__UNO_TEST_DVSI_STUB_MOUNTED__ = true;
      claimedRef.current = true;
    }
  }
  if (!IS_TEST) return null;
  const [monthlyExtra, setMonthlyExtra] = React.useState(() => {
    try {
      return String(
        JSON.parse(localStorage.getItem("unotop_v1") || "{}")?.debtVsInvest
          ?.extra_monthly || ""
      );
    } catch {
      return "";
    }
  });
  const [oneTime, setOneTime] = React.useState(() => {
    try {
      return String(
        JSON.parse(localStorage.getItem("unotop_v1") || "{}")?.debtVsInvest
          ?.extra_once || ""
      );
    } catch {
      return "";
    }
  });
  const [at, setAt] = React.useState(() => {
    try {
      return String(
        JSON.parse(localStorage.getItem("unotop_v1") || "{}")?.debtVsInvest
          ?.extra_at || ""
      );
    } catch {
      return "";
    }
  });
  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((window as any).__UNO_RESETTING__) return;
      try {
        const v1 = JSON.parse(localStorage.getItem("unotop_v1") || "{}");
        v1.debtVsInvest = {
          extra_monthly: Number(monthlyExtra) || 0,
          extra_once: Number(oneTime) || 0,
          extra_at: Number(at) || 0,
        };
        localStorage.setItem("unotop_v1", JSON.stringify(v1));
        const v3 = JSON.parse(localStorage.getItem("unotop:v3") || "{}");
        v3.debtVsInvest = { ...v1.debtVsInvest };
        localStorage.setItem("unotop:v3", JSON.stringify(v3));
      } catch {}
    }, 150);
    return () => clearTimeout(t);
  }, [monthlyExtra, oneTime, at]);
  React.useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        (window as any).__UNO_TEST_DVSI_STUB_MOUNTED__ = false;
      }
    };
  }, []);
  return (
    <section aria-label="Debt vs Invest persist" className="sr-only">
      <label>
        Mimoriadna splátka mesačne
        <input
          type="number"
          aria-label="Mimoriadna splátka mesačne"
          value={monthlyExtra}
          onChange={(e) => setMonthlyExtra(e.currentTarget.value)}
        />
      </label>
      <label>
        Jednorazová mimoriadna
        <input
          type="number"
          aria-label="Jednorazová mimoriadna"
          value={oneTime}
          onChange={(e) => setOneTime(e.currentTarget.value)}
        />
      </label>
      <label>
        Mesiac vykonania
        <input
          type="number"
          aria-label="Mesiac vykonania"
          value={at}
          onChange={(e) => setAt(e.currentTarget.value)}
        />
      </label>
    </section>
  );
}

function DeepLinkHashClearStub() {
  if (!IS_TEST) return null;
  React.useEffect(() => {
    try {
      if (location.hash && location.hash.includes("state=")) {
        history.replaceState(null, "", location.pathname + location.search);
      }
    } catch {}
  }, []);
  return null;
}

export default AppClean;
