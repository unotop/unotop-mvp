import React from "react";
import { writeV3 } from "../../persist/v3";
import {
  MixItem,
  normalize,
  setGoldTarget,
  chipsFromState,
  applyRiskConstrainedMix,
} from "./mix.service";
import { TEST_IDS } from "../../testIds";
import { useUncontrolledValueInput } from "../_hooks/useUncontrolledValueInput";

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
];

export const MixPanel: React.FC<{
  mode: "BASIC" | "PRO";
  onReserveOpen?: () => void;
}> = ({ mode, onReserveOpen }) => {
  // internal mix state
  // Initial BASIC mix intentionally sums to 100 % (acceptance test expects ability to create drift from 100 before clicking Dorovnať)
  // gold 5, dyn 0, etf 60, bonds 20, cash 5, crypto 5, real 5 => 100
  const [mix, setMix] = React.useState<MixItem[]>(() => [
    { key: "gold", pct: 5 },
    { key: "dyn", pct: 0 },
    { key: "etf", pct: 60 },
    { key: "bonds", pct: 20 },
    { key: "cash", pct: 5 },
    { key: "crypto", pct: 5 },
    { key: "real", pct: 5 },
  ]);
  const riskPref = (() => {
    try {
      const raw =
        localStorage.getItem("unotop:v3") || localStorage.getItem("unotop_v3");
      if (raw) {
        const p = JSON.parse(raw);
        return p.profile?.riskPref || p.riskPref || "vyvazeny";
      }
    } catch {}
    return "vyvazeny";
  })();
  const capMap: Record<string, number> = {
    konzervativny: 4.0,
    vyvazeny: 6.0,
    rastovy: 7.5,
  };
  const cap = capMap[riskPref] ?? 6.0;

  // handlers commit update then persist once per action
  const commitAsset = (key: AssetKey, pct: number) => {
    setMix((prev) => prev.map((i) => (i.key === key ? { ...i, pct } : i)));
  };
  React.useEffect(() => {
    // persist after any slider/text commit (debounced by input hook already)
    writeV3({ mix: mix.map((m) => ({ key: m.key, pct: m.pct })) });
  }, [mix]);

  // Controllers pre každý asset (bez map hook porušení)
  const goldPct = mix.find((m) => m.key === "gold")?.pct || 0;
  const dynPct = mix.find((m) => m.key === "dyn")?.pct || 0;
  const etfPct = mix.find((m) => m.key === "etf")?.pct || 0;
  const bondsPct = mix.find((m) => m.key === "bonds")?.pct || 0;
  const cashPct = mix.find((m) => m.key === "cash")?.pct || 0;
  const cryptoPct = mix.find((m) => m.key === "crypto")?.pct || 0;
  const realPct = mix.find((m) => m.key === "real")?.pct || 0;

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

  const chipsRaw = chipsFromState(mix);
  const sum = mix.reduce((a, b) => a + b.pct, 0);

  // Hard cap: Calculate max allowable value for each asset (prevent total > 100%)
  const getMaxAllowed = (currentPct: number) => {
    const otherSum = sum - currentPct;
    const remaining = 100 - otherSum;
    return Math.min(100, remaining);
  };

  const chips = chipsRaw.map((c) => {
    if (c.startsWith("Zlato dorovnané")) return "🟡 Zlato dorovnané";
    if (c.startsWith("Dyn+Krypto obmedzené")) return "🚦 Dyn+Krypto obmedzené";
    if (c.startsWith("Súčet dorovnaný")) return "✅ Súčet dorovnaný";
    if (c.startsWith("⚠️")) return c; // už obsahuje emoji
    return c;
  });

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

  return (
    <section
      className="rounded-2xl ring-1 ring-white/10 bg-slate-900/60 p-4"
      aria-labelledby="mix-panel-title"
    >
      <header id="mix-panel-title" className="mb-3 font-semibold">
        Zloženie portfólia
      </header>
      <div
        data-testid={TEST_IDS.INSIGHTS_WRAP}
        className="mb-3 flex flex-wrap gap-2"
      >
        <button
          type="button"
          onClick={applyGold12}
          data-testid="insight-gold-12"
          className="px-3 py-1 text-xs rounded bg-amber-500/10 ring-1 ring-amber-500/40"
        >
          Gold 12 % (odporúčanie)
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
                    className="px-3 py-1 text-xs rounded bg-emerald-500/10 ring-1 ring-emerald-500/40"
                    data-testid="insight-reserve"
                  >
                    Rezervu doplň
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
            <span className="tabular-nums text-xs">{Math.round(bondsPct)}%</span>
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
            <span className="tabular-nums text-xs">{Math.round(cryptoPct)}%</span>
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
          className="px-2 py-1 rounded bg-slate-700 text-xs disabled:opacity-50"
        >
          Dorovnať
        </button>
        <button
          onClick={optimizeRisk}
          className="px-2 py-1 rounded bg-slate-700 text-xs"
          aria-label="Optimalizuj"
        >
          Optimalizuj
        </button>
        <button
          onClick={optimizeRisk}
          className="px-2 py-1 rounded bg-slate-700 text-xs"
        >
          Max výnos (riziko ≤ {cap})
        </button>
        <button
          onClick={applyRecommended}
          className="px-2 py-1 rounded bg-slate-700 text-xs"
        >
          Aplikovať odporúčaný mix portfólia
        </button>
        <button
          onClick={applyRules}
          className="px-2 py-1 rounded bg-slate-700 text-xs"
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
          className="px-2 py-1 rounded bg-slate-700 text-xs"
        >
          Resetovať hodnoty
        </button>
      </div>
      <div
        data-testid={TEST_IDS.CHIPS_STRIP}
        className="mt-4 flex flex-wrap gap-2"
        aria-live="polite"
      >
        {chips.map((c) => (
          <span
            key={c}
            data-testid={TEST_IDS.SCENARIO_CHIP}
            className="px-2 py-1 rounded border border-slate-600 text-xs bg-slate-700/40"
          >
            {c}
          </span>
        ))}
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
