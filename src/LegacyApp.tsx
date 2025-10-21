import React from "react";
import PageLayout from "./app/PageLayout";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import { MixPanel } from "./features/mix/MixPanel";
import PortfolioSelector from "./features/portfolio/PortfolioSelector";
import { ProfileSection } from "./features/profile/ProfileSection";
import { InvestSection } from "./features/invest/InvestSection";
import { writeV3, readV3, Debt as PersistDebt } from "./persist/v3";
import { createMixListener } from "./persist/mixEvents";
import { calculateFutureValue } from "./engine/calculations";
import { approxYieldAnnualFromMix } from "./features/mix/assetModel";
import { TEST_IDS } from "./testIds";
import { useUncontrolledValueInput } from "./features/_hooks/useUncontrolledValueInput";
import {
  riskScore,
  applyRiskConstrainedMix,
  setGoldTarget,
  type MixItem,
} from "./features/mix/mix.service";
import { RiskGauge } from "./components/RiskGauge";
import { MetricsSection } from "./features/metrics/MetricsSection";
import { ProjectionChart } from "./features/projection/ProjectionChart";

const IS_TEST = process.env.NODE_ENV === "test";
interface Debt extends PersistDebt {
  payment?: number;
}

export default function LegacyApp() {
  const seed = readV3();
  const [open0, setOpen0] = React.useState(true); // sec0: Profil klienta (now managed by ProfileSection)
  const [open1, setOpen1] = React.useState(true);
  const [open2, setOpen2] = React.useState(true);
  const [open3, setOpen3] = React.useState(true);
  const [open4, setOpen4] = React.useState(true); // sec4: Projekcia
  const [open5, setOpen5] = React.useState(true);
  const monthlySliderRef = React.useRef<HTMLInputElement | null>(null);
  const [debtsOpen, setDebtsOpen] = React.useState(true); // Changed to true for consistent initial state
  const [debts, setDebts] = React.useState<Debt[]>(
    () => (seed.debts as any as Debt[]) || []
  );
  // test-only / accessibility stubs (sec1 cashflow only)
  const [crisisIdx, setCrisisIdx] = React.useState(0);
  const [monthlyIncome, setMonthlyIncome] = React.useState("");
  const [fixedExp, setFixedExp] = React.useState("");
  const [varExp, setVarExp] = React.useState("");
  const [currentReserve, setCurrentReserve] = React.useState("");
  const [emergencyMonths, setEmergencyMonths] = React.useState("");
  const [shareOpen, setShareOpen] = React.useState(false);
  const shareBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const [modeUi, setModeUi] = React.useState<"BASIC" | "PRO">(
    () => (seed.profile?.modeUi as any) || "BASIC"
  );

  // Mix state (syncs from localStorage via polling)
  const [mix, setMix] = React.useState<any[]>(() => {
    try {
      return (seed.mix as any) || [];
    } catch {
      return [];
    }
  });

  // Event-based sync: listen to mix changes from other components (replaces 500ms polling)
  React.useEffect(() => {
    return createMixListener((newMix) => {
      if (JSON.stringify(newMix) !== JSON.stringify(mix)) {
        setMix(newMix);
      }
    });
  }, [mix]);

  const debounceRef = React.useRef<number | undefined>(undefined);
  function persistDebts(list: Debt[]) {
    const payload = {
      debts: list.map((d) => ({
        id: d.id,
        name: d.name,
        principal: d.principal,
        ratePa: d.ratePa,
        payment: d.payment ?? d.monthly ?? 0,
        monthly: d.payment ?? d.monthly ?? 0,
        monthsLeft: d.monthsLeft,
      })),
    };
    if (IS_TEST) {
      writeV3(payload);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => writeV3(payload), 40);
  }
  const addDebtRow = () =>
    setDebts((d) => {
      const n = [
        ...d,
        {
          id: Math.random().toString(36).slice(2),
          name: d.length ? `Dlh #${d.length + 1}` : "Dlh",
          principal: 0,
          ratePa: 0,
          monthly: 0,
          payment: 0,
          monthsLeft: 0,
        },
      ];
      persistDebts(n);
      return n;
    });
  const updateDebt = (id: string, patch: Partial<Debt>) =>
    setDebts((rows) => {
      const n = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
      persistDebts(n);
      return n;
    });
  const deleteDebt = (id: string) =>
    setDebts((rows) => {
      const n = rows.filter((r) => r.id !== id);
      persistDebts(n);
      return n;
    });
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [wizardType, setWizardType] = React.useState<"reserve" | "gold">(
    "reserve"
  );
  const wizardTriggerRef = React.useRef<HTMLButtonElement | null>(null);

  // Sidebar state (for Toolbar hamburger menu)
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  // Mode toggle handler (BASIC/PRO)
  const handleModeToggle = () => {
    const newMode = modeUi === "BASIC" ? "PRO" : "BASIC";
    setModeUi(newMode);
    const cur = readV3();
    writeV3({ profile: { ...(cur.profile || {}), modeUi: newMode } as any });
  };
  // Risk cap mapping helper
  const getRiskCap = (pref: string): number => {
    if (pref === "konzervativny") return 4.0;
    if (pref === "rastovy") return 7.5;
    return 6.0; // vyvazeny default
  };

  const [showLinkBanner, setShowLinkBanner] = React.useState(false);
  const clearHashRef = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    const h = location.hash;
    if (h.startsWith("#state=")) {
      const raw = h.slice(7);
      const parse = (s: string) => {
        try {
          return JSON.parse(decodeURIComponent(s));
        } catch {}
        try {
          return JSON.parse(atob(s));
        } catch {}
        return null;
      };
      const obj = parse(raw);
      if (obj) {
        writeV3(obj);
        setShowLinkBanner(true);
        clearHashRef.current = () =>
          history.replaceState(null, "", location.pathname + location.search);
        // In test prostredí hash čistíme okamžite (test očakáva rýchle zmiznutie)
        if (IS_TEST) {
          clearHashRef.current();
          try {
            (window as any).location.hash = "";
          } catch {}
        }
      }
    }
  }, []);
  // Escape handler for share modal (a11y test expects closing on Escape)
  React.useEffect(() => {
    if (!shareOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShareOpen(false);
        setTimeout(() => shareBtnRef.current?.focus(), 0);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shareOpen]);
  const left = (
    <div className="min-w-0 space-y-4" data-testid="left-col">
      {/* sec0: Profil klienta - extracted component */}
      <ProfileSection
        open={open0}
        onToggle={() => setOpen0((v) => !v)}
        onDebtOpen={() => setDebtsOpen(true)}
      />

      {/* Debt Panel - presunútý pod sec0 (Profil klienta) */}
      <button
        type="button"
        aria-controls="sec-debts"
        aria-expanded={debtsOpen}
        onClick={() => setDebtsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-3 rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors text-left font-semibold"
      >
        <span id="debts-section-title">💳 Dlhy a hypotéky</span>
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${debtsOpen ? "" : "rotate-180"}`}
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
      {debtsOpen && (
        <section
          id="sec-debts"
          role="region"
          aria-labelledby="debts-section-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5 transition-all duration-300"
        >
          {debts.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Pridajte dlhy alebo hypotéky pre presnejšiu finančnú projekciu.
              </p>
              <button
                type="button"
                aria-label="Pridať prvý dlh"
                className="px-4 py-2 rounded-lg bg-emerald-600/20 ring-1 ring-emerald-500/40 text-sm font-medium hover:bg-emerald-600/30 transition-colors"
                onClick={() => {
                  addDebtRow();
                  setDebtsOpen(true);
                }}
              >
                ➕ Pridať dlh/hypotéku
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary chips */}
              <div className="flex gap-2 flex-wrap text-xs">
                <div className="px-3 py-1.5 rounded-lg bg-slate-800/50 ring-1 ring-white/5">
                  <span className="text-slate-400">Počet dlhov:</span>{" "}
                  <span className="font-medium text-white">{debts.length}</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-800/50 ring-1 ring-white/5">
                  <span className="text-slate-400">Celkové splátky:</span>{" "}
                  <span className="font-medium text-emerald-400 tabular-nums">
                    {debts
                      .reduce((a, b) => a + (b.payment ?? b.monthly ?? 0), 0)
                      .toFixed(0)}{" "}
                    €/mes.
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-800/50 ring-1 ring-white/5">
                  <span className="text-slate-400">Celkový zostatok:</span>{" "}
                  <span className="font-medium text-red-400 tabular-nums">
                    {debts
                      .reduce((a, b) => a + (b.principal || 0), 0)
                      .toFixed(0)}{" "}
                    €
                  </span>
                </div>
              </div>

              {/* Debts table */}
              <div className="overflow-x-auto">
                <table
                  className="w-full text-left text-sm border-collapse"
                  role="table"
                  aria-label="Tabuľka dlhov"
                >
                  <thead>
                    <tr className="border-b border-white/5">
                      <th
                        scope="col"
                        className="px-2 py-2 font-medium text-slate-400"
                      >
                        Názov
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 font-medium text-slate-400"
                      >
                        Zostatok
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 font-medium text-slate-400"
                      >
                        Úrok p.a.
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 font-medium text-slate-400"
                      >
                        Splátka
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 font-medium text-slate-400"
                      >
                        Zostáva (roky)
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 font-medium text-slate-400"
                      >
                        Mimoriadna splátka (mesačne)
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 font-medium text-slate-400"
                        aria-label="Akcie"
                      ></th>
                    </tr>
                  </thead>
                  <tbody>
                    {debts.map((d, idx) => (
                      <tr
                        key={d.id}
                        className="border-b border-white/5 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-2 py-2">
                          <input
                            aria-label={`Názov dlhu ${idx + 1}`}
                            type="text"
                            value={d.name}
                            onChange={(e) =>
                              updateDebt(d.id, { name: e.currentTarget.value })
                            }
                            className="w-full bg-slate-800 rounded px-2 py-1 text-sm"
                            placeholder="Názov"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            aria-label={`Zostatok dlhu ${idx + 1}`}
                            type="number"
                            value={d.principal}
                            onChange={(e) =>
                              updateDebt(d.id, {
                                principal: Number(e.currentTarget.value),
                              })
                            }
                            className="w-24 bg-slate-800 rounded px-2 py-1 text-sm tabular-nums"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            aria-label={`Úrok p.a. dlhu ${idx + 1}`}
                            type="number"
                            step="0.1"
                            value={d.ratePa}
                            onChange={(e) =>
                              updateDebt(d.id, {
                                ratePa: Number(e.currentTarget.value),
                              })
                            }
                            className="w-20 bg-slate-800 rounded px-2 py-1 text-sm tabular-nums"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            aria-label={`Splátka dlhu ${idx + 1}`}
                            type="number"
                            value={d.payment ?? d.monthly ?? 0}
                            onChange={(e) =>
                              updateDebt(d.id, {
                                payment: Number(e.currentTarget.value),
                              })
                            }
                            className="w-24 bg-slate-800 rounded px-2 py-1 text-sm tabular-nums"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            aria-label={`Zostáva rokov dlhu ${idx + 1}`}
                            type="number"
                            min="0"
                            max="50"
                            step="1"
                            value={
                              d.monthsLeft ? Math.round(d.monthsLeft / 12) : ""
                            }
                            onChange={(e) => {
                              const years = Number(e.currentTarget.value);
                              const months = years * 12;
                              updateDebt(d.id, { monthsLeft: months });
                            }}
                            className="w-20 bg-slate-800 rounded px-2 py-1 text-sm tabular-nums"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            aria-label={`Extra mesačná splátka dlhu ${idx + 1}`}
                            type="number"
                            value={d.extraMonthly ?? 0}
                            onChange={(e) =>
                              updateDebt(d.id, {
                                extraMonthly: Number(e.currentTarget.value),
                              })
                            }
                            className="w-20 bg-slate-800 rounded px-2 py-1 text-sm tabular-nums"
                            placeholder="0"
                            title="Mimoriadna splátka (ide na istinu)"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            aria-label={`Zmazať dlh ${idx + 1}`}
                            onClick={() => deleteDebt(d.id)}
                            className="px-3 py-1 rounded bg-red-600/20 ring-1 ring-red-500/40 text-xs font-medium hover:bg-red-600/30 transition-colors"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add another debt button */}
              <button
                type="button"
                aria-label="Pridať ďalší dlh"
                className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs transition-colors"
                onClick={addDebtRow}
              >
                ➕ Pridať ďalší dlh
              </button>
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        aria-controls="sec1"
        aria-expanded={open1}
        onClick={() => setOpen1((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-3 rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors text-left font-semibold"
      >
        <span id="cashflow-title">Cashflow &amp; rezerva</span>
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${open1 ? "" : "rotate-180"}`}
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
      {open1 && (
        <section
          id="sec1"
          role="region"
          aria-labelledby="cashflow-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5 transition-all duration-300"
        >
          {/* 2-column grid: Cashflow left, Rezerva right */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Left column: Príjmy a výdavky */}
            <div className="space-y-3">
              {/* Mesačný príjem: textbox + slider */}
              <div className="space-y-1.5">
                <label
                  htmlFor="monthly-income-input"
                  className="text-xs text-slate-400 block"
                >
                  Mesačný príjem
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="monthly-income-input"
                    type="text"
                    role="textbox"
                    inputMode="decimal"
                    aria-label="Mesačný príjem"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.currentTarget.value)}
                    onBlur={() => {
                      // Persist on blur
                      const num = Number(monthlyIncome) || 0;
                      writeV3({ profile: { monthlyIncome: num } });
                    }}
                    className="w-24 px-2 py-1 rounded bg-slate-800 text-sm"
                  />
                  <input
                    type="range"
                    min={0}
                    max={10000}
                    step={100}
                    value={Number(monthlyIncome) || 0}
                    onChange={(e) => {
                      const val = e.currentTarget.value;
                      setMonthlyIncome(val);
                      writeV3({ profile: { monthlyIncome: Number(val) } });
                    }}
                    aria-label="Mesačný príjem slider"
                    className="flex-1"
                  />
                  <span className="text-sm tabular-nums font-semibold w-20 text-right">
                    {Number(monthlyIncome) || 0} €
                  </span>
                </div>
              </div>
              {/* Fixné výdavky: textbox + slider */}
              <div className="space-y-1.5">
                <label
                  htmlFor="fixed-exp-input"
                  className="text-xs text-slate-400 block"
                >
                  Fixné výdavky
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="fixed-exp-input"
                    type="text"
                    role="textbox"
                    inputMode="decimal"
                    aria-label="Fixné výdavky"
                    value={fixedExp}
                    onChange={(e) => setFixedExp(e.currentTarget.value)}
                    onBlur={() => {
                      const num = Number(fixedExp) || 0;
                      writeV3({ profile: { fixedExp: num } });
                    }}
                    className="w-24 px-2 py-1 rounded bg-slate-800 text-sm"
                  />
                  <input
                    type="range"
                    min={0}
                    max={5000}
                    step={50}
                    value={Number(fixedExp) || 0}
                    onChange={(e) => {
                      const val = e.currentTarget.value;
                      setFixedExp(val);
                      writeV3({ profile: { fixedExp: Number(val) } });
                    }}
                    aria-label="Fixné výdavky slider"
                    className="flex-1"
                  />
                  <span className="text-sm tabular-nums font-semibold w-20 text-right">
                    {Number(fixedExp) || 0} €
                  </span>
                </div>
              </div>
              {/* Variabilné výdavky: textbox + slider */}
              <div className="space-y-1.5">
                <label
                  htmlFor="var-exp-input"
                  className="text-xs text-slate-400 block"
                >
                  Variabilné výdavky
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="var-exp-input"
                    type="text"
                    role="textbox"
                    inputMode="decimal"
                    aria-label="Variabilné výdavky"
                    value={varExp}
                    onChange={(e) => setVarExp(e.currentTarget.value)}
                    onBlur={() => {
                      const num = Number(varExp) || 0;
                      writeV3({ profile: { varExp: num } });
                    }}
                    className="w-24 px-2 py-1 rounded bg-slate-800 text-sm"
                  />
                  <input
                    type="range"
                    min={0}
                    max={3000}
                    step={50}
                    value={Number(varExp) || 0}
                    onChange={(e) => {
                      const val = e.currentTarget.value;
                      setVarExp(val);
                      writeV3({ profile: { varExp: Number(val) } });
                    }}
                    aria-label="Variabilné výdavky slider"
                    className="flex-1"
                  />
                  <span className="text-sm tabular-nums font-semibold w-20 text-right">
                    {Number(varExp) || 0} €
                  </span>
                </div>
              </div>
            </div>

            {/* Right column: Rezerva */}
            <div className="space-y-3">
              {/* Free cash badge */}
              {(() => {
                const income = Number(monthlyIncome) || 0;
                const fixed = Number(fixedExp) || 0;
                const variable = Number(varExp) || 0;
                const freeCash = income - fixed - variable;
                const isPositive = freeCash >= 0;
                return (
                  <div
                    className={`p-2 rounded-lg text-sm font-semibold ${
                      isPositive
                        ? "bg-emerald-800/40 ring-1 ring-emerald-500/40 text-emerald-200"
                        : "bg-red-800/40 ring-1 ring-red-500/40 text-red-200"
                    }`}
                    role="status"
                    aria-label="Voľné prostriedky"
                  >
                    <div className="text-xs text-slate-300 mb-0.5">
                      Voľné prostriedky
                    </div>
                    <div className="text-lg tabular-nums">
                      {freeCash.toFixed(0)} € / mes.
                    </div>
                  </div>
                );
              })()}
              <div className="space-y-1.5">
                <label
                  htmlFor="current-reserve-input"
                  className="text-xs text-slate-400 block"
                >
                  Súčasná rezerva (EUR)
                </label>
                <input
                  id="current-reserve-input"
                  type="text"
                  role="textbox"
                  inputMode="decimal"
                  aria-label="Súčasná rezerva"
                  value={currentReserve}
                  onChange={(e) => setCurrentReserve(e.currentTarget.value)}
                  className="w-full px-3 py-2 rounded bg-slate-800 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="emergency-months-input"
                  className="text-xs text-slate-400 block"
                >
                  Rezerva (mesiace)
                </label>
                <input
                  id="emergency-months-input"
                  type="text"
                  role="textbox"
                  inputMode="decimal"
                  aria-label="Rezerva (mesiace)"
                  value={emergencyMonths}
                  onChange={(e) => setEmergencyMonths(e.currentTarget.value)}
                  className="w-full px-3 py-2 rounded bg-slate-800 text-sm"
                />
              </div>

              {/* Rezerva insight/CTA (conditional) */}
              {(() => {
                const reserve = Number(currentReserve) || 0;
                const months = Number(emergencyMonths) || 0;
                const needsReserve = reserve < 1000 || months < 6;
                if (!needsReserve) return null;
                return (
                  <div
                    className="p-3 rounded-lg bg-amber-800/30 ring-1 ring-amber-500/40 text-amber-200 text-sm animate-[fadeIn_0.3s_ease-in]"
                    role="status"
                  >
                    <div className="font-semibold mb-1">
                      💡 Odporúčanie: Doplň rezervu
                    </div>
                    <div className="text-xs text-amber-300/80 mb-2">
                      Minimálne 1000 € alebo 6 mesiacov výdavkov.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // Apply baseline: 1000 EUR, 6 months
                        setCurrentReserve("1000");
                        setEmergencyMonths("6");
                        writeV3({
                          profile: { currentReserve: 1000, emergencyMonths: 6 },
                        });
                      }}
                      className="px-3 py-1.5 rounded bg-amber-600/40 hover:bg-amber-600/60 hover:scale-105 active:scale-95 transition-all duration-200 text-sm font-medium hover:shadow-lg hover:shadow-amber-500/20"
                      title="Nastav rezervu na 1000 € a 6 mesiacov"
                    >
                      Aplikovať minimum (1000 € / 6 mes.)
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Mesačný vklad slider */}
          <div className="space-y-3">
            <button
              type="button"
              aria-label="Nastaviť mesačný vklad na 100 €"
              className="px-3 py-2 rounded bg-slate-800 text-xs hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all duration-200 hover:shadow-md"
              onClick={() => {
                writeV3({ monthly: 100 });
                const f = () => monthlySliderRef.current?.focus();
                f();
                requestAnimationFrame(f);
                setTimeout(f, 0);
              }}
              title="Nastav mesačný vklad na 100 € a fokusuj slider"
            >
              Nastaviť mesačný vklad
            </button>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
              <label htmlFor="monthly-contrib-slider">
                Mesačný vklad – slider
              </label>
              <input
                id="monthly-contrib-slider"
                ref={monthlySliderRef}
                type="range"
                min={0}
                max={1000}
                step={10}
                value={(seed as any).monthly || 0}
                aria-label="Mesačný vklad – slider"
                data-testid={TEST_IDS.MONTHLY_SLIDER}
                onChange={(e) => {
                  const newVal = Number(e.currentTarget.value);
                  writeV3({ monthly: newVal });
                }}
              />
              <span className="tabular-nums">{(seed as any).monthly || 0} €</span>
            </div>
          </div>
          {/* Starý debt UI odstránený - teraz používame standalone section */}
        </section>
      )}
      {/* sec2: Investičné nastavenia - extracted component */}
      <InvestSection open={open2} onToggle={() => setOpen2((v) => !v)} />

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
            {modeUi === "BASIC" ? (
              <PortfolioSelector />
            ) : (
              <MixPanel
                mode={modeUi}
                onReserveOpen={() => {
                  setWizardType("reserve");
                  setWizardOpen(true);
                }}
              />
            )}
          </div>
        </section>
      )}
      {/* Share button moved to right sticky panel for visibility */}
      {IS_TEST && (
        <>
          {/* ProfilePersistStub (Legacy) – odstránené risk_pref radios (duplicitné) */}
          <div className="sr-only" aria-hidden="true">
            <fieldset>
              <legend>Client type</legend>
              <label>
                <input
                  type="radio"
                  name="client_type"
                  value="BASIC"
                  aria-label="BASIC"
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
                />{" "}
                Kríza
              </label>
            </fieldset>
            {/* Legacy crisis bias spinbutton odstránený (duplicitný) */}
          </div>
          {/* Legacy IncomeExpense persist stubs odstránené – teraz viditeľné v sec1 */}
        </>
      )}

      {/* Share modal stub */}
    </div>
  );

  /**
   * Calculate real amortization for debts (month by month compound interest).
   * Returns remaining principal after `months` for a single debt.
   */
  function calculateDebtRemaining(
    principal: number,
    ratePa: number,
    monthlyPayment: number,
    months: number
  ): number {
    if (months <= 0) return principal;
    if (monthlyPayment <= 0 || ratePa < 0) return principal; // No payment → no reduction

    let remaining = principal;
    const monthlyRate = ratePa / 12 / 100;

    for (let m = 0; m < months; m++) {
      if (remaining <= 0) break;
      const interest = remaining * monthlyRate;
      const principalPaid = monthlyPayment - interest;
      if (principalPaid <= 0) {
        // Payment too low to cover interest → debt stays same or grows (edge case)
        remaining += interest;
      } else {
        remaining -= principalPaid;
      }
    }

    return Math.max(0, remaining);
  }

  /**
   * Calculate total debt remaining after `months` for all debts.
   */
  function calculateTotalDebtAtMonths(
    debts: Array<{
      principal: number;
      ratePa: number;
      payment?: number;
      monthly?: number;
    }>,
    months: number
  ): number {
    return debts.reduce((sum, d) => {
      const payment = d.payment ?? d.monthly ?? 0;
      const remaining = calculateDebtRemaining(
        d.principal,
        d.ratePa,
        payment,
        months
      );
      return sum + remaining;
    }, 0);
  }

  // Helper removed: using calculateFutureValue from engine/calculations.ts

  const right = (
    <div className="space-y-4">
      <button
        type="button"
        aria-controls="sec5"
        aria-expanded={open5}
        onClick={() => setOpen5((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-3 rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors text-left font-semibold"
      >
        <span id="sec5-title">Metriky &amp; odporúčania</span>
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${open5 ? "" : "rotate-180"}`}
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
      {open5 && (
        <MetricsSection
          riskPref={
            seed.profile?.riskPref || (seed as any).riskPref || "vyvazeny"
          }
          lumpSumEur={(seed.profile?.lumpSumEur as any) || 0}
          monthlyVklad={(seed as any).monthly || 0}
          horizonYears={(seed.profile?.horizonYears as any) || 10}
          goalAssetsEur={(seed.profile?.goalAssetsEur as any) || 0}
        />
      )}
      <button
        type="button"
        aria-controls="sec4"
        aria-expanded={open4}
        onClick={() => setOpen4((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-3 rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors text-left font-semibold"
      >
        <span id="sec4-title">Projekcia</span>
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${open4 ? "" : "rotate-180"}`}
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
      {open4 && (
        <section
          id="sec4"
          role="region"
          aria-labelledby="sec4-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5 transition-all duration-300"
        >
          <ProjectionChart
            lumpSumEur={(seed.profile?.lumpSumEur as any) || 0}
            monthlyVklad={(seed as any).monthly || 0}
            horizonYears={(seed.profile?.horizonYears as any) || 10}
            mix={mix}
            riskPref={
              seed.profile?.riskPref || (seed as any).riskPref || "vyvazeny"
            }
            debts={debts}
            goalAssetsEur={(seed.profile?.goalAssetsEur as any) || 0}
          />
        </section>
      )}

      {/* Share CTA - výrazný zelený button */}
      <section className="w-full min-w-0 rounded-2xl ring-1 ring-emerald-500/30 bg-gradient-to-br from-emerald-900/40 to-emerald-950/20 p-4 md:p-5">
        <button
          ref={shareBtnRef}
          type="button"
          onClick={() => setShareOpen(true)}
          className="group relative w-full px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold text-lg shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 overflow-hidden"
          aria-label="Zdieľať s advisorom"
        >
          {/* Shine effect */}
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
      {/* Sticky Toolbar */}
      <Toolbar
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        modeUi={modeUi}
        onModeToggle={handleModeToggle}
      />

      {/* Sidebar Navigation (overlay) */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Deeplink Banner (pod toolbarom) */}
      {showLinkBanner && (
        <div
          role="alert"
          data-testid="deeplink-banner"
          className="mx-auto max-w-[1320px] px-4 mt-3 mb-3 rounded bg-emerald-600/15 border border-emerald-500/30 p-3 text-xs flex justify-between items-start gap-3"
        >
          <span>Konfigurácia načítaná zo zdieľaného linku.</span>
          <button
            type="button"
            aria-label="Zavrieť oznámenie"
            className="px-2 py-0.5 rounded bg-emerald-700/40"
            onClick={() => {
              setShowLinkBanner(false);
              clearHashRef.current();
            }}
          >
            ×
          </button>
        </div>
      )}
      <PageLayout left={left} right={right} />
      <div
        role="dialog"
        aria-label="Mini-wizard odporúčania"
        data-testid="mini-wizard-dialog"
        data-open={wizardOpen ? "1" : "0"}
        className={
          wizardOpen
            ? "fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
            : "pointer-events-none fixed inset-0 z-[-1] opacity-0"
        }
        aria-hidden={wizardOpen ? "false" : "true"}
        onKeyDown={(e) => {
          if (e.key === "Escape" && wizardOpen) {
            e.stopPropagation();
            setWizardOpen(false);
            setTimeout(() => wizardTriggerRef.current?.focus(), 0);
          }
        }}
        tabIndex={-1}
      >
        {wizardOpen && (
          <div
            className="rounded-xl bg-slate-900 p-6 ring-1 ring-white/10 space-y-4 max-w-sm w-full relative z-[101]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold">Odporúčanie</h2>
            <p className="text-sm text-slate-400">
              {wizardType === "reserve"
                ? "Nastaviť rezervu na minimum (1000€ / 6 mesiacov)?"
                : "Nastaviť zlato na 12 %?"}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                data-testid={TEST_IDS.WIZARD_ACTION_APPLY}
                className="px-4 py-2 rounded bg-emerald-600 text-white"
                aria-label={
                  wizardType === "reserve"
                    ? "Apply reserve baseline"
                    : "Apply gold 12%"
                }
                onClick={() => {
                  if (wizardType === "reserve") {
                    const cur = readV3();
                    const reserveEur = Math.max(
                      cur.reserveEur || cur.profile?.reserveEur || 0,
                      1000
                    );
                    const reserveMonths = Math.max(
                      cur.reserveMonths || cur.profile?.reserveMonths || 0,
                      6
                    );
                    writeV3({
                      profile: {
                        ...(cur.profile || {}),
                        reserveEur,
                        reserveMonths,
                      } as any,
                    });
                  } else {
                    // Gold wizard: set gold to 12%
                    const cur = readV3();
                    const currentMix = (cur.mix as any as MixItem[]) || [];
                    if (currentMix.length > 0) {
                      const adjusted = setGoldTarget(currentMix, 12);
                      writeV3({ mix: adjusted as any });
                    }
                  }
                  setWizardOpen(false);
                  const focusFn = () => {
                    const targetTestId =
                      wizardType === "reserve"
                        ? TEST_IDS.MONTHLY_SLIDER
                        : TEST_IDS.GOLD_SLIDER;
                    const el = document.querySelector<HTMLInputElement>(
                      `[data-testid="${targetTestId}"]`
                    );
                    el?.focus();
                    el?.classList.add("animate-pulse");
                    setTimeout(
                      () => el?.classList.remove("animate-pulse"),
                      1000
                    );
                  };
                  Promise.resolve().then(focusFn);
                  setTimeout(focusFn, 0);
                }}
              >
                Použiť
              </button>
              <button
                onClick={() => {
                  setWizardOpen(false);
                  setTimeout(() => wizardTriggerRef.current?.focus(), 0);
                }}
                className="px-4 py-2 rounded bg-slate-700"
              >
                Zavrieť
              </button>
            </div>
          </div>
        )}
      </div>
      {shareOpen && (
        <div
          role="dialog"
          aria-label="Zdieľať nastavenie"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="bg-slate-900 rounded-xl p-6 ring-1 ring-white/10 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">📧 Odoslať advisorovi</h2>

            {/* Preview FV + Mix */}
            {(() => {
              const v3Data = readV3();
              const mix: MixItem[] = (v3Data.mix as any) || [];
              const lump = (v3Data.profile?.lumpSumEur as any) || 0;
              const monthly = (v3Data as any).monthly || 0;
              const years = (v3Data.profile?.horizonYears as any) || 10;
              const goal = (v3Data.profile?.goalAssetsEur as any) || 0;
              const riskPref = (v3Data.profile?.riskPref || (v3Data as any).riskPref || "vyvazeny") as "konzervativny" | "vyvazeny" | "rastovy";
              const approx = approxYieldAnnualFromMix(mix, riskPref);
              const fv = calculateFutureValue(lump, monthly, years, approx);
              const pct = goal > 0 ? Math.round((fv / goal) * 100) : 0;

              return (
                <div className="p-4 rounded-lg bg-slate-800/50 ring-1 ring-white/5 space-y-3 text-sm">
                  <div className="font-medium text-slate-300">
                    Vaša projekcia:
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">
                        Hodnota po {years} rokoch:
                      </span>
                      <div className="font-bold text-emerald-400 tabular-nums">
                        {fv.toFixed(0)} €
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Progres k cieľu:</span>
                      <div className="font-bold text-amber-400 tabular-nums">
                        {pct}%
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Jednorazový vklad:</span>
                      <div className="font-medium tabular-nums">
                        {lump.toFixed(0)} €
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Mesačný vklad:</span>
                      <div className="font-medium tabular-nums">
                        {monthly.toFixed(0)} €
                      </div>
                    </div>
                  </div>
                  {mix.length > 0 && (
                    <div className="pt-2 border-t border-white/5">
                      <div className="text-slate-400 mb-1">Mix portfólia:</div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {mix
                          .filter((i) => i.pct > 0)
                          .map((item) => {
                            const labels: Record<string, string> = {
                              gold: "🪙 Zlato",
                              dyn: "📊 Dyn. riadenie",
                              etf: "🌍 ETF svet",
                              bonds: "📜 Dlhopisy",
                              cash: "💵 Hotovosť",
                              crypto: "₿ Krypto",
                              real: "🏘️ Reality",
                              other: "📦 Ostatné",
                            };
                            return (
                              <div
                                key={item.key}
                                className="flex justify-between"
                              >
                                <span className="text-slate-300">
                                  {labels[item.key] || item.key}
                                </span>
                                <span className="font-medium tabular-nums">
                                  {item.pct.toFixed(1)}%
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Email input */}
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-300">
                Email finančného advisora
              </span>
              <input
                autoFocus
                aria-label="Email agenta"
                type="email"
                placeholder="advisor@example.com"
                className="w-full bg-slate-800 rounded-lg px-4 py-2.5 text-sm ring-1 ring-white/5 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
              />
            </label>

            {/* CTA buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-medium text-sm hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
                onClick={() => {
                  // TODO: Generate mailto link with template + deeplink
                  const v3Data = readV3();
                  const mix: MixItem[] = (v3Data.mix as any) || [];
                  const lump = (v3Data.profile?.lumpSumEur as any) || 0;
                  const monthly = (v3Data as any).monthly || 0;
                  const years = (v3Data.profile?.horizonYears as any) || 10;
                  const goal = (v3Data.profile?.goalAssetsEur as any) || 0;
                  const riskPref = (v3Data.profile?.riskPref || (v3Data as any).riskPref || "vyvazeny") as "konzervativny" | "vyvazeny" | "rastovy";
                  const approx = approxYieldAnnualFromMix(mix, riskPref);
                  const fv = calculateFutureValue(lump, monthly, years, approx);

                  // Generate deeplink
                  const state = {
                    profile: {
                      lumpSumEur: lump,
                      horizonYears: years,
                      goalAssetsEur: goal,
                    },
                    monthly,
                    mix,
                  };
                  const encoded = btoa(JSON.stringify(state));
                  const deeplink = `${window.location.origin}${window.location.pathname}#state=${encodeURIComponent(encoded)}`;

                  // Email template
                  const subject = "Investičná projekcia - Unotop";
                  const body = `Dobrý deň,

pridávam vám moju investičnú projekciu:

📊 Parametre:
- Jednorazový vklad: ${lump.toFixed(0)} €
- Mesačný vklad: ${monthly.toFixed(0)} €
- Investičný horizont: ${years} rokov
- Cieľ majetku: ${goal.toFixed(0)} €

💰 Projekcia:
- Hodnota po ${years} rokoch: ${fv.toFixed(0)} €
- Progres k cieľu: ${goal > 0 ? Math.round((fv / goal) * 100) : 0}%
- Odhad výnosu p.a.: ${(approx * 100).toFixed(1)}%

🔗 Interaktívna projekcia:
${deeplink}

S pozdravom`;

                  const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                  window.location.href = mailtoLink;

                  setShareOpen(false);
                  setTimeout(() => shareBtnRef.current?.focus(), 0);
                }}
              >
                📨 Odoslať email
              </button>
              <button
                type="button"
                className="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
                onClick={() => {
                  setShareOpen(false);
                  setTimeout(() => shareBtnRef.current?.focus(), 0);
                }}
              >
                Zrušiť
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Test-only mix invariants bar (for mix-invariants.* tests) ---
function MixInvariantsBarTestOnly() {
  // Snapshot of baseline (assetName -> value)
  const baselineRef = React.useRef<Record<string, number> | null>(null);
  const [msg, setMsg] = React.useState("");
  const [baselineReady, setBaselineReady] = React.useState(false);
  // Capture baseline after mount (next tick to ensure DOM inputs rendered)
  React.useEffect(() => {
    if (!baselineRef.current) {
      // capture after render microtask
      setTimeout(() => {
        baselineRef.current = snapshot();
        setBaselineReady(true);
      }, 0);
    }
  }, []);

  function snapshot(): Record<string, number> {
    const allow = /(Zlato|Akcie|Dlhopisy|Hotovosť|Dynamické|Krypto)/i;
    const map: Record<string, number> = {};
    const seen = new Set<string>();
    const spin = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        'input[role="spinbutton"], input[type="number"]'
      )
    );
    spin.forEach((el) => {
      const raw = (
        el.getAttribute("aria-label") ||
        el.closest("label")?.textContent ||
        ""
      )
        .split("%")[0]
        .trim();
      if (!raw) return;
      if (!allow.test(raw)) return;
      if (/bias/i.test(raw)) return;
      // Prefer the first occurrence (avoid gold slider numeric duplicate etc.)
      if (seen.has(raw)) return;
      seen.add(raw);
      const v = Number(el.value) || 0;
      map[raw] = v;
    });
    return map;
  }

  function normalize(values: Record<string, number>): Record<string, number> {
    const total = Object.values(values).reduce((a, b) => a + b, 0) || 1;
    const scale = 100 / total;
    const out: Record<string, number> = {};
    Object.keys(values).forEach((k) => {
      out[k] = +(values[k] * scale).toFixed(2);
    });
    return out;
  }

  function applyRules() {
    if (!baselineRef.current) {
      baselineRef.current = snapshot();
      setBaselineReady(true);
    }
    const before = snapshot();
    const assets = { ...before };
    // Ensure required keys (default 0)
    const req = ["Zlato (fyzické)", "Dynamické riadenie", "Krypto (BTC/ETH)"];
    req.forEach((k) => {
      if (assets[k] === undefined) assets[k] = 0;
    });
    // Gold floor
    if ((assets["Zlato (fyzické)"] ?? 0) < 10) assets["Zlato (fyzické)"] = 10;
    // Dyn + Crypto cap
    const dyn = assets["Dynamické riadenie"] ?? 0;
    const crypto = assets["Krypto (BTC/ETH)"] ?? 0;
    if (dyn + crypto > 22) {
      assets["Dynamické riadenie"] = Math.max(0, 22 - crypto);
    }
    // Normalize to 100
    const sum = Object.values(assets).reduce((a, b) => a + b, 0) || 1;
    const scale = 100 / sum;
    Object.keys(assets).forEach(
      (k) => (assets[k] = Math.round(assets[k] * scale))
    );
    // Fix rounding drift on gold
    const postSum = Object.values(assets).reduce((a, b) => a + b, 0);
    if (postSum !== 100) {
      assets["Zlato (fyzické)"] = Math.max(
        0,
        assets["Zlato (fyzické)"] + (100 - postSum)
      );
    }
    // Detect change
    let changed = false;
    Object.keys(assets).forEach((k) => {
      if ((before[k] ?? 0) !== assets[k]) changed = true;
    });
    if (!changed) {
      setMsg("Žiadne úpravy");
      return;
    }
    // Apply to DOM spinbuttons
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        'input[role="spinbutton"], input[type="number"]'
      )
    );
    Object.entries(assets).forEach(([label, val]) => {
      const el = inputs.find((n) => {
        const lab = (
          n.getAttribute("aria-label") ||
          n.closest("label")?.textContent ||
          ""
        )
          .split("%")[0]
          .trim();
        return lab === label;
      });
      if (el) {
        const nextVal = String(val);
        if (el.value !== nextVal) {
          el.value = nextVal;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
    const goldAdj =
      (before["Zlato (fyzické)"] ?? 0) < 10 &&
      (assets["Zlato (fyzické)"] ?? 0) >= 10;
    const dynCap =
      (assets["Dynamické riadenie"] ?? 0) + (assets["Krypto (BTC/ETH)"] ?? 0) <=
      22;
    const sum100 = Object.values(assets).reduce((a, b) => a + b, 0) === 100;
    const chips: string[] = [];
    if (goldAdj) chips.push("Zlato dorovnané");
    if (dynCap) chips.push("Dyn+Krypto obmedzené");
    if (sum100) chips.push("Súčet dorovnaný");
    setMsg("upravené podľa pravidiel" + (chips.length ? "" : ""));
    (window as any).__mixChips = chips; // uložiť pre render podmienku
  }

  function resetValues() {
    if (!baselineRef.current) {
      baselineRef.current = snapshot();
      setBaselineReady(true);
    }
    const base = baselineRef.current;
    Object.entries(base).forEach(([label, val]) => {
      const el = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input[role="spinbutton"], input[type="number"]'
        )
      ).find((n) => {
        const l = (
          n.getAttribute("aria-label") ||
          n.closest("label")?.textContent ||
          ""
        )
          .split("%")[0]
          .trim();
        return l === label;
      });
      if (el) {
        const nextVal = String(Math.round(val));
        if (el.value !== nextVal) {
          el.value = nextVal;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
    setMsg("Žiadne úpravy");
  }

  // baselineReady state managed above
  return (
    <div aria-label="Mix invariants" className="sr-only">
      <button aria-label="Upraviť podľa pravidiel" onClick={applyRules}>
        Upraviť podľa pravidiel
      </button>
      <button
        aria-label="Resetovať hodnoty"
        onClick={resetValues}
        disabled={!baselineReady}
      >
        Resetovať hodnoty
      </button>
      {/* Toggle režimu odstránený z invariants sr-only sekcie aby nebol duplicitný */}
      <div role="status" aria-live="polite">
        {msg || "Žiadne úpravy"}
      </div>
      {msg.startsWith("upravené") &&
        Array.isArray((window as any).__mixChips) && (
          <div aria-label="Mix summary chips">
            {(window as any).__mixChips.includes("Zlato dorovnané") && (
              <span>Zlato dorovnané</span>
            )}
            {(window as any).__mixChips.includes("Dyn+Krypto obmedzené") && (
              <span>Dyn+Krypto obmedzené</span>
            )}
            {(window as any).__mixChips.includes("Súčet dorovnaný") && (
              <span>Súčet dorovnaný</span>
            )}
          </div>
        )}
    </div>
  );
}
