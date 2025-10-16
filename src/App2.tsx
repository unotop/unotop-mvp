import { useEffect, useMemo, useState, useDeferredValue } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { DEFAULT_MIX, getAssetsByScenario } from "./domain/assets";
import { computeRisk } from "./domain/risk";
import { computeRecommendedMix } from "./domain/recommendation";
import { findBestPortfolio } from "./domain/optimizer";
// import { fvMonthly } from "./domain/finance"; // not used directly now
import { euro, pctFmt, clamp } from "./utils/number";
import { RiskGauge } from "./components/RiskGauge";
import { MixField } from "./components/inputs/MixField";
import { SmallField } from "./components/inputs/SmallField";
import { SectionHeader } from "./components/SectionHeader";
import "./global.css";

// --- Helpers ---
function formatShort(n: number): string {
  if (Math.abs(n) < 1000) return euro(n).replace("€", "");
  const units = ["k", "M", "B"];
  let u = -1;
  let v = n;
  while (Math.abs(v) >= 1000 && u < units.length - 1) {
    v /= 1000;
    u++;
  }
  return `${v.toFixed(1)}${units[u]}`;
}

type Mix = Record<string, number>;
interface Solution {
  weights: Mix;
  expectedReturn: number;
  risk: number;
  score: number;
}
const LS_KEY = "unotop:v1";

