import React from "react";
import { writeV3, readV3 } from "../../persist/v3";
import {
  MixItem,
  normalize,
  setGoldTarget,
  chipsFromState,
  applyRiskConstrainedMix,
} from "./mix.service";
import { TEST_IDS } from "../../testIds";
import { useUncontrolledValueInput } from "../_hooks/useUncontrolledValueInput";
import { riskScore0to10, getRiskCap, type RiskPref } from "./assetModel";

type AssetKey = MixItem["key"];
interface AssetDef {
  key: AssetKey;
  label: string;
}
const ASSETS: AssetDef[] = [
  { key: "gold", label: "Zlato (fyzické)" },
  { key: "dyn", label: "Dynamické riadenie" },
  { key: "etf", label: "ETF (svet – aktívne)" },
  { key: "bonds", label: "Garantovaný dlhopis 7,5% p.a." },
  { key: "cash", label: "Hotovosť/rezerva" },
  { key: "crypto", label: "Krypto (BTC/ETH)" },
  { key: "real", label: "Reality (komerčné)" },
  { key: "other", label: "Ostatné" },
];

export const MixPanel: React.FC<{
  mode: "BASIC" | "PRO";
  onReserveOpen?: () => void;
}> = ({ mode, onReserveOpen }) => {
  // internal mix state - hydrate from v3 on mount
  const [mix, setMix] = React.useState<MixItem[]>(() => {
    try {
      const raw =
        localStorage.getItem("unotop:v3") || localStorage.getItem("unotop_v3");
      if (raw) {
        const p = JSON.parse(raw);
        const stored = p.mix;
        if (Array.isArray(stored) && stored.length > 0) {
          // Merge s defaults (ak chýbajú keys)
          const defaults: Record<AssetKey, number> = {
            gold: 5,
            dyn: 0,
            etf: 60,
            bonds: 20,
            cash: 5,
            crypto: 5,
            real: 5,
            other: 0,
          };
          const merged: MixItem[] = [];
          const keys: AssetKey[] = [
            "gold",
            "dyn",
            "etf",
            "bonds",
            "cash",
            "crypto",
            "real",
            "other",
          ];
          for (const k of keys) {
            const found = stored.find((m: any) => m.key === k);
            merged.push({ key: k, pct: found?.pct ?? defaults[k] });
          }
          return merged;
        }
      }
    } catch {}
    // Fallback: Initial BASIC mix intentionally sums to 100 %
    // (acceptance test expects ability to create drift from 100 before clicking Dorovnať)
    return [
      { key: "gold", pct: 5 },
      { key: "dyn", pct: 0 },
      { key: "etf", pct: 60 },
      { key: "bonds", pct: 20 },
      { key: "cash", pct: 5 },
      { key: "crypto", pct: 5 },
      { key: "real", pct: 5 },
      { key: "other", pct: 0 },
    ];
  });

  // Read riskPref from localStorage (used for risk calculation and cap)
  const riskPref: RiskPref = (() => {
    try {
      const raw =
        localStorage.getItem("unotop:v3") || localStorage.getItem("unotop_v3");
      if (raw) {
        const p = JSON.parse(raw);
        const pref = p.profile?.riskPref || p.riskPref || "vyvazeny";
        if (pref === "konzervativny" || pref === "rastovy") return pref;
      }
    } catch {}
    return "vyvazeny";
  })();

  const cap = getRiskCap(riskPref);

  // handlers commit update then persist once per action
  const commitAsset = (key: AssetKey, pct: number) => {
    // Zaokrúhli na celé čísla (odstráni desatinné miesta)
    const rounded = Math.round(pct);
    setMix((prev) =>
      prev.map((i) => (i.key === key ? { ...i, pct: rounded } : i))
    );
  };

  // Persist after any slider/text commit (debounced by input hook already)
  React.useEffect(() => {
    writeV3({ mix: mix.map((m) => ({ key: m.key, pct: m.pct })) });
  }, [mix]);

  // CRITICAL: Polling sync from localStorage (same pattern as MetricsSection)
  // This ensures external changes (e.g., from LegacyApp normalize or other components) are reflected
  React.useEffect(() => {
    const syncFromStorage = () => {
      try {
        const raw =
          localStorage.getItem("unotop:v3") ||
          localStorage.getItem("unotop_v3");
        if (raw) {
          const p = JSON.parse(raw);
          const stored = p.mix;
          if (Array.isArray(stored) && stored.length > 0) {
            const currentKey = JSON.stringify(
              mix.map((m) => ({ key: m.key, pct: m.pct }))
            );
            const storedKey = JSON.stringify(
              stored.map((m: any) => ({ key: m.key, pct: m.pct }))
            );
            if (currentKey !== storedKey) {
              // localStorage changed externally, sync to component state
              const defaults: Record<AssetKey, number> = {
                gold: 5,
                dyn: 0,
                etf: 60,
                bonds: 20,
                cash: 5,
                crypto: 5,
                real: 5,
                other: 0,
              };
              const merged: MixItem[] = [];
              const keys: AssetKey[] = [
                "gold",
                "dyn",
                "etf",
                "bonds",
                "cash",
                "crypto",
                "real",
                "other",
              ];
              for (const k of keys) {
                const found = stored.find((m: any) => m.key === k);
                merged.push({ key: k, pct: found?.pct ?? defaults[k] });
              }
              setMix(merged);
            }
          }
        }
      } catch {}
    };
    syncFromStorage(); // initial
    const interval = setInterval(syncFromStorage, 500); // poll every 500ms
    return () => clearInterval(interval);
  }, [mix]);

  // Controllers pre každý asset (bez map hook porušení)
  const goldPct = mix.find((m) => m.key === "gold")?.pct || 0;
  const dynPct = mix.find((m) => m.key === "dyn")?.pct || 0;
  const etfPct = mix.find((m) => m.key === "etf")?.pct || 0;
  const bondsPct = mix.find((m) => m.key === "bonds")?.pct || 0;
  const cashPct = mix.find((m) => m.key === "cash")?.pct || 0;
  const cryptoPct = mix.find((m) => m.key === "crypto")?.pct || 0;
  const realPct = mix.find((m) => m.key === "real")?.pct || 0;
  const otherPct = mix.find((m) => m.key === "other")?.pct || 0;

  const goldCtl = useUncontrolledValueInput({
    initial: goldPct,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, Math.min(100, n)),
    commit: (n) => commitAsset("gold", n),
  });
  const dynCtl = useUncontrolledValueInput({
    initial: dynPct,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, Math.min(100, n)),
    commit: (n) => commitAsset("dyn", n),
  });
  const etfCtl = useUncontrolledValueInput({
    initial: etfPct,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, Math.min(100, n)),
    commit: (n) => commitAsset("etf", n),
  });
  const bondsCtl = useUncontrolledValueInput({
    initial: bondsPct,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, Math.min(100, n)),
    commit: (n) => commitAsset("bonds", n),
  });
  const cashCtl = useUncontrolledValueInput({
    initial: cashPct,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, Math.min(100, n)),
    commit: (n) => commitAsset("cash", n),
  });
  const cryptoCtl = useUncontrolledValueInput({
    initial: cryptoPct,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, Math.min(100, n)),
    commit: (n) => commitAsset("crypto", n),
  });
  const realCtl = useUncontrolledValueInput({
    initial: realPct,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, Math.min(100, n)),
    commit: (n) => commitAsset("real", n),
  });
  const otherCtl = useUncontrolledValueInput({
    initial: otherPct,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, Math.min(100, n)),
    commit: (n) => commitAsset("other", n),
  });

  const sum = mix.reduce((a, b) => a + b.pct, 0);

  // Hard cap: Calculate max allowable value for each asset (prevent total > 100%)
  const getMaxAllowed = (currentPct: number) => {
    const otherSum = sum - currentPct;
    const remaining = 100 - otherSum;
    return Math.min(100, remaining);
  };

  const [toast, setToast] = React.useState<string | null>(null);
  const applyGold12 = () => {
    const next = setGoldTarget(mix, 12);
    setMix(next);
    writeV3({ mix: next });
    // focus slider
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(
        `[data-testid="${TEST_IDS.GOLD_SLIDER}"]`
      );
      el?.focus();
      el?.classList.add("animate-pulse");
      setTimeout(() => el?.classList.remove("animate-pulse"), 1000);
    }, 0);
  };
  const normalizeAll = () => {
    const n = normalize(mix);
    setMix(n);
    writeV3({ mix: n });
  };
  const optimizeRisk = () => {
    const constrained = applyRiskConstrainedMix(mix, cap);
    setMix(constrained);
    writeV3({ mix: constrained });
  };
  const applyRecommended = () => {
    // Simple recommendation: ensure gold at least 12 %, then normalize
    let next = mix;
    if (goldPct < 12) next = setGoldTarget(next, 12);
    next = normalize(next);
    if (JSON.stringify(next) !== JSON.stringify(mix)) {
      setMix(next);
      writeV3({ mix: next });
      setToast("Odporúčaný mix aplikovaný");
    } else {
      setToast("Žiadne úpravy");
    }
    setTimeout(() => setToast(null), 1400);
  };
  const applyRules = () => {
    const constrained = applyRiskConstrainedMix(mix, cap);
    if (JSON.stringify(constrained) === JSON.stringify(mix)) {
      setToast("Žiadne úpravy");
    } else {
      setMix(constrained);
      writeV3({ mix: constrained });
      setToast("Mix upravený");
    }
    setTimeout(() => setToast(null), 1400);
  };

  // Calculate risk score and summary metrics
  const risk = riskScore0to10(mix, riskPref, 0);

  // Summary bar status color
  const sumDrift = Math.abs(sum - 100);
  const sumStatusColor =
    sumDrift <= 0.1
      ? "text-green-400"
      : sumDrift <= 1.0
        ? "text-yellow-400"
        : "text-red-400";

  // Enhanced chips with risk check
  const enhancedChips: string[] = [];
  if (goldPct >= 12) enhancedChips.push("🟡 Zlato dorovnané");
  if (dynPct + cryptoPct > 22) enhancedChips.push("🚦 Dyn+Krypto obmedzené");
  if (sumDrift <= 0.1) enhancedChips.push("✅ Súčet dorovnaný");
  if (risk > cap) enhancedChips.push("⚠️ Nad limit rizika");

  return (
    <section
      className="rounded-2xl ring-1 ring-white/10 bg-slate-900/60 p-4"
      aria-labelledby="mix-panel-title"
    >
      <header id="mix-panel-title" className="mb-3 font-semibold">
        Zloženie portfólia
      </header>

      {/* Summary Bar */}
      <div className="mb-3 p-2 rounded-lg bg-slate-800/50 ring-1 ring-white/5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Súčet portfólia:</span>
          <span className={`font-bold tabular-nums ${sumStatusColor}`}>
            {sum.toFixed(1)} %
          </span>
        </div>
      </div>

      {/* Chips Strip (visible in DOM) */}
      {enhancedChips.length > 0 && (
        <div
          data-testid={TEST_IDS.CHIPS_STRIP}
          className="mb-3 flex flex-wrap gap-2"
        >
          {enhancedChips.map((chip, idx) => (
            <span
              key={idx}
              data-testid={TEST_IDS.SCENARIO_CHIP}
              className="px-2 py-1 text-xs rounded bg-slate-800/60 ring-1 ring-white/10 text-slate-300"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* Insights (Gold 12%, Reserve) */}
      <div
        data-testid={TEST_IDS.INSIGHTS_WRAP}
        className="mb-3 flex flex-wrap gap-2 animate-[fadeIn_0.3s_ease-in]"
      >
        <button
          type="button"
          onClick={applyGold12}
          data-testid="insight-gold-12"
          className="px-3 py-1 text-xs rounded bg-amber-500/10 ring-1 ring-amber-500/40 hover:bg-amber-500/20 hover:ring-amber-500/60 hover:scale-105 active:scale-95 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/20"
          title="Navýš zlato na odporúčanú úroveň pre stabilitu portfólia"
        >
          💡 Gold 12 % (odporúčanie)
        </button>
        {(() => {
          // Read reserve status from persisted profile to conditionally surface insight
          try {
            const raw =
              localStorage.getItem("unotop:v3") ||
              localStorage.getItem("unotop_v3");
            if (raw) {
              const p = JSON.parse(raw);
              const reserveEur = p.profile?.reserveEur ?? p.reserveEur ?? 0;
              const reserveMonths =
                p.profile?.reserveMonths ?? p.reserveMonths ?? 0;
              if (reserveEur < 1000 || reserveMonths < 6) {
                return (
                  <button
                    type="button"
                    onClick={() => onReserveOpen?.()}
                    className="px-3 py-1 text-xs rounded bg-emerald-500/10 ring-1 ring-emerald-500/40 hover:bg-emerald-500/20 hover:ring-emerald-500/60 hover:scale-105 active:scale-95 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20"
                    data-testid="insight-reserve"
                    title="Doplň rezervu na minimálne 1000 € alebo 6 mesiacov"
                  >
                    💡 Rezervu doplň
                  </button>
                );
              }
            }
          } catch {}
          return null;
        })()}
      </div>
      <div className="space-y-1.5">
        {/* Gold */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <label htmlFor="txt-gold" className="text-xs">
            Zlato (fyzické)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="txt-gold"
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="decimal"
              aria-label="Zlato (fyzické)"
              ref={goldCtl.ref}
              onChange={goldCtl.onChange}
              onBlur={goldCtl.onBlur}
              className="w-20 px-2 py-1 rounded bg-slate-800 text-sm"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={goldPct}
              disabled={sum >= 100 && goldPct === 0}
              onChange={(e) => {
                const requested = Number(e.target.value);
                const maxAllowed = getMaxAllowed(goldPct);
                const v = Math.min(requested, maxAllowed);
                commitAsset("gold", v);
                goldCtl.syncToDom(v);
              }}
              data-testid={TEST_IDS.GOLD_SLIDER}
              aria-label="Zlato (fyzické)"
            />
            <span className="tabular-nums text-xs">{Math.round(goldPct)}%</span>
          </div>
        </div>
        {/* Dyn */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <label htmlFor="txt-dyn" className="text-xs">
            Dynamické riadenie
          </label>
          <div className="flex items-center gap-2">
            <input
              id="txt-dyn"
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="decimal"
              aria-label="Dynamické riadenie"
              ref={dynCtl.ref}
              onChange={dynCtl.onChange}
              onBlur={dynCtl.onBlur}
              className="w-20 px-2 py-1 rounded bg-slate-800 text-sm"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={dynPct}
              disabled={sum >= 100 && dynPct === 0}
              onChange={(e) => {
                const requested = Number(e.target.value);
                const maxAllowed = getMaxAllowed(dynPct);
                const v = Math.min(requested, maxAllowed);
                commitAsset("dyn", v);
                dynCtl.syncToDom(v);
              }}
              aria-label="Dynamické riadenie"
            />
            <span className="tabular-nums text-xs">{Math.round(dynPct)}%</span>
          </div>
        </div>
        {/* ETF */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <label htmlFor="txt-etf" className="text-xs">
            ETF (svet – aktívne)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="txt-etf"
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="decimal"
              aria-label="ETF (svet – aktívne)"
              ref={etfCtl.ref}
              onChange={etfCtl.onChange}
              onBlur={etfCtl.onBlur}
              className="w-20 px-2 py-1 rounded bg-slate-800 text-sm"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={etfPct}
              disabled={sum >= 100 && etfPct === 0}
              onChange={(e) => {
                const requested = Number(e.target.value);
                const maxAllowed = getMaxAllowed(etfPct);
                const v = Math.min(requested, maxAllowed);
                commitAsset("etf", v);
                etfCtl.syncToDom(v);
              }}
              aria-label="ETF (svet – aktívne)"
            />
            <span className="tabular-nums text-xs">{Math.round(etfPct)}%</span>
          </div>
        </div>
        {/* Bonds */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <label htmlFor="txt-bonds" className="text-xs">
            Garantovaný dlhopis 7,5% p.a.
          </label>
          <div className="flex items-center gap-2">
            <input
              id="txt-bonds"
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="decimal"
              aria-label="Garantovaný dlhopis 7,5% p.a."
              ref={bondsCtl.ref}
              onChange={bondsCtl.onChange}
              onBlur={bondsCtl.onBlur}
              className="w-20 px-2 py-1 rounded bg-slate-800 text-sm"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={bondsPct}
              disabled={sum >= 100 && bondsPct === 0}
              onChange={(e) => {
                const requested = Number(e.target.value);
                const maxAllowed = getMaxAllowed(bondsPct);
                const v = Math.min(requested, maxAllowed);
                commitAsset("bonds", v);
                bondsCtl.syncToDom(v);
              }}
              aria-label="Garantovaný dlhopis 7,5% p.a."
            />
            <span className="tabular-nums text-xs">
              {Math.round(bondsPct)}%
            </span>
          </div>
        </div>
        {/* Cash */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <label htmlFor="txt-cash" className="text-xs">
            Hotovosť/rezerva
          </label>
          <div className="flex items-center gap-2">
            <input
              id="txt-cash"
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="decimal"
              aria-label="Hotovosť/rezerva"
              ref={cashCtl.ref}
              onChange={cashCtl.onChange}
              onBlur={cashCtl.onBlur}
              className="w-20 px-2 py-1 rounded bg-slate-800 text-sm"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={cashPct}
              disabled={sum >= 100 && cashPct === 0}
              onChange={(e) => {
                const requested = Number(e.target.value);
                const maxAllowed = getMaxAllowed(cashPct);
                const v = Math.min(requested, maxAllowed);
                commitAsset("cash", v);
                cashCtl.syncToDom(v);
              }}
              aria-label="Hotovosť/rezerva"
            />
            <span className="tabular-nums text-xs">{Math.round(cashPct)}%</span>
          </div>
        </div>
        {/* Crypto */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <label htmlFor="txt-crypto" className="text-xs">
            Krypto (BTC/ETH)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="txt-crypto"
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="decimal"
              aria-label="Krypto (BTC/ETH)"
              ref={cryptoCtl.ref}
              onChange={cryptoCtl.onChange}
              onBlur={cryptoCtl.onBlur}
              className="w-20 px-2 py-1 rounded bg-slate-800 text-sm"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={cryptoPct}
              disabled={sum >= 100 && cryptoPct === 0}
              onChange={(e) => {
                const requested = Number(e.target.value);
                const maxAllowed = getMaxAllowed(cryptoPct);
                const v = Math.min(requested, maxAllowed);
                commitAsset("crypto", v);
                cryptoCtl.syncToDom(v);
              }}
              aria-label="Krypto (BTC/ETH)"
            />
            <span className="tabular-nums text-xs">
              {Math.round(cryptoPct)}%
            </span>
          </div>
        </div>
        {/* Real */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <label htmlFor="txt-real" className="text-xs">
            Reality (komerčné)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="txt-real"
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="decimal"
              aria-label="Reality (komerčné)"
              ref={realCtl.ref}
              onChange={realCtl.onChange}
              onBlur={realCtl.onBlur}
              className="w-20 px-2 py-1 rounded bg-slate-800 text-sm"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={realPct}
              disabled={sum >= 100 && realPct === 0}
              onChange={(e) => {
                const requested = Number(e.target.value);
                const maxAllowed = getMaxAllowed(realPct);
                const v = Math.min(requested, maxAllowed);
                commitAsset("real", v);
                realCtl.syncToDom(v);
              }}
              aria-label="Reality (komerčné)"
            />
            <span className="tabular-nums text-xs">{Math.round(realPct)}%</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <div
          className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded ${
            Math.abs(sum - 100) < 0.01
              ? "bg-emerald-800/40 ring-1 ring-emerald-500/40 text-emerald-200"
              : Math.abs(sum - 100) <= 1
                ? "bg-amber-800/40 ring-1 ring-amber-500/40 text-amber-200"
                : "bg-red-800/40 ring-1 ring-red-500/40 text-red-200"
          }`}
          data-testid="mix-sum-label"
          aria-label="Súčet mixu"
        >
          <span>Súčet</span>
          <span>&nbsp;mixu:</span>
          <span className="tabular-nums">{Math.round(sum)}%</span>
        </div>
        <button
          onClick={normalizeAll}
          disabled={Math.round(sum) === 100}
          className="px-2 py-1 rounded bg-slate-700 text-xs disabled:opacity-50 hover:bg-slate-600 hover:scale-105 active:scale-95 transition-all duration-200 disabled:hover:scale-100"
          title="Normalizuj mix na presne 100 %"
        >
          Dorovnať
        </button>
        <button
          onClick={optimizeRisk}
          className="px-2 py-1 rounded bg-slate-700 text-xs hover:bg-slate-600 hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="Optimalizuj"
          title="Optimalizuj mix pre maximálny výnos pri dodržaní risk cap"
        >
          Optimalizuj
        </button>
        <button
          onClick={optimizeRisk}
          className="px-2 py-1 rounded bg-slate-700 text-xs hover:bg-slate-600 hover:scale-105 active:scale-95 transition-all duration-200"
          title="Maximalizuj výnos pri dodržaní risk cap"
        >
          Max výnos (riziko ≤ {cap})
        </button>
        <button
          onClick={applyRecommended}
          className="px-2 py-1 rounded bg-slate-700 text-xs hover:bg-slate-600 hover:scale-105 active:scale-95 transition-all duration-200"
          title="Aplikuj odporúčaný mix podľa rizikovej preferencie"
        >
          Aplikovať odporúčaný mix portfólia
        </button>
        <button
          onClick={applyRules}
          className="px-2 py-1 rounded bg-slate-700 text-xs hover:bg-slate-600 hover:scale-105 active:scale-95 transition-all duration-200"
          title="Uprav mix aby dodržiaval limity (Dyn+Krypto ≤22%, Dyn ≤15%)"
        >
          Upraviť podľa pravidiel
        </button>
        <button
          onClick={() => {
            // reset to initial seed mix (no normalization beyond seed)
            const seed: MixItem[] = [
              { key: "gold", pct: 5 },
              { key: "dyn", pct: 0 },
              { key: "etf", pct: 60 },
              { key: "bonds", pct: 20 },
              { key: "cash", pct: 5 },
              { key: "crypto", pct: 5 },
              { key: "real", pct: 5 },
            ];
            setMix(seed);
            writeV3({ mix: seed });
          }}
          aria-label="Resetovať hodnoty"
          className="px-2 py-1 rounded bg-slate-700 text-xs hover:bg-slate-600 hover:scale-105 active:scale-95 transition-all duration-200"
          title="Resetuj mix na počiatočné hodnoty (Gold 5%, ETF 60%, Bonds 20%, atď.)"
        >
          Resetovať hodnoty
        </button>
      </div>

      {/* Dyn+Krypto constraint warning + CTA */}
      {(() => {
        const dynPct = mix.find((i) => i.key === "dyn")?.pct || 0;
        const cryptoPct = mix.find((i) => i.key === "crypto")?.pct || 0;
        const combined = dynPct + cryptoPct;
        if (combined <= 22) return null;
        return (
          <div className="mt-3 p-3 rounded-lg bg-amber-900/20 ring-1 ring-amber-500/30 text-sm">
            <div className="font-medium text-amber-400 mb-1">
              ⚠️ Dyn+Krypto nad limit
            </div>
            <div className="text-slate-300 mb-2">
              Dynamické riadenie + Krypto: {combined.toFixed(0)}% (max 22%)
            </div>
            <button
              type="button"
              aria-label="Upraviť Dyn+Krypto na 22% limit"
              className="px-3 py-1.5 rounded bg-amber-600/30 ring-1 ring-amber-500/50 text-xs font-medium hover:bg-amber-600/40 transition-colors"
              onClick={() => {
                // Proporcionálne znížiť dyn + crypto na 22% max
                const targetSum = 22;
                const ratio = targetSum / combined;
                const newDyn = dynPct * ratio;
                const newCrypto = cryptoPct * ratio;
                const freed = combined - targetSum;
                // Redistribuuj freed medzi ostatné (proporcionálne)
                const others = mix.filter(
                  (i) => i.key !== "dyn" && i.key !== "crypto"
                );
                const othersSum = others.reduce((a, b) => a + b.pct, 0) || 1;
                const adjusted = mix.map((i) => {
                  if (i.key === "dyn") return { ...i, pct: +newDyn.toFixed(2) };
                  if (i.key === "crypto")
                    return { ...i, pct: +newCrypto.toFixed(2) };
                  return {
                    ...i,
                    pct: +(i.pct + (i.pct / othersSum) * freed).toFixed(2),
                  };
                });
                const normalized = normalize(adjusted);
                setMix(normalized);
                writeV3({ mix: normalized as any });
                setToast("Dyn+Krypto dorovnané na 22%");
                setTimeout(() => setToast(null), 2000);
              }}
            >
              Dorovnať na 22 %
            </button>
          </div>
        );
      })()}

      {/* Semantická list reprezentácia mixu (pre acceptance test, ktorý očakáva role="listitem") */}
      <ul aria-label="Mix položky" className="sr-only">
        {mix.map((item) => (
          <li key={item.key}>
            {(() => {
              const def = ASSETS.find((a) => a.key === item.key);
              const label = def ? def.label.split("%")[0] : item.key;
              return `${label.trim()} ${Math.round(item.pct)}%`;
            })()}
          </li>
        ))}
      </ul>
      <div aria-live="polite" className="mt-3 min-h-[1.25rem]">
        {toast && (
          <div
            className="text-xs px-2 py-1 rounded bg-slate-700 inline-block"
            role="status"
          >
            {toast}
          </div>
        )}
      </div>
    </section>
  );
};

export default MixPanel;
