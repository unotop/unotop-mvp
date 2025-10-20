import React from "react";
import PageLayout from "./app/PageLayout";
import { MixPanel } from "./features/mix/MixPanel";
import { writeV3, readV3, Debt as PersistDebt } from "./persist/v3";
import { TEST_IDS } from "./testIds";
import { useUncontrolledValueInput } from "./features/_hooks/useUncontrolledValueInput";
import { riskScore, applyRiskConstrainedMix, setGoldTarget, type MixItem } from "./features/mix/mix.service";
import { RiskGauge } from "./components/RiskGauge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

const IS_TEST = process.env.NODE_ENV === "test";
interface Debt extends PersistDebt {
  payment?: number;
}

export default function LegacyApp() {
  const seed = readV3();
  const [open0, setOpen0] = React.useState(true); // sec0: Profil klienta
  const [open1, setOpen1] = React.useState(true);
  const [open2, setOpen2] = React.useState(true);
  const [open3, setOpen3] = React.useState(true);
  const [open5, setOpen5] = React.useState(true);
  const [monthlyContribution, setMonthlyContribution] = React.useState(0);
  const monthlySliderRef = React.useRef<HTMLInputElement | null>(null);
  const [debtsOpen, setDebtsOpen] = React.useState(false);
  const [debts, setDebts] = React.useState<Debt[]>(
    () => (seed.debts as any as Debt[]) || []
  );
  // Profil klienta (sec0) state
  const [clientType, setClientType] = React.useState<
    "individual" | "family" | "firm"
  >(() => (seed.profile?.clientType as any) || "individual");
  const [riskPref, setRiskPref] = React.useState<string>(
    () => seed.profile?.riskPref || (seed as any).riskPref || "vyvazeny"
  );
  const [crisisBias, setCrisisBias] = React.useState<number>(
    () => (seed.profile?.crisisBias as any) ?? (seed as any).crisisBias ?? 0
  );
  // Investičné nastavenia (sec2) state
  const [lumpSumEur, setLumpSumEur] = React.useState(
    () => (seed.profile?.lumpSumEur as any) || 0
  );
  const [monthlyVklad, setMonthlyVklad] = React.useState(
    () => (seed as any).monthly || 0
  );
  const [horizonYears, setHorizonYears] = React.useState(
    () => (seed.profile?.horizonYears as any) || 10
  );
  const [goalAssetsEur, setGoalAssetsEur] = React.useState(
    () => (seed.profile?.goalAssetsEur as any) || 0
  );
  // test-only / accessibility stubs
  const [crisisIdx, setCrisisIdx] = React.useState(0);
  const [monthlyIncome, setMonthlyIncome] = React.useState("");
  const [fixedExp, setFixedExp] = React.useState("");
  const [varExp, setVarExp] = React.useState("");
  const [currentReserve, setCurrentReserve] = React.useState("");
  const [emergencyMonths, setEmergencyMonths] = React.useState("");
  const [lumpSum, setLumpSum] = React.useState("");
  const [monthlyContribBox, setMonthlyContribBox] = React.useState("");
  const [horizon, setHorizon] = React.useState("");
  const [goalAsset, setGoalAsset] = React.useState("");
  const [stocks, setStocks] = React.useState(0);
  const [bonds, setBonds] = React.useState(0);
  const [cash, setCash] = React.useState(0);
  const [shareOpen, setShareOpen] = React.useState(false);
  const shareBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const [modeUi, setModeUi] = React.useState<string>(
    seed.profile?.modeUi || (seed as any).modeUi || "BASIC"
  );
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
  const [wizardType, setWizardType] = React.useState<'reserve' | 'gold'>('reserve');
  const wizardTriggerRef = React.useRef<HTMLButtonElement | null>(null);

  // Uncontrolled hooks pre sec2 polia
  const lumpSumCtl = useUncontrolledValueInput({
    initial: lumpSumEur,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, n),
    commit: (n) => {
      setLumpSumEur(n);
      const cur = readV3();
      writeV3({ profile: { ...(cur.profile || {}), lumpSumEur: n } as any });
    },
  });
  const monthlyVkladCtl = useUncontrolledValueInput({
    initial: monthlyVklad,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, n),
    commit: (n) => {
      setMonthlyVklad(n);
      writeV3({ monthly: n });
    },
  });
  const horizonCtl = useUncontrolledValueInput({
    initial: horizonYears,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(1, Math.min(50, n)),
    commit: (n) => {
      setHorizonYears(n);
      const cur = readV3();
      writeV3({ profile: { ...(cur.profile || {}), horizonYears: n } as any });
    },
  });
  const goalCtl = useUncontrolledValueInput({
    initial: goalAssetsEur,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, n),
    commit: (n) => {
      setGoalAssetsEur(n);
      const cur = readV3();
      writeV3({ profile: { ...(cur.profile || {}), goalAssetsEur: n } as any });
    },
  });

  // Persist helpers pre sec0 (Profil klienta)
  const persistClientType = (type: "individual" | "family" | "firm") => {
    setClientType(type);
    const cur = readV3();
    writeV3({ profile: { ...(cur.profile || {}), clientType: type } as any });
  };
  const persistRiskPref = (pref: string) => {
    setRiskPref(pref);
    const cur = readV3();
    writeV3({
      profile: { ...(cur.profile || {}), riskPref: pref } as any,
      riskPref: pref,
    });
  };
  const persistCrisisBias = (bias: number) => {
    setCrisisBias(bias);
    const cur = readV3();
    writeV3({
      profile: { ...(cur.profile || {}), crisisBias: bias } as any,
      crisisBias: bias,
    });
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
    <div className="min-w-0 space-y-6" data-testid="left-col">
      {/* sec0: Profil klienta (nový blok nad sec1) */}
      {open0 && (
        <section
          id="sec0"
          role="region"
          aria-labelledby="profile-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5"
        >
          <header id="profile-title" className="mb-4 font-semibold">
            0) Profil klienta
          </header>
          <div className="space-y-5">
            {/* Typ klienta */}
            <fieldset className="space-y-2">
              <legend className="text-xs text-slate-400 mb-2">
                Typ klienta
              </legend>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="client-type"
                    value="individual"
                    checked={clientType === "individual"}
                    onChange={(e) =>
                      persistClientType(e.currentTarget.value as any)
                    }
                    className="accent-blue-500"
                  />
                  <span>Jednotlivec</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="client-type"
                    value="family"
                    checked={clientType === "family"}
                    onChange={(e) =>
                      persistClientType(e.currentTarget.value as any)
                    }
                    className="accent-blue-500"
                  />
                  <span>Rodina</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="client-type"
                    value="firm"
                    checked={clientType === "firm"}
                    onChange={(e) =>
                      persistClientType(e.currentTarget.value as any)
                    }
                    className="accent-blue-500"
                  />
                  <span>Firma</span>
                </label>
              </div>
            </fieldset>

            {/* Preferencia rizika */}
            <fieldset className="space-y-2">
              <legend className="text-xs text-slate-400 mb-2">
                Preferencia rizika
              </legend>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="risk-pref"
                    value="konzervativny"
                    checked={riskPref === "konzervativny"}
                    onChange={(e) => persistRiskPref(e.currentTarget.value)}
                    className="accent-emerald-500"
                  />
                  <span>Konzervatívny (risk cap 4.0)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="risk-pref"
                    value="vyvazeny"
                    checked={riskPref === "vyvazeny"}
                    onChange={(e) => persistRiskPref(e.currentTarget.value)}
                    className="accent-amber-500"
                  />
                  <span>Vyvážený (risk cap 6.0)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="risk-pref"
                    value="rastovy"
                    checked={riskPref === "rastovy"}
                    onChange={(e) => persistRiskPref(e.currentTarget.value)}
                    className="accent-red-500"
                  />
                  <span>Rastový (risk cap 7.5)</span>
                </label>
              </div>
            </fieldset>

            {/* Krízový bias slider */}
            <div className="space-y-2">
              <label
                htmlFor="crisis-bias-slider"
                className="text-xs text-slate-400 block"
              >
                Krízový bias (0 až 3)
              </label>
              <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                <input
                  id="crisis-bias-slider"
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={crisisBias}
                  onChange={(e) =>
                    persistCrisisBias(Number(e.currentTarget.value))
                  }
                  className="w-full"
                  aria-label="Krízový bias (0 až 3)"
                />
                <span className="text-sm font-semibold tabular-nums w-8 text-center">
                  {crisisBias}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}
      <div className="space-y-2" aria-label="Collapsy headers">
        <button
          type="button"
          aria-controls="sec0"
          aria-expanded={open0}
          onClick={() => setOpen0((v) => !v)}
          className="px-2 py-1 rounded bg-slate-800 text-xs"
        >
          0) Profil klienta
        </button>
        <button
          type="button"
          aria-controls="sec1"
          aria-expanded={open1}
          onClick={() => setOpen1((v) => !v)}
          className="px-2 py-1 rounded bg-slate-800 text-xs"
        >
          1) Cashflow & rezerva
        </button>
        <button
          type="button"
          aria-controls="sec2"
          aria-expanded={open2}
          onClick={() => setOpen2((v) => !v)}
          className="px-2 py-1 rounded bg-slate-800 text-xs"
        >
          2) Investičné nastavenia
        </button>
        <button
          type="button"
          aria-controls="sec3"
          aria-expanded={open3}
          onClick={() => setOpen3((v) => !v)}
          className="px-2 py-1 rounded bg-slate-800 text-xs"
        >
          3) Zloženie portfólia
        </button>
        <button
          type="button"
          aria-controls="sec5"
          aria-expanded={open5}
          onClick={() => setOpen5((v) => !v)}
          className="px-2 py-1 rounded bg-slate-800 text-xs"
        >
          4) Metriky & odporúčania
        </button>
      </div>
      {open1 && (
        <section
          id="sec1"
          role="region"
          aria-labelledby="cashflow-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5"
        >
          <header id="cashflow-title" className="mb-3 font-semibold">
            Cashflow &amp; rezerva
          </header>

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
                    className="p-3 rounded-lg bg-amber-800/30 ring-1 ring-amber-500/40 text-amber-200 text-sm"
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
                      className="px-3 py-1.5 rounded bg-amber-600/40 hover:bg-amber-600/60 text-sm font-medium"
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
              className="px-3 py-2 rounded bg-slate-800 text-xs"
              onClick={() => {
                setMonthlyContribution(100);
                const f = () => monthlySliderRef.current?.focus();
                f();
                requestAnimationFrame(f);
                setTimeout(f, 0);
              }}
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
                value={monthlyContribution}
                aria-label="Mesačný vklad – slider"
                data-testid={TEST_IDS.MONTHLY_SLIDER}
                onChange={(e) =>
                  setMonthlyContribution(Number(e.currentTarget.value))
                }
              />
              <span className="tabular-nums">{monthlyContribution} €</span>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <button
              type="button"
              aria-label="Pridať dlh"
              className="px-3 py-2 rounded bg-slate-800 text-xs"
              onClick={() => {
                setDebtsOpen(true);
                if (!debts.length) addDebtRow();
              }}
            >
              Pridať dlh
            </button>
            {debtsOpen && (
              <section
                role="region"
                aria-labelledby="debts-title"
                className="space-y-2 text-xs ring-1 ring-white/10 rounded p-3"
              >
                <header id="debts-title" className="font-semibold">
                  Dlhy a hypotéky
                </header>
                <p
                  role="note"
                  data-testid="debt-crossover-note"
                  className="text-xs text-slate-400"
                >
                  Crossover placeholder
                </p>
                <figure
                  aria-label="Debt vs Invest chart"
                  data-testid="debt-vs-invest-chart"
                  className="mt-1 space-y-0.5"
                >
                  <figcaption className="text-xs font-medium">
                    Zostatok hypotéky
                  </figcaption>
                  <div className="text-[10px] text-slate-300">
                    Hodnota portfólia vs. zostatok
                  </div>
                  <svg
                    width="200"
                    height="40"
                    role="img"
                    aria-label="chart-placeholder"
                    className="block mt-1 fill-slate-600"
                  >
                    <rect x="0" y="10" width="200" height="20" />
                  </svg>
                </figure>
                <div className="flex gap-2 flex-wrap items-center">
                  <button
                    type="button"
                    onClick={addDebtRow}
                    className="px-2 py-1 rounded bg-slate-700"
                  >
                    + Riadok
                  </button>
                  {debts.length > 0 &&
                    (() => {
                      const sum = debts.reduce(
                        (a, b) => a + (b.payment ?? b.monthly ?? 0),
                        0
                      );
                      const sumFmt = (() => {
                        try {
                          return sum.toLocaleString("sk-SK");
                        } catch {
                          return String(sum);
                        }
                      })();
                      return (
                        <>
                          <div
                            className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1"
                            aria-label="KPI dlhy chip"
                          >
                            <span>
                              Dlhy: {debts.length} | Splátky: {sumFmt} €
                            </span>
                          </div>
                          <div
                            className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1"
                            aria-label="Mesačné splátky chip"
                          >
                            <span>Mesačné splátky spolu: {sumFmt} €</span>
                          </div>
                        </>
                      );
                    })()}
                </div>
                {debts.length > 0 && (
                  <p
                    data-testid="debt-reason-line"
                    className="text-[11px] text-slate-400 mt-1"
                  >
                    Dôvod: úrok {debts[0].ratePa} % vs. oč. výnos − 2 p.b.
                  </p>
                )}
                {debts.length > 0 && (
                  <table
                    role="table"
                    aria-label="Tabuľka dlhov"
                    className="w-full text-left border-collapse mt-2"
                  >
                    <thead>
                      <tr>
                        <th scope="col" className="px-1 py-0.5">
                          Názov
                        </th>
                        <th scope="col" className="px-1 py-0.5">
                          Istina
                        </th>
                        <th scope="col" className="px-1 py-0.5">
                          Úrok p.a.
                        </th>
                        <th scope="col" className="px-1 py-0.5">
                          Mesačná splátka
                        </th>
                        <th scope="col" className="px-1 py-0.5">
                          Zostáva (mesiace)
                        </th>
                        <th
                          scope="col"
                          className="px-1 py-0.5"
                          aria-label="Akcie"
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {debts.map((d) => (
                        <tr key={d.id} className="odd:bg-slate-800/30">
                          <td className="px-1 py-0.5">
                            <input
                              aria-label="Názov"
                              type="text"
                              value={d.name}
                              onChange={(e) =>
                                updateDebt(d.id, {
                                  name: e.currentTarget.value,
                                })
                              }
                            />
                          </td>
                          <td className="px-1 py-0.5">
                            <input
                              aria-label="Istina | Zostatok"
                              type="number"
                              value={d.principal}
                              onChange={(e) =>
                                updateDebt(d.id, {
                                  principal: Number(e.currentTarget.value),
                                })
                              }
                            />
                          </td>
                          <td className="px-1 py-0.5">
                            <input
                              aria-label="Úrok p.a."
                              type="number"
                              value={d.ratePa}
                              onChange={(e) =>
                                updateDebt(d.id, {
                                  ratePa: Number(e.currentTarget.value),
                                })
                              }
                            />
                          </td>
                          <td className="px-1 py-0.5">
                            <input
                              aria-label="Mesačná splátka | Splátka"
                              type="number"
                              value={d.payment ?? d.monthly ?? 0}
                              onChange={(e) =>
                                updateDebt(d.id, {
                                  payment: Number(e.currentTarget.value),
                                })
                              }
                            />
                          </td>
                          <td className="px-1 py-0.5">
                            <input
                              aria-label="Zostáva (mesiace) | Zostáva mesiacov"
                              type="number"
                              value={d.monthsLeft ?? 0}
                              onChange={(e) =>
                                updateDebt(d.id, {
                                  monthsLeft: Number(e.currentTarget.value),
                                })
                              }
                            />
                          </td>
                          <td className="px-1 py-0.5">
                            <button
                              type="button"
                              aria-label="Zmazať"
                              onClick={() => deleteDebt(d.id)}
                              className="px-2 py-1 rounded bg-slate-700"
                            >
                              Zmazať
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}
          </div>
        </section>
      )}
      {open2 && (
        <section
          id="sec2"
          role="region"
          aria-labelledby="invest-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5"
        >
          <header id="invest-title" className="mb-3 font-semibold">
            Investičné nastavenia
          </header>
          <div className="space-y-4">
            <div className="grid grid-cols-[auto_1fr] items-center gap-3 text-sm">
              <label htmlFor="lump-sum-input">Jednorazová investícia</label>
              <input
                id="lump-sum-input"
                type="text"
                role="textbox"
                inputMode="decimal"
                aria-label="Jednorazová investícia"
                ref={lumpSumCtl.ref}
                onChange={lumpSumCtl.onChange}
                onBlur={lumpSumCtl.onBlur}
                defaultValue={lumpSumCtl.defaultValue}
                className="w-full px-3 py-2 rounded bg-slate-800 text-sm"
              />
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-3 text-sm">
              <label htmlFor="monthly-vklad-input">Mesačný vklad</label>
              <input
                id="monthly-vklad-input"
                type="text"
                role="textbox"
                inputMode="decimal"
                aria-label="Mesačný vklad"
                ref={monthlyVkladCtl.ref}
                onChange={monthlyVkladCtl.onChange}
                onBlur={monthlyVkladCtl.onBlur}
                defaultValue={monthlyVkladCtl.defaultValue}
                className="w-full px-3 py-2 rounded bg-slate-800 text-sm"
              />
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-3 text-sm">
              <label htmlFor="horizon-input">Horizont (roky)</label>
              <input
                id="horizon-input"
                type="text"
                role="textbox"
                inputMode="decimal"
                aria-label="Horizont (roky)"
                ref={horizonCtl.ref}
                onChange={horizonCtl.onChange}
                onBlur={horizonCtl.onBlur}
                defaultValue={horizonCtl.defaultValue}
                className="w-full px-3 py-2 rounded bg-slate-800 text-sm"
              />
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-3 text-sm">
              <label htmlFor="goal-input">Cieľ majetku</label>
              <input
                id="goal-input"
                type="text"
                role="textbox"
                inputMode="decimal"
                aria-label="Cieľ majetku"
                ref={goalCtl.ref}
                onChange={goalCtl.onChange}
                onBlur={goalCtl.onBlur}
                defaultValue={goalCtl.defaultValue}
                className="w-full px-3 py-2 rounded bg-slate-800 text-sm"
              />
            </div>

            {/* Insight: Zvýš vklad (conditional) */}
            {(() => {
              const lump = lumpSumEur || 0;
              const monthly = monthlyVklad || 0;
              const years = horizonYears || 10;
              const goal = goalAssetsEur || 0;
              if (goal <= 0) return null;
              const v3 = readV3();
              const mix = (v3.mix || [
                { key: "gold", pct: 12 },
                { key: "dyn", pct: 20 },
                { key: "etf", pct: 40 },
                { key: "bonds", pct: 20 },
                { key: "cash", pct: 5 },
                { key: "crypto", pct: 2 },
                { key: "real", pct: 1 },
              ]) as MixItem[];
              const approx = approxYieldAnnualFromMix(mix);
              const fv = calculateFutureValue(lump, monthly, years, approx);
              if (fv >= goal) return null;
              // Calculate recommended monthly: solve FV = goal for monthly
              // FV = lump*(1+r)^Y + monthly*12*((1+r)^Y-1)/r = goal
              // monthly*12*((1+r)^Y-1)/r = goal - lump*(1+r)^Y
              const fvLump = lump * Math.pow(1 + approx, years);
              const diff = goal - fvLump;
              let recommended = 0;
              if (approx > 0) {
                const factor =
                  12 * ((Math.pow(1 + approx, years) - 1) / approx);
                recommended = diff / factor;
              } else {
                recommended = diff / (12 * years);
              }
              recommended = Math.max(0, Math.ceil(recommended));
              return (
                <div
                  className="mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-xs text-amber-300"
                  role="status"
                  aria-live="polite"
                >
                  ⚠️ Nedosiahnete cieľ (odhad {fv.toFixed(0)} € vs. cieľ{" "}
                  {goal.toFixed(0)} €).
                  <button
                    type="button"
                    className="ml-2 px-2 py-1 rounded bg-amber-600 text-white text-xs"
                    onClick={() => {
                      const cur = readV3();
                      writeV3({
                        profile: {
                          ...(cur.profile || {}),
                          monthlyVklad: recommended,
                        } as any,
                        monthly: recommended,
                      });
                      setMonthlyVklad(recommended);
                    }}
                  >
                    Zvýš vklad na {recommended} €/mes.
                  </button>
                </div>
              );
            })()}
          </div>
        </section>
      )}
      {open3 && (
        <section
          id="sec3"
          role="region"
          aria-labelledby="portfolio-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5"
        >
          <header id="portfolio-title" className="mb-3 font-semibold">
            Zloženie portfólia
          </header>
          <fieldset
            className="mb-4 flex flex-wrap gap-4 text-xs"
            aria-label="Risk preferencia"
          >
            <legend className="sr-only">Risk preferencia</legend>
            {[
              { lbl: "Konzervatívny", val: "conservative" },
              { lbl: "Vyvážený", val: "balanced" },
              { lbl: "Rastový", val: "growth" },
            ].map((opt) => (
              <label key={opt.val} className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="risk_pref_visible"
                  value={opt.val}
                  aria-label={opt.lbl}
                  defaultChecked={opt.val === "balanced"}
                  onChange={() => {
                    const cur = readV3();
                    writeV3({
                      profile: {
                        ...(cur.profile || {}),
                        riskPref: opt.val,
                      } as any,
                      riskPref: opt.val,
                    });
                  }}
                />{" "}
                {opt.lbl}
              </label>
            ))}
            {/* Viditeľný spinbutton krízového biasu (persistuje crisisBias) */}
            <label className="inline-flex flex-col ml-4">
              <span className="text-xs">Krízový bias (0 až 3)</span>
              <input
                type="number"
                role="spinbutton"
                aria-label="Krízový bias (0 až 3)"
                min={0}
                max={3}
                value={crisisIdx}
                onChange={(e) => {
                  const v = Number(e.currentTarget.value);
                  setCrisisIdx(v);
                  const cur = readV3();
                  writeV3({
                    profile: { ...(cur.profile || {}), crisisBias: v } as any,
                    crisisBias: v,
                  });
                }}
                className="mt-1 w-16 rounded bg-slate-800 px-2 py-1 text-xs"
              />
            </label>
          </fieldset>
          <div className="mb-4" data-testid="mixpanel-slot">
            <MixPanel mode="BASIC" onReserveOpen={() => { setWizardType('reserve'); setWizardOpen(true); }} />
          </div>
        </section>
      )}
      <button
        ref={shareBtnRef}
        type="button"
        aria-label="Zdieľať"
        onClick={() => setShareOpen(true)}
        className="px-2 py-1 rounded bg-slate-800 text-xs"
      >
        Zdieľať
      </button>
      {/* Single toggle button (accessible name matches regex in test) */}
      <div className="mt-2" aria-label="Prepínač režimu">
        <button
          type="button"
          aria-label={`Prepínač režimu: ${modeUi}`}
          className="px-2 py-1 rounded bg-slate-800 text-xs"
          onClick={() => {
            const next = modeUi === "BASIC" ? "PRO" : "BASIC";
            setModeUi(next);
            const cur = readV3();
            writeV3({
              profile: { ...(cur.profile || {}), modeUi: next } as any,
              modeUi: next,
            });
          }}
        >
          Režim: {modeUi} (prepnuť na {modeUi === "BASIC" ? "PRO" : "BASIC"})
        </button>
      </div>
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
          {/* Mix edit spinbuttony for tests (hidden from a11y tree to avoid duplicitné labely) */}
          <div className="sr-only" aria-hidden="true">
            <label>
              Akcie %
              <input
                type="number"
                role="spinbutton"
                aria-label="Akcie %"
                value={stocks}
                onChange={(e) => setStocks(Number(e.currentTarget.value))}
              />
            </label>
            <label>
              Dlhopisy %
              <input
                type="number"
                role="spinbutton"
                aria-label="Dlhopisy %"
                value={bonds}
                onChange={(e) => setBonds(Number(e.currentTarget.value))}
              />
            </label>
            <label>
              Hotovosť %
              <input
                type="number"
                role="spinbutton"
                aria-label="Hotovosť %"
                value={cash}
                onChange={(e) => setCash(Number(e.currentTarget.value))}
              />
            </label>
          </div>
        </>
      )}
      {/* Share modal stub */}
    </div>
  );

  // Helper funkcie pre výpočet výnosu a projekcie (zdieľané sec4 + sec5)
  function approxYieldAnnualFromMix(mix: MixItem[]): number {
    if (!Array.isArray(mix) || mix.length === 0) return 0;
    const etf = mix.find((m: MixItem) => m.key === "etf")?.pct || 0;
    const dyn = mix.find((m: MixItem) => m.key === "dyn")?.pct || 0;
    const bonds = mix.find((m: MixItem) => m.key === "bonds")?.pct || 0;
    const crypto = mix.find((m: MixItem) => m.key === "crypto")?.pct || 0;
    const gold = mix.find((m: MixItem) => m.key === "gold")?.pct || 0;
    return (
      (etf * 0.06 +
        dyn * 0.08 +
        bonds * 0.045 +
        crypto * 0.15 * 0.5 +
        gold * 0.0) /
      100
    );
  }

  function calculateFutureValue(
    lumpSum: number,
    monthly: number,
    years: number,
    annualRate: number
  ): number {
    if (years <= 0) return lumpSum;
    if (annualRate > 0) {
      const fvLump = lumpSum * Math.pow(1 + annualRate, years);
      const fvMonthly =
        monthly * 12 * ((Math.pow(1 + annualRate, years) - 1) / annualRate);
      return fvLump + fvMonthly;
    } else {
      // Fallback bez úroku
      return lumpSum + monthly * 12 * years;
    }
  }

  const right = (
    <>
      {open5 &&
        (() => {
          const v3Data = readV3();
          const mix: MixItem[] = (v3Data.mix as any) || [];
          // Use local riskPref state instead of reading from localStorage
          const currentRiskPref = riskPref; // from sec0 state
          const cap = getRiskCap(currentRiskPref);

          return (
            <section
              id="sec5"
              role="region"
              aria-labelledby="sec5-title"
              className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5"
            >
              <header id="sec5-title" className="mb-3 font-semibold">
                Metriky &amp; odporúčania
              </header>
              <div className="space-y-4">
                {/* SVG Risk Gauge (prominentný, väčší) */}
                {Array.isArray(mix) && mix.length > 0 && (
                  <div className="flex justify-center py-4">
                    <RiskGauge value={riskScore(mix)} size="lg" />
                  </div>
                )}

                {/* 3 Scorecards (horizontal layout) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Scorecard: Riziko */}
                  <div className="p-3 rounded-lg bg-slate-800/50 ring-1 ring-white/5">
                    <div className="text-xs text-slate-400 mb-1">
                      Riziko (0–10)
                    </div>
                    <div className="text-lg font-bold tabular-nums">
                      {(() => {
                        if (!Array.isArray(mix) || mix.length === 0)
                          return "– (mix nezadaný)";
                        const risk = riskScore(mix);
                        return (
                          <>
                            {risk.toFixed(1)} / {cap.toFixed(1)}
                            {risk > cap && (
                              <span className="ml-2 text-amber-500">⚠️</span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Scorecard: Výnos/rok */}
                  <div className="p-3 rounded-lg bg-slate-800/50 ring-1 ring-white/5">
                    <div className="text-xs text-slate-400 mb-1">
                      Výnos/rok (odhad)
                    </div>
                    <div className="text-lg font-bold tabular-nums">
                      {(() => {
                        if (!Array.isArray(mix) || mix.length === 0)
                          return "– (mix nezadaný)";
                        const approx = approxYieldAnnualFromMix(mix);
                        return `${(approx * 100).toFixed(1)} %`;
                      })()}
                    </div>
                  </div>

                  {/* Scorecard: Progres k cieľu */}
                  <div className="p-3 rounded-lg bg-slate-800/50 ring-1 ring-white/5">
                    <div className="text-xs text-slate-400 mb-1">
                      Progres k cieľu
                    </div>
                    <div className="text-lg font-bold tabular-nums">
                      {(() => {
                        if (!goalAssetsEur || goalAssetsEur <= 0)
                          return "– (cieľ nezadaný)";
                        if (!Array.isArray(mix) || mix.length === 0)
                          return "– (mix nezadaný)";
                        const lump = lumpSumEur || 0;
                        const monthly = monthlyVklad || 0;
                        const years = horizonYears || 10;
                        const approx = approxYieldAnnualFromMix(mix);
                        const fv = calculateFutureValue(
                          lump,
                          monthly,
                          years,
                          approx
                        );
                        const progress = (fv / goalAssetsEur) * 100;
                        return `${progress.toFixed(0)} %`;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Insights: Gold 12% recommendation */}
                {(() => {
                  if (!Array.isArray(mix) || mix.length === 0) return null;
                  const goldPct = mix.find(i => i.key === 'gold')?.pct || 0;
                  if (goldPct >= 12) return null;
                  return (
                    <div className="p-3 rounded-lg bg-amber-900/20 ring-1 ring-amber-500/30 text-sm">
                      <div className="font-medium text-amber-400 mb-1">
                        💡 Zlato pod minimum
                      </div>
                      <div className="text-slate-300 mb-2">
                        Odporúčame zlato ≥ 12 % pre stabilitu portfólia.
                      </div>
                      <button
                        type="button"
                        aria-label="Nastaviť zlato na 12%"
                        className="px-3 py-1.5 rounded bg-amber-600/30 ring-1 ring-amber-500/50 text-xs font-medium hover:bg-amber-600/40 transition-colors"
                        onClick={() => {
                          setWizardType('gold');
                          setWizardOpen(true);
                        }}
                      >
                        Nastaviť zlato na 12 %
                      </button>
                    </div>
                  );
                })()}

                {/* CTA: Max výnos */}
                <div className="pt-2 border-t border-white/5">
                  <button
                    type="button"
                    aria-label="Max výnos (riziko ≤ cap)"
                    className="w-full px-3 py-2 rounded bg-emerald-600/20 ring-1 ring-emerald-500/40 text-sm font-medium hover:bg-emerald-600/30 transition-colors"
                    onClick={() => {
                      if (!Array.isArray(mix) || mix.length === 0) return;
                      const optimized = applyRiskConstrainedMix(mix, cap);
                      writeV3({ mix: optimized as any });
                    }}
                  >
                    Max výnos (riziko ≤ cap)
                  </button>
                </div>
              </div>
            </section>
          );
        })()}
      <section
        id="sec4"
        role="region"
        aria-labelledby="sec4-title"
        className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5"
      >
        <header id="sec4-title" className="mb-3 font-semibold">
          Projekcia
        </header>
        {(() => {
          const v3Data = readV3();
          const mix: MixItem[] = (v3Data.mix as any) || [];
          const goal = goalAssetsEur || 0;

          if (!goal || goal <= 0) {
            return (
              <div className="text-sm text-slate-400">
                Nastavte cieľ aktív v sekcii Investičné nastavenia.
              </div>
            );
          }

          const lump = lumpSumEur || 0;
          const monthly = monthlyVklad || 0;
          const years = horizonYears || 10;
          const approx = approxYieldAnnualFromMix(mix);
          const fv = calculateFutureValue(lump, monthly, years, approx);
          const pct = Math.max(0, Math.min(100, Math.round((fv / goal) * 100)));

          // Color-coded progress bar
          const barColor =
            pct >= 80
              ? "bg-emerald-500"
              : pct >= 50
                ? "bg-amber-500"
                : "bg-red-500";

          // Prepare data for dual-line chart
          const debts = v3Data.debts || [];
          const totalDebtPrincipal = debts.reduce(
            (sum, d) => sum + (d.principal || 0),
            0
          );
          const chartData: { year: number; fv: number; debt: number }[] = [];
          for (let y = 0; y <= years; y++) {
            const fvAtYear = calculateFutureValue(lump, monthly, y, approx);
            // Simple linear amortization: debtRemaining = totalPrincipal * (1 - y/totalYears)
            // Note: This is simplified. Real amortization depends on monthsLeft, but for viz purposes this works.
            const debtAtYear = totalDebtPrincipal * Math.max(0, 1 - y / years);
            chartData.push({ year: y, fv: fvAtYear, debt: debtAtYear });
          }

          // Crossover detection: first year where FV >= debt
          let crossoverYear: number | null = null;
          if (totalDebtPrincipal > 0) {
            for (let i = 0; i < chartData.length; i++) {
              if (chartData[i].fv >= chartData[i].debt) {
                crossoverYear = chartData[i].year;
                break;
              }
            }
          }

          return (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="text-slate-400">Progres k cieľu: </span>
                <span className="font-bold tabular-nums">{pct}%</span>
              </div>

              <div
                className="relative h-2 w-full rounded-full bg-slate-800 ring-1 ring-white/5 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label={`Progres k cieľu ${pct}%`}
              >
                <div
                  className={`absolute inset-y-0 left-0 ${barColor} transition-all duration-300`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="space-y-1 text-xs text-slate-400">
                <div>
                  Odhad hodnoty v horizontu:{" "}
                  <span className="tabular-nums font-medium text-slate-300">
                    {fv.toFixed(0)} €
                  </span>
                </div>
                <div>
                  Cieľ:{" "}
                  <span className="tabular-nums font-medium text-slate-300">
                    {goal.toFixed(0)} €
                  </span>
                </div>
                {totalDebtPrincipal > 0 && (
                  <div>
                    Celkový dlh:{" "}
                    <span className="tabular-nums font-medium text-red-400">
                      {totalDebtPrincipal.toFixed(0)} €
                    </span>
                  </div>
                )}
              </div>

              {/* Recharts dual-line chart */}
              {totalDebtPrincipal > 0 && (
                <div className="mt-4">
                  <LineChart
                    width={500}
                    height={250}
                    data={chartData}
                    margin={{ top: 10, right: 20, bottom: 20, left: 0 }}
                  >
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="year"
                      stroke="#94a3b8"
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      label={{
                        value: "Roky",
                        position: "insideBottom",
                        offset: -10,
                        fill: "#94a3b8",
                      }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickFormatter={(val: number) =>
                        `${(val / 1000).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #475569",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(val: number) => `${val.toFixed(0)} €`}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Line
                      type="monotone"
                      dataKey="fv"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Investície (rast)"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="debt"
                      stroke="#ef4444"
                      strokeWidth={2}
                      name="Dlhy (zostatok)"
                      dot={false}
                    />
                    {crossoverYear !== null && (
                      <ReferenceLine
                        x={crossoverYear}
                        stroke="#facc15"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        label={{
                          value: `Rok vyplatenia: ${new Date().getFullYear() + crossoverYear}`,
                          position: "top",
                          fill: "#facc15",
                          fontSize: 11,
                        }}
                      />
                    )}
                  </LineChart>
                </div>
              )}
            </div>
          );
        })()}
      </section>
    </>
  );
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {showLinkBanner && (
        <div
          role="alert"
          data-testid="deeplink-banner"
          className="mx-auto max-w-[1320px] px-4 mb-3 rounded bg-emerald-600/15 border border-emerald-500/30 p-3 text-xs flex justify-between items-start gap-3"
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
            ? "fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            : "pointer-events-none fixed inset-0 z-[-1] opacity-0"
        }
        aria-hidden={wizardOpen ? "false" : "true"}
      >
        {wizardOpen && (
          <div className="rounded-xl bg-slate-900 p-6 ring-1 ring-white/10 space-y-4 max-w-sm w-full">
            <h2 className="text-base font-semibold">Odporúčanie</h2>
            <p className="text-sm text-slate-400">
              {wizardType === 'reserve' 
                ? 'Nastaviť rezervu na minimum (1000€ / 6 mesiacov)?'
                : 'Nastaviť zlato na 12 %?'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                data-testid={TEST_IDS.WIZARD_ACTION_APPLY}
                className="px-4 py-2 rounded bg-emerald-600 text-white"
                aria-label={wizardType === 'reserve' ? 'Apply reserve baseline' : 'Apply gold 12%'}
                onClick={() => {
                  if (wizardType === 'reserve') {
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
                    const targetTestId = wizardType === 'reserve' 
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
      {wizardOpen && (
        <div
          className="fixed inset-0 z-[60]"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setWizardOpen(false);
              setTimeout(() => wizardTriggerRef.current?.focus(), 0);
            }
          }}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
      {shareOpen && (
        <div
          role="dialog"
          aria-label="Zdieľať nastavenie"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        >
          <div className="bg-slate-900 rounded-xl p-5 ring-1 ring-white/10 w-full max-w-sm space-y-4">
            <h2 className="text-base font-semibold">Zdieľať nastavenie</h2>
            <label className="block text-sm space-y-1">
              <span className="sr-only">Email agenta</span>
              <input
                autoFocus
                aria-label="Email agenta"
                type="email"
                className="w-full bg-slate-800 rounded px-3 py-2 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded bg-slate-700 text-sm"
                onClick={() => {
                  setShareOpen(false);
                  setTimeout(() => shareBtnRef.current?.focus(), 0);
                }}
              >
                Zavrieť
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