export default function App() {
  // --- State ---
  const [mix, setMix] = useState<Mix>(DEFAULT_MIX);
  const [scenario] = useState<"base" | "conservative">("base");
  const assets = useMemo(() => getAssetsByScenario(scenario), [scenario]);
  const [income, setIncome] = useState(200);
  const [reserve, setReserve] = useState(3000);
  const [targetReserve, setTargetReserve] = useState(6000);
  const [horizon, setHorizon] = useState(7);
  const [goal, setGoal] = useState(60000);
  const [target, setTarget] = useState(90000);
  const [showGraph, setShowGraph] = useState(false); // default OFF per spec
  const [densityMode, setDensityMode] = useState<"normal" | "ultra">("normal");
  // miniGauge removed – single main gauge kept only in Section 4
  const [showRec, setShowRec] = useState(true);
  const [recMix, setRecMix] = useState<Mix | null>(null);
  const [solutions, setSolutions] = useState<Solution[] | null>(null);
  const [selectedSolution, setSelectedSolution] = useState<number | null>(null);
  const [strategyMode, setStrategyMode] = useState<"score" | "maxReturn">(
    "score"
  );
  const [sec1Open, setSec1Open] = useState(true);
  const [sec2Open, setSec2Open] = useState(true);
  const [sec3Open, setSec3Open] = useState(true);
  const [sec4Open, setSec4Open] = useState(false);
  // Modal state for recommended notes full view
  const [notesOpen, setNotesOpen] = useState(false);
  // Toast system
  interface Toast {
    id: number;
    msg: string;
  }
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = (msg: string) => {
    setToasts((t) => {
      const id = (t.at(-1)?.id || 0) + 1;
      return [...t, { id, msg }];
    });
  };
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        setToasts((all) => all.filter((t) => t.id !== toast.id));
      }, 2500)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  // --- Load ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw) as any;
        if (d.mix) setMix(d.mix as Mix);
        if (typeof d.income === "number") setIncome(d.income);
        if (typeof d.reserve === "number") setReserve(d.reserve);
        if (typeof d.targetReserve === "number")
          setTargetReserve(d.targetReserve);
        if (typeof d.horizon === "number") setHorizon(d.horizon);
        if (typeof d.goal === "number") setGoal(d.goal);
        if (typeof d.target === "number") setTarget(d.target);
        if (typeof d.showGraph === "boolean") setShowGraph(d.showGraph);
        if (d.densityMode === "ultra") setDensityMode("ultra");
        // ignore legacy d.miniGauge (feature removed)
        if (d.strategyMode === "score" || d.strategyMode === "maxReturn")
          setStrategyMode(d.strategyMode);
        if (typeof d.sec1Open === "boolean") setSec1Open(d.sec1Open);
        if (typeof d.sec2Open === "boolean") setSec2Open(d.sec2Open);
        if (typeof d.sec3Open === "boolean") setSec3Open(d.sec3Open);
        if (typeof d.sec4Open === "boolean") setSec4Open(d.sec4Open);
      }
    } catch {}
  }, []);

  // --- Persist ---
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          mix,
          income,
          reserve,
          targetReserve,
          horizon,
          goal,
          target,
          showGraph,
          densityMode,
          strategyMode,
          sec1Open,
          sec2Open,
          sec3Open,
          sec4Open,
        })
      );
    }, 300);
    return () => clearTimeout(t);
  }, [
    mix,
    income,
    reserve,
    targetReserve,
    horizon,
    goal,
    target,
    showGraph,
    densityMode,
    strategyMode,
    sec1Open,
    sec2Open,
    sec3Open,
    sec4Open,
  ]);

  // --- Derived ---
  const normMix = useMemo(() => {
    const total = Object.values(mix).reduce((a, b) => a + b, 0) || 1;
    const o: Mix = {};
    Object.keys(mix).forEach((k) => (o[k] = +(mix[k] / total).toFixed(4)));
    return o;
  }, [mix]);
  const mixTotal = useMemo(
    () => Math.round(Object.values(mix).reduce((a, b) => a + b, 0)),
    [mix]
  );
  function normalizeMix() {
    const total = Object.values(mix).reduce((a, b) => a + b, 0) || 1;
    setMix((m) => {
      const n: Mix = {};
      Object.keys(m).forEach(
        (k) => (n[k] = +((m[k] / total) * 100).toFixed(1))
      );
      return n;
    });
  }
  // Pure normalization helper (avoids setMix race when we already have a candidate mix)
  function normalizeMixObject(m: Mix): Mix {
    const total = Object.values(m).reduce((a, b) => a + b, 0) || 1;
    const n: Mix = {};
    Object.keys(m).forEach((k) => (n[k] = +((m[k] / total) * 100).toFixed(1)));
    return n;
  }

  const riskModel = useMemo(
    () => computeRisk(normMix, assets),
    [normMix, assets]
  );
  const expectedReturn = useMemo(() => {
    let er = 0;
    Object.entries(normMix).forEach(([k, w]) => {
      const a = assets[k];
      if (a) er += w * a.expReturn;
    });
    return er;
  }, [normMix, assets]);

  const goldPct = normMix["Zlato (fyzické)"] || 0;
  const dynPct = normMix["Dynamické riadenie"] || 0;
  const cryptoPct = normMix["Krypto (BTC/ETH)"] || 0;
  const cashPct = normMix["Hotovosť/rezerva"] || 0;
  const concentrationAsset = Object.values(normMix).some((v) => v > 0.5);
  const riskExceeded = riskModel.raw > 7.5;
  const cashExceeded = cashPct > 0.35;
  const highConcentration = concentrationAsset;
  const missingReserve = Math.max(0, targetReserve - reserve);
  const riskHardBlock = riskModel.raw > 9.5;
  const constraintFlags = {
    goldLow: goldPct < 0.1,
    dynHigh: dynPct > 0.3,
    cryptoHigh: cryptoPct > 0.25,
    cashHigh: cashExceeded,
    concentration: highConcentration,
    riskHigh: riskExceeded,
  };

  useEffect(() => {
    if (!showRec) return;
    try {
      const r = computeRecommendedMix({
        years: horizon,
        income: income * 12,
        monthlyInvest: income,
        oneTime: 0,
        missingReserve,
        reUnlocked: true,
        assetsKeys: Object.keys(assets),
      });
      setRecMix(r);
    } catch {}
  }, [horizon, income, missingReserve, assets, showRec]);

  // removed obsolete runOptimizer (replaced by runOptimization)

  const projectionSeries = useMemo(() => {
    const months = horizon * 12;
    const series: { month: number; value: number }[] = [];
    let acc = reserve;
    for (let m = 0; m <= months; m++) {
      const monthlyRate = expectedReturn / 12;
      acc = acc * (1 + monthlyRate) + income;
      series.push({ month: m, value: acc });
    }
    return series;
  }, [horizon, income, reserve, expectedReturn]);
  const fv = projectionSeries.at(-1)?.value || 0;
  const goalProgress = goal > 0 ? fv / goal : 0;
  const years = horizon;
  const deferredMix = useDeferredValue(mix);
  // Pulse hooks for KPI changes
  function usePulse<T>(val: T, duration = 600) {
    const [pulse, setPulse] = useState(false);
    const prevRef = (window as any)[`__prev_${Math.random()}`];
    const prev = prevRef?.current;
    const ref = useState({ current: val })[0];
    if (ref.current !== val) {
      ref.current = val;
    }
    useEffect(() => {
      if (prev !== undefined && prev !== val) {
        setPulse(true);
        const t = setTimeout(() => setPulse(false), duration);
        return () => clearTimeout(t);
      }
    }, [val]);
    return pulse;
  }
  const pulseReturn = usePulse(expectedReturn);
  const pulseFV = usePulse(fv);
  const pulseGoal = usePulse(goalProgress);
  const pulseRisk = usePulse(riskModel.raw);
  const showDock = true; // future toggle placeholder

  // Helpers for recommendation equality
  function isSameMix(a: Mix | null, b: Mix): boolean {
    if (!a) return false;
    return Object.keys(b).every(
      (k) => Math.abs(((a as any)[k] || 0) - (b as any)[k]) < 0.01
    );
  }

  // Optimization runner respecting strategy
  function runOptimization(openSection = true) {
    try {
      const sols = findBestPortfolio(assets, { maxSolutions: 12 }) || [];
      let processed = [...sols];
      if (strategyMode === "maxReturn") {
        const filtered = processed.filter((s) => s.risk <= 7.5);
        processed = (filtered.length ? filtered : processed).sort(
          (a, b) => b.expectedReturn - a.expectedReturn
        );
      } else {
        processed.sort((a, b) => b.score - a.score);
      }
      setSolutions(processed);
      setSelectedSolution(null);
      if (openSection) setSec4Open(true);
    } catch {}
  }

  // Visual pulse state for recently applied recommended mix (map of asset -> timestamp)
  const [recentApplied, setRecentApplied] = useState<Record<string, number>>(
    {}
  );

  function applyRecommended() {
    try {
      const r = computeRecommendedMix({
        years: horizon,
        income: income * 12,
        monthlyInvest: income,
        oneTime: 0,
        missingReserve,
        reUnlocked: true,
        assetsKeys: Object.keys(assets),
      }) as Mix;
      setRecMix(r);
      setShowRec(true);
      const normalized = normalizeMixObject(r);
      setMix(normalized);
      // mark pulse
      const stamp = Date.now();
      const pulse: Record<string, number> = {};
      Object.keys(normalized).forEach((k) => (pulse[k] = stamp));
      setRecentApplied(pulse);
      pushToast("Aplikované odporúčané nastavenie");
    } catch {}
  }

  function applySelected() {
    if (selectedSolution == null || !solutions) return;
    const sol = solutions[selectedSolution];
    if (!sol) return;
    setMix(sol.weights);
    normalizeMix();
    pushToast("Mix aplikovaný");
  }

  return (
    <div
      className={`w-full min-w-0 min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden ${
        densityMode === "ultra" ? "text-[13px]" : ""
      }`}
      data-density={densityMode}
    >
      {/* Toolbar */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 px-3 h-10 bg-slate-950/80 supports-[backdrop-filter]:bg-slate-950/60 backdrop-blur border-b border-slate-800">
        <div className="flex items-center gap-2 select-none min-w-0">
          <img
            src="/assets/unotop-logo.svg"
            alt="UNOTOP"
            className="h-6 md:h-7 w-auto"
          />
          <h1 className="font-semibold tracking-wide text-sm whitespace-nowrap">
            UNOTOP Planner
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] justify-end">
            <button
              role="button"
              aria-pressed={showGraph}
              onClick={() => setShowGraph((v) => !v)}
              className={`px-2 py-1 rounded border text-xs transition-colors ${
                showGraph
                  ? "bg-indigo-600/30 border-indigo-400/50 text-indigo-200"
                  : "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Graf
            </button>
            <button
              role="button"
              aria-pressed={densityMode === "ultra"}
              onClick={() =>
                setDensityMode((m) => (m === "ultra" ? "normal" : "ultra"))
              }
              className={`px-2 py-1 rounded border text-xs transition-colors ${
                densityMode === "ultra"
                  ? "bg-emerald-600/30 border-emerald-400/50 text-emerald-200"
                  : "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Ultra
            </button>
            {/* Mini gauge toggle removed */}
            <button
              onClick={() => runOptimization(true)}
              className="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[11px]"
            >
              Optimalizuj
            </button>
            {constraintFlags.goldLow && (
              <span className="px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-300 border border-amber-500/40 whitespace-nowrap truncate max-w-[92px]">
                zlato &lt;10%
              </span>
            )}
            {constraintFlags.dynHigh && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 whitespace-nowrap truncate max-w-[92px]">
                dyn &gt;30%
              </span>
            )}
            {constraintFlags.cryptoHigh && (
              <span className="px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-300 border border-purple-500/40 whitespace-nowrap truncate max-w-[100px]">
                krypto &gt;25%
              </span>
            )}
            {constraintFlags.cashHigh && (
              <span className="px-1.5 py-0.5 rounded bg-sky-600/20 text-sky-300 border border-sky-500/40 whitespace-nowrap truncate max-w-[100px]">
                cash &gt;35%
              </span>
            )}
            {constraintFlags.riskHigh && (
              <span className="px-1.5 py-0.5 rounded bg-rose-600/20 text-rose-300 border border-rose-500/40 whitespace-nowrap truncate max-w-[110px]">
                riziko &gt;7.5
              </span>
            )}
            {constraintFlags.concentration && (
              <span className="px-1.5 py-0.5 rounded bg-fuchsia-600/20 text-fuchsia-300 border border-fuchsia-500/40 whitespace-nowrap truncate max-w-[120px]">
                koncentrácia
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main LR grid */}
      <div className="px-3">
        <div
          className={`mx-auto w-full max-w-[1680px] ${
            showDock ? "pb-12" : "pb-4"
          } grid gap-4 items-start grid-cols-12`}
        >
          {/* Left column */}
          <div className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col gap-3 min-w-[380px]">
            {/* Section 1: Inputs */}
            <section
              className={`rounded-xl border border-slate-800 bg-slate-950/60 ${
                densityMode === "ultra" ? "pt-1" : ""
              }`}
            >
              <SectionHeader
                title="1) Vstupy"
                open={sec1Open}
                onToggle={() => setSec1Open((o) => !o)}
                id="sec1"
              />
              <div
                className="overflow-hidden grid transition-[grid-template-rows] duration-300"
                style={{ gridTemplateRows: sec1Open ? "1fr" : "0fr" }}
              >
                <div
                  className={`min-h-0 ${
                    densityMode === "ultra" ? "p-2 space-y-2" : "p-3 space-y-3"
                  } pt-0`}
                >
                  <div
                    className="grid gap-2 text-[11px]"
                    style={{
                      gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                    }}
                  >
                    <SmallField
                      label="Mesačný vklad"
                      value={income}
                      setValue={setIncome}
                      min={0}
                      max={5000}
                      step={50}
                      prefix="€"
                    />
                    <SmallField
                      label="Rezerva"
                      value={reserve}
                      setValue={setReserve}
                      min={0}
                      max={50000}
                      step={500}
                      prefix="€"
                    />
                    <SmallField
                      label="Cieľ rezerva"
                      value={targetReserve}
                      setValue={setTargetReserve}
                      min={0}
                      max={50000}
                      step={500}
                      prefix="€"
                    />
                    <SmallField
                      label="Horizont (roky)"
                      value={horizon}
                      setValue={setHorizon}
                      min={1}
                      max={40}
                      step={1}
                      prefix="r"
                    />
                    <SmallField
                      label="Cieľ"
                      value={goal}
                      setValue={setGoal}
                      min={0}
                      max={500000}
                      step={1000}
                      prefix="€"
                    />
                    <SmallField
                      label="Cieľ portfólia"
                      value={target}
                      setValue={setTarget}
                      min={0}
                      max={1000000}
                      step={1000}
                      prefix="€"
                    />
                  </div>
                  {missingReserve > 0 && (
                    <div className="text-[11px] text-amber-400">
                      Chýba rezerva {euro(missingReserve)}.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Section 2: Zloženie */}
            <section
              className={`rounded-xl border border-slate-800 bg-slate-950/60 ${
                densityMode === "ultra" ? "pt-1" : ""
              }`}
            >
              <SectionHeader
                title="2) Zloženie"
                open={sec2Open}
                onToggle={() => setSec2Open((o) => !o)}
                id="sec2"
              />
              <div
                className="overflow-hidden grid transition-[grid-template-rows] duration-300"
                style={{ gridTemplateRows: sec2Open ? "1fr" : "0fr" }}
              >
                <div
                  className={`min-h-0 ${
                    densityMode === "ultra" ? "p-2 space-y-2" : "p-3 space-y-3"
                  } pt-0`}
                >
                  <div className="flex flex-wrap gap-2 text-[11px] items-center">
                    <div>
                      Súčet:{" "}
                      <span
                        className={
                          mixTotal === 100
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }
                      >
                        {mixTotal}%
                      </span>
                    </div>
                    <button
                      onClick={normalizeMix}
                      disabled={mixTotal === 100}
                      className="px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs disabled:opacity-40"
                    >
                      Dorovnať
                    </button>
                    <button
                      onClick={applyRecommended}
                      disabled={isSameMix(recMix, mix)}
                      className={`relative px-2 py-1 rounded border text-xs transition-colors disabled:opacity-50 ${
                        isSameMix(recMix, mix)
                          ? "border-emerald-600 bg-emerald-600/20 text-emerald-300"
                          : "border-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      Odporúčané nastavenie
                      {isSameMix(recMix, mix) && (
                        <span className="ml-1 inline-block text-[10px] px-1 py-0.5 rounded bg-emerald-600/30 border border-emerald-400/40 text-emerald-200 align-middle">
                          ✓ Aplikované
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                    {Object.keys(mix).map((k) => {
                      const val = normMix[k] || 0;
                      let highlight = false;
                      if (k.startsWith("Zlato") && constraintFlags.goldLow)
                        highlight = true;
                      if (k.startsWith("Dynamické") && constraintFlags.dynHigh)
                        highlight = true;
                      if (k.startsWith("Krypto") && constraintFlags.cryptoHigh)
                        highlight = true;
                      if (k.startsWith("Hotovosť") && constraintFlags.cashHigh)
                        highlight = true;
                      if (val > 0.5 && constraintFlags.concentration)
                        highlight = true;
                      return (
                        <div
                          key={k}
                          className={
                            highlight
                              ? "ring-1 ring-amber-400/60 rounded-lg p-1 -m-1 transition-shadow"
                              : ""
                          }
                        >
                          <MixField
                            label={k}
                            value={mix[k]}
                            setValue={(v: number) =>
                              setMix((m) => ({ ...m, [k]: clamp(v, 0, 100) }))
                            }
                            reUnlocked={true}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {showRec && recMix && (
                    <div className="mt-2 rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          Odporúčaný mix (náhľad)
                        </div>
                        <button
                          onClick={() => setShowRec(false)}
                          className="text-[10px] px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700"
                        >
                          Skryť náhľad
                        </button>
                      </div>
                      <ul className="text-xs space-y-1 max-h-40 overflow-auto pr-1">
                        {Object.keys(recMix).map((k) => (
                          <li
                            key={k}
                            className={`flex justify-between transition-colors ${
                              Date.now() - (recentApplied[k] || 0) < 1200
                                ? "text-emerald-300"
                                : ""
                            }`}
                          >
                            <span>{k}</span>
                            <span className="text-slate-400">{recMix[k]}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!showRec && recMix && (
                    <button
                      onClick={() => setShowRec(true)}
                      className="mt-2 text-[10px] underline text-slate-400 hover:text-slate-200"
                    >
                      Zobraziť náhľad
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
          {/* Right column */}
          <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col gap-2.5 min-w-[260px]">
            {/* Quick stats (compact) */}
            <div
              className={`rounded border border-slate-700 bg-slate-900/60 ${
                densityMode === "ultra" ? "px-2.5 py-2" : "px-3 py-2.5"
              } text-[11px] text-slate-300 min-w-[260px] font-mono select-none`}
            >
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 leading-tight tracking-tight">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-sans">Oč. výnos</span>
                  <span className="text-slate-100 font-medium">
                    {pctFmt(expectedReturn, 2)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-sans">Plnenie</span>
                  <span className="text-slate-100 font-medium">
                    {(goalProgress * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-sans">FV</span>
                  <span className="text-slate-100 font-medium">{euro(fv)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-sans">Riziko</span>
                  <span className="text-slate-100 font-medium">
                    {riskModel.raw.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            {/* Subtle divider before Section 3 */}
            <div className="h-px bg-slate-800/70 -mx-1 mt-1 mb-1" />
            {riskHardBlock && (
              <div className="rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 p-3 text-xs">
                Max riziko prekročené – uprav mix.
              </div>
            )}
            {showRec && recMix && (
              <div
                className={`rounded border border-slate-700 bg-slate-900/60 ${
                  densityMode === "ultra" ? "p-2.5" : "p-3"
                } space-y-1 text-xs`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-200">
                    Odporúčané poznámky
                  </div>
                  <button
                    onClick={() => setNotesOpen(true)}
                    className="text-[10px] underline text-slate-400 hover:text-slate-200"
                    aria-haspopup="dialog"
                    aria-expanded={notesOpen}
                  >
                    Zobraziť viac
                  </button>
                </div>
                <ul className="list-disc list-inside text-slate-300 space-y-0 line-clamp-2 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
                  <li>Mix prispôsobený horizontu a rezerve.</li>
                  <li>Uprav ETF / dlhopis podľa komfortu rizika.</li>
                  <li>Diverzifikácia znižuje koncentráciu rizika.</li>
                  <li>Priebežne rebalansuj pre zachovanie cieľových váh.</li>
                </ul>
              </div>
            )}
            {/* Collapsible Section 3 */}
            <section
              className={`rounded-xl border border-slate-800 bg-slate-950/60 ${
                densityMode === "ultra" ? "pt-1" : ""
              }`}
            >
              <SectionHeader
                title="3) Projekcia"
                open={sec3Open}
                onToggle={() => setSec3Open((o) => !o)}
                id="sec3"
              />
              <div
                className="overflow-hidden transition-[grid-template-rows] duration-300 ease-out grid"
                style={{ gridTemplateRows: sec3Open ? "1fr" : "0fr" }}
              >
                {sec3Open && (
                  <div
                    className={`min-h-0 ${
                      densityMode === "ultra"
                        ? "p-2 space-y-2"
                        : "p-3 space-y-3"
                    } pt-0`}
                  >
                    <div className="space-y-2 text-sm">
                      <div>
                        Odhadovaný majetok:{" "}
                        <span className="font-semibold text-slate-100">
                          {euro(fv)}
                        </span>
                      </div>
                      <div>
                        Plnenie cieľa: {(goalProgress * 100).toFixed(1)}%
                      </div>
                      <div className="h-2 rounded bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500/70"
                          style={{
                            width: `${Math.min(100, goalProgress * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    {showGraph && (
                      <div className="mt-2">
                        {projectionSeries.length > 1 ? (
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={projectionSeries}
                                margin={{
                                  top: 10,
                                  right: 20,
                                  left: 0,
                                  bottom: 0,
                                }}
                              >
                                <XAxis
                                  dataKey="month"
                                  tickFormatter={(v) =>
                                    v % 12 === 0 ? `${v / 12}` : ""
                                  }
                                  interval={0}
                                  ticks={projectionSeries
                                    .filter((p) => p.month % 12 === 0)
                                    .map((p) => p.month)}
                                  stroke="#64748b"
                                  style={{ fontSize: 10 }}
                                />
                                <YAxis
                                  tickFormatter={(v) =>
                                    formatShort(v as number)
                                  }
                                  stroke="#64748b"
                                  style={{ fontSize: 10 }}
                                />
                                <Tooltip
                                  contentStyle={{
                                    background: "#0f172a",
                                    border: "1px solid #334155",
                                    fontSize: 12,
                                  }}
                                  formatter={(val) => [
                                    euro(val as number),
                                    "Hodnota",
                                  ]}
                                  labelFormatter={(label) => {
                                    const m = Number(label);
                                    const yr = Math.floor(m / 12);
                                    const mo = m % 12;
                                    return `Mesiac ${m} (Rok ${yr}, mesiac ${mo})`;
                                  }}
                                />
                                {target > 0 && (
                                  <ReferenceLine
                                    y={target}
                                    stroke="#10b981"
                                    strokeDasharray="4 4"
                                    label={{
                                      value: "Cieľ",
                                      position: "right",
                                      fill: "#10b981",
                                      fontSize: 10,
                                    }}
                                  />
                                )}
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  stroke="#6366f1"
                                  strokeWidth={2}
                                  dot={false}
                                  isAnimationActive
                                />
                              </LineChart>
                            </ResponsiveContainer>
                            <div className="mt-1 text-[10px] text-slate-500 flex justify-between">
                              <span>
                                Osa X: roky (0..{years}) – Osa Y: rast majetku
                              </span>
                              <span>{projectionSeries.length} bodov</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">
                            Nedostatočné dáta na graf.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
            {/* Collapsible Section 4 */}
            <section
              className={`rounded-xl border border-slate-800 bg-slate-950/60 ${
                densityMode === "ultra" ? "pt-1" : ""
              }`}
            >
              <SectionHeader
                title="4) Metriky & odporúčania"
                open={sec4Open}
                onToggle={() => setSec4Open((o) => !o)}
                id="sec4"
              />
              <div
                className="overflow-hidden transition-[grid-template-rows] duration-300 ease-out grid"
                style={{ gridTemplateRows: sec4Open ? "1fr" : "0fr" }}
              >
                {sec4Open && (
                  <div
                    className={`min-h-0 ${
                      densityMode === "ultra"
                        ? "p-2 space-y-2"
                        : "p-3 space-y-3"
                    } pt-0`}
                  >
                    {/* Strategy toggle */}
                    <div className="flex flex-wrap gap-2 items-center -mt-1">
                      <div className="text-[11px] text-slate-400 mr-2">
                        Stratégia:
                      </div>
                      <button
                        onClick={() => {
                          setStrategyMode("score");
                          runOptimization(false);
                        }}
                        className={`px-2 py-1 rounded border text-[11px] ${
                          strategyMode === "score"
                            ? "bg-indigo-600/30 border-indigo-400/50 text-indigo-200"
                            : "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        Max skóre (výnos / riziko)
                      </button>
                      <button
                        onClick={() => {
                          setStrategyMode("maxReturn");
                          runOptimization(false);
                        }}
                        className={`px-2 py-1 rounded border text-[11px] ${
                          strategyMode === "maxReturn"
                            ? "bg-indigo-600/30 border-indigo-400/50 text-indigo-200"
                            : "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        Max výnos (riziko ≤ 7,5)
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-6 items-center">
                      <div className="relative">
                        <RiskGauge value={riskModel.raw} />
                        {deferredMix !== mix && (
                          <div className="absolute -top-2 -right-2 text-[10px] px-1 py-0.5 rounded bg-indigo-600/70 text-white animate-pulse">
                            výpočet…
                          </div>
                        )}
                      </div>
                      {/* Removed secondary mini gauge duplication */}
                      <div className="space-y-1 text-sm">
                        <div>Riziko: {riskModel.raw.toFixed(2)}/10</div>
                        <div>Oč. výnos: {pctFmt(expectedReturn, 2)}</div>
                        <div>
                          Výnos/riziko:{" "}
                          {(expectedReturn / (riskModel.raw || 1)).toFixed(3)}
                        </div>
                        <div
                          className="text-[10px] text-slate-400"
                          title="nad 7.5/10 = agresívne, 10/10 = maximum"
                        >
                          nad 7.5 = agresívne
                        </div>
                      </div>
                    </div>
                    <ul className="list-disc list-inside text-xs space-y-1 text-slate-300">
                      {goldPct < 0.1 && (
                        <li>Navýš zlato aspoň na 10 % pre stabilitu.</li>
                      )}
                      {dynPct > 0.3 && (
                        <li>Dynamické riadenie presahuje 30 % (zniž podiel).</li>
                      )}
                      {cryptoPct > 0.25 && (
                        <li>Krypto &gt;25 % – zvaž diverzifikáciu.</li>
                      )}
                      {riskExceeded && (
                        <li>Riziko nad odporúčanou hranicou 7,5 / 10.</li>
                      )}
                      {cashExceeded && (
                        <li>Hotovosť {(cashPct * 100).toFixed(0)} % – presahuje cieľ.</li>
                      )}
                      {highConcentration && (
                        <li>Vysoká koncentrácia (&gt;50 % jedna zložka).</li>
                      )}
                      {missingReserve > 0 && (
                        <li>Rezervu doplň o {euro(missingReserve)}.</li>
                      )}
                    </ul>
                    {solutions && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">
                            Top optimalizované mixy (výnos / riziko = skóre)
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSolutions(null)}
                              className="px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[10px]"
                            >
                              Zatvoriť
                            </button>
                          </div>
                        </div>
                        <div className="text-[11px] font-mono border border-slate-700/70 rounded overflow-hidden">
                          <div className="grid grid-cols-12 bg-slate-800/60 px-2 py-1 font-semibold">
                            <div className="col-span-2">Mix</div>
                            <div className="col-span-4">Zloženie (skr.)</div>
                            <div className="col-span-2 text-right">Výnos</div>
                            <div className="col-span-2 text-right">Riziko</div>
                            <div className="col-span-2 text-right">Skóre</div>
                          </div>
                          {solutions.map((s, i) => {
                            const shortWeights = Object.entries(s.weights)
                              .map(([k, v]) => `${k.split(" ")[0]}:${v}%`)
                              .join(" ");
                            const top = i < 3;
                            return (
                              <label
                                key={i}
                                className={`grid grid-cols-12 px-2 py-1 border-t border-slate-700/40 items-center cursor-pointer transition-colors ${
                                  selectedSolution === i
                                    ? "bg-slate-900/90 ring-1 ring-indigo-500/50 shadow-inner"
                                    : "bg-slate-900/40 hover:bg-slate-900/65"
                                }`}
                              >
                                <div className="col-span-2 flex items-center gap-1 text-slate-300">
                                  <input
                                    type="radio"
                                    name="solution"
                                    checked={selectedSolution === i}
                                    onChange={() => setSelectedSolution(i)}
                                    className="accent-indigo-500"
                                  />
                                  <span>#{i + 1}</span>
                                  {top && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-amber-600/30 text-amber-200 border border-amber-400/40">
                                      top
                                    </span>
                                  )}
                                </div>
                                <div
                                  className="col-span-4 text-slate-400 truncate"
                                  title={shortWeights}
                                >
                                  {shortWeights}
                                </div>
                                <div className="col-span-2 text-right text-slate-300">
                                  {pctFmt(s.expectedReturn, 2)}
                                </div>
                                <div className="col-span-2 text-right text-slate-300">
                                  {s.risk.toFixed(2)}
                                </div>
                                <div className="col-span-2 text-right text-emerald-400">
                                  {s.score.toFixed(3)}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={applySelected}
                            disabled={selectedSolution == null}
                            className="mt-2 px-4 py-1.5 rounded-md text-[11px] font-medium border border-emerald-500/70 bg-emerald-600/25 hover:bg-emerald-600/35 text-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                          >
                            Použiť vybraný mix
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
            <div
              className={`rounded border border-slate-700 bg-slate-900/60 ${
                densityMode === "ultra" ? "p-2.5" : "p-3"
              } text-[11px] text-slate-400 space-y-1`}
            >
              <div className="font-medium text-slate-300">Meta</div>
              <p>
                Táto verzia je medzistupeň – neskôr pridáme kolabovateľné sekcie
                a optimalizátor.
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* KPI Dock Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-20 px-3 py-1.5 bg-slate-950/80 backdrop-blur border-t border-slate-800 flex items-center justify-center text-[11px] sm:text-[13px] gap-4 text-slate-300 font-mono">
        <span className="flex items-center gap-1">
          <span className="text-slate-500 font-sans">Výnos</span>
          <span
            className={`text-slate-100 ${pulseReturn ? "animate-pulse" : ""}`}
          >
            {pctFmt(expectedReturn, 2)}
          </span>
        </span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center gap-1">
          <span className="text-slate-500 font-sans">FV</span>
          <span className={`text-slate-100 ${pulseFV ? "animate-pulse" : ""}`}>
            {euro(fv)}
          </span>
        </span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center gap-1">
          <span className="text-slate-500 font-sans">Plnenie</span>
          <span
            className={`text-slate-100 ${pulseGoal ? "animate-pulse" : ""}`}
          >
            {(goalProgress * 100).toFixed(1)}%
          </span>
        </span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center gap-1">
          <span className="text-slate-500 font-sans">Riziko</span>
          <span
            className={`text-slate-100 ${pulseRisk ? "animate-pulse" : ""}`}
          >
            {riskModel.raw.toFixed(2)}
          </span>
        </span>
      </div>
      {/* Toasts */}
      {!!toasts.length && (
        <div className="fixed bottom-16 right-3 flex flex-col gap-2 z-30">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="px-3 py-2 rounded border border-emerald-600/40 bg-emerald-600/20 text-[11px] text-emerald-100 shadow-lg backdrop-blur"
            >
              {t.msg}
            </div>
          ))}
        </div>
      )}
      {notesOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Odporúčané poznámky (detail)"
        >
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setNotesOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-slate-700 bg-slate-900/90 shadow-xl p-4 space-y-3 text-xs text-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Odporúčané poznámky</h2>
              <button
                onClick={() => setNotesOpen(false)}
                className="text-[10px] px-2 py-1 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700"
              >
                Zavrieť
              </button>
            </div>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Mix prispôsobený horizontu a rezerve – priorita budovať rezervu.
              </li>
              <li>
                Diverzifikácia medzi akcie / zlato / dlhopis / krypto znižuje
                volatilitu.
              </li>
              <li>
                Rebalansuj minimálne raz ročne alebo pri odchýlke &gt;5 p.b.
              </li>
              <li>
                Ak riziko &gt;7.5 zváž zníženie dynamických / krypto zložiek.
              </li>
              <li>Udržuj hotovosť primeranú (≤35 %) – zvyšok nech pracuje.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
