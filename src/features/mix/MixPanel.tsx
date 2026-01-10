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
import { AssetSlider } from "./AssetSlider";
import { ASSET_STYLES } from "./assetStyles";
import { StatusChips, type StatusChip } from "./StatusChips";
import { WarningChips } from "../ui/warnings/WarningChips";
import { MixLockChip } from "./MixLockChip"; // PR-4
import { lockMix, isMixLocked } from "./mix-lock"; // PR-4 + PR-6 Task B

// PR-12: Helper pre zápis mixu + nastavenie mixOrigin='manual' (PRO ochrana)
function writeMixManual(mix: MixItem[]) {
  const v3 = readV3();
  writeV3({
    mix: mix.map((m) => ({ key: m.key, pct: m.pct })),
    // PR-12: Manuálna zmena → mixOrigin='manual', chip nikdy nezobrazovať
    mixOrigin: "manual",
    presetId: undefined, // Clear preset tracking
    profileSnapshot: undefined, // Clear snapshot
  });
}

type AssetKey = MixItem["key"];
interface AssetDef {
  key: AssetKey;
  label: string;
}
const ASSETS: AssetDef[] = [
  { key: "gold", label: "Zlato (fyzické)" },
  { key: "dyn", label: "Dynamické riadenie" },
  { key: "etf", label: "ETF (svet – aktívne)" },
  { key: "bonds", label: "Garantovaný dlhopis 7,5% p.a. (5r)" },
  { key: "bond3y9", label: "Dlhopis 13% p.a. (3r, mesačný CF)" },
  { key: "cash", label: "Pracujúca rezerva – IAD DK" },
  { key: "crypto", label: "Krypto (BTC/ETH)" },
  { key: "real", label: "Reality (komerčné)" },
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
            bonds: 15,
            bond3y9: 5,
            cash: 5,
            crypto: 5,
            real: 5,
          };
          const merged: MixItem[] = [];
          const keys: AssetKey[] = [
            "gold",
            "dyn",
            "etf",
            "bonds",
            "bond3y9",
            "cash",
            "crypto",
            "real",
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
      { key: "bonds", pct: 15 },
      { key: "bond3y9", pct: 5 },
      { key: "cash", pct: 5 },
      { key: "crypto", pct: 5 },
      { key: "real", pct: 5 },
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
    // Zaokrúhli na 2 desatinné miesta pre presnosť
    const rounded = +pct.toFixed(2);
    setMix((prev) =>
      prev.map((i) => (i.key === key ? { ...i, pct: rounded } : i))
    );

    // PR-4: Manuálny ťah na slidri → zamknúť mix
    lockMix();
  };

  // Persist after any slider/text commit (debounced by input hook already)
  React.useEffect(() => {
    writeMixManual(mix);
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
                bonds: 15,
                bond3y9: 5,
                cash: 5,
                crypto: 5,
                real: 5,
              };
              const merged: MixItem[] = [];
              const keys: AssetKey[] = [
                "gold",
                "dyn",
                "etf",
                "bonds",
                "bond3y9",
                "cash",
                "crypto",
                "real",
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
  const bond3y9Pct = mix.find((m) => m.key === "bond3y9")?.pct || 0;
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
  const bond3y9Ctl = useUncontrolledValueInput({
    initial: bond3y9Pct,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, Math.min(100, n)),
    commit: (n) => commitAsset("bond3y9", n),
  });

  const sum = mix.reduce((a, b) => a + b.pct, 0);

  // Hard cap: Calculate max allowable value for each asset (prevent total > 100%)
  const getMaxAllowed = (currentPct: number) => {
    const otherSum = sum - currentPct;
    const remaining = 100 - otherSum;
    return Math.min(100, remaining);
  };

  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup toast timeout on unmount
  React.useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Helper: Set toast with auto-clear
  const showToast = (message: string, duration = 1400) => {
    setToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), duration);
  };

  const applyGold12 = () => {
    const next = setGoldTarget(mix, 12);
    setMix(next);
    writeMixManual(next);
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
    // Normalizácia je vždy povolená (manuálna akcia)
    const n = normalize(mix);
    setMix(n);
    writeMixManual(n);
  };
  const optimizeRisk = () => {
    // PR-6 Task B: Blokuj ak je mix locked
    if (isMixLocked()) {
      showToast("⚠️ Mix je zamknutý");
      return;
    }
    const constrained = applyRiskConstrainedMix(mix, cap);
    setMix(constrained);
    writeMixManual(constrained);
  };
  const applyRecommended = () => {
    // PR-6 Task B: Blokuj ak je mix locked
    if (isMixLocked()) {
      showToast("⚠️ Mix je zamknutý");
      return;
    }
    // Simple recommendation: ensure gold at least 12 %, then normalize
    let next = mix;
    if (goldPct < 12) next = setGoldTarget(next, 12);
    next = normalize(next);
    if (JSON.stringify(next) !== JSON.stringify(mix)) {
      setMix(next);
      writeMixManual(next);
      showToast("Odporúčaný mix aplikovaný");
    } else {
      showToast("Žiadne úpravy");
    }
  };
  const applyRules = () => {
    // PR-6 Task B: Blokuj ak je mix locked
    if (isMixLocked()) {
      showToast("⚠️ Mix je zamknutý");
      return;
    }
    const constrained = applyRiskConstrainedMix(mix, cap);
    if (JSON.stringify(constrained) === JSON.stringify(mix)) {
      showToast("Žiadne úpravy");
    } else {
      setMix(constrained);
      writeMixManual(constrained);
      showToast("Mix upravený");
    }
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

  // Enhanced status chips with tooltips
  const statusChips: StatusChip[] = [];

  // Sum validation
  if (sumDrift <= 0.1) {
    statusChips.push({
      id: "sum-ok",
      icon: "✅",
      label: "Súčet dorovnaný",
      variant: "success",
      tooltip: "Portfólio je správne vyvážené na 100%",
    });
  } else if (sumDrift > 1.0) {
    statusChips.push({
      id: "sum-drift",
      icon: "⚠️",
      label: `Súčet ${sum.toFixed(0)}%`,
      variant: "warning",
      tooltip: `Portfólio by malo byť 100%, aktuálne ${sum.toFixed(1)}%`,
    });
  }

  // Gold recommendation
  if (goldPct >= 12) {
    statusChips.push({
      id: "gold-ok",
      icon: "🥇",
      label: "Zlato dorovnané",
      variant: "success",
      tooltip: "Zlato >= 12% pre stabilitu portfólia",
    });
  } else if (goldPct < 12 && goldPct > 0) {
    statusChips.push({
      id: "gold-low",
      icon: "🥇",
      label: `Zlato ${goldPct.toFixed(0)}% (< 12%)`,
      variant: "info",
      tooltip: "Odporúčame navýšiť zlato na 12% pre stabilitu",
    });
  }

  // Dyn + Crypto constraint
  const dynCryptoSum = dynPct + cryptoPct;
  if (dynCryptoSum > 22) {
    statusChips.push({
      id: "dyn-crypto-high",
      icon: "🚦",
      label: `Dyn+Krypto ${dynCryptoSum.toFixed(0)}% (> 22%)`,
      variant: "warning",
      tooltip: "Dynamické + Krypto by nemalo presiahnuť 22%",
    });
  }

  // Risk cap validation
  if (risk > cap) {
    statusChips.push({
      id: "risk-over",
      icon: "🔴",
      label: `Riziko ${risk.toFixed(1)} > ${cap.toFixed(1)}`,
      variant: "error",
      tooltip: `Portfólio prekračuje risk cap pre ${riskPref} profil`,
    });
  } else if (risk > cap * 0.9) {
    // Warning if close to cap
    statusChips.push({
      id: "risk-near",
      icon: "🟠",
      label: `Riziko ${risk.toFixed(1)}/${cap.toFixed(1)}`,
      variant: "warning",
      tooltip: "Riziko blízko limitu, zvážte úpravu mixu",
    });
  } else {
    statusChips.push({
      id: "risk-ok",
      icon: "✅",
      label: `Riziko ${risk.toFixed(1)}/${cap.toFixed(1)}`,
      variant: "success",
      tooltip: "Riziko v rámci limitu",
    });
  }

  return (
    <section
      className="rounded-2xl ring-1 ring-white/10 bg-slate-900/60 p-4"
      aria-labelledby="mix-panel-title"
    >
      <header
        id="mix-panel-title"
        className="mb-3 font-semibold flex items-center gap-2"
      >
        <svg
          className="w-5 h-5 text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
          />
        </svg>
        Zloženie portfólia
      </header>

      {/* PR-4: Mix Lock Chip */}
      <div className="mb-3">
        <MixLockChip
          onUnlock={() => {
            // Force re-render to show unlocked state
            setMix([...mix]);
          }}
        />
      </div>

      {/* Summary Bar */}
      <div className="mb-3 p-2 rounded-lg bg-slate-800/50 ring-1 ring-white/5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Súčet portfólia:</span>
          <span className={`font-bold tabular-nums ${sumStatusColor}`}>
            {sum.toFixed(1)} %
          </span>
        </div>
      </div>

      {/* Enhanced Status Chips (with tooltips) */}
      <div className="mb-3">
        <StatusChips chips={statusChips} />
      </div>

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
      <div className="space-y-3">
        {/* Color-coded asset sliders (PRO visual upgrade) */}
        <AssetSlider
          assetKey="gold"
          pct={goldPct}
          sum={sum}
          controller={goldCtl}
          onCommit={(pct) => commitAsset("gold", pct)}
          testIdSlider={TEST_IDS.GOLD_SLIDER}
          testIdInput={TEST_IDS.GOLD_INPUT}
        />
        <AssetSlider
          assetKey="dyn"
          pct={dynPct}
          sum={sum}
          controller={dynCtl}
          onCommit={(pct) => commitAsset("dyn", pct)}
        />
        <AssetSlider
          assetKey="etf"
          pct={etfPct}
          sum={sum}
          controller={etfCtl}
          onCommit={(pct) => commitAsset("etf", pct)}
        />
        <AssetSlider
          assetKey="bonds"
          pct={bondsPct}
          sum={sum}
          controller={bondsCtl}
          onCommit={(pct) => commitAsset("bonds", pct)}
        />
        <AssetSlider
          assetKey="cash"
          pct={cashPct}
          sum={sum}
          controller={cashCtl}
          onCommit={(pct) => commitAsset("cash", pct)}
        />
        <AssetSlider
          assetKey="crypto"
          pct={cryptoPct}
          sum={sum}
          controller={cryptoCtl}
          onCommit={(pct) => commitAsset("crypto", pct)}
        />
        <AssetSlider
          assetKey="real"
          pct={realPct}
          sum={sum}
          controller={realCtl}
          onCommit={(pct) => commitAsset("real", pct)}
        />
        {/* Dlhopis 3r/13% (PRO only) */}
        {mode === "PRO" && (
          <AssetSlider
            assetKey="bond3y9"
            pct={bond3y9Pct}
            sum={sum}
            controller={bond3y9Ctl}
            onCommit={(pct) => commitAsset("bond3y9", pct)}
          />
        )}
      </div>
      {/* Actions Section - Reorganized for PRO mode clarity */}
      <div className="mt-4 space-y-3">
        {/* Sum indicator + Primary actions */}
        <div className="flex flex-wrap gap-2 items-center">
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
            <span className="tabular-nums">{sum.toFixed(0)}%</span>
          </div>
          <button
            onClick={normalizeAll}
            disabled={Math.abs(sum - 100) < 0.01}
            className="px-3 py-1.5 rounded bg-emerald-600/20 ring-1 ring-emerald-500/40 text-xs font-medium disabled:opacity-50 hover:bg-emerald-600/30 hover:scale-105 active:scale-95 transition-all duration-200 disabled:hover:scale-100"
            title="Normalizuj mix na presne 100 %"
          >
            ✓ Dorovnať
          </button>
          <button
            onClick={applyRecommended}
            className="px-3 py-1.5 rounded bg-blue-600/20 ring-1 ring-blue-500/40 text-xs font-medium hover:bg-blue-600/30 hover:scale-105 active:scale-95 transition-all duration-200"
            title="Aplikuj odporúčaný mix podľa rizikovej preferencie"
          >
            ⭐ Aplikovať odporúčaný mix portfólia
          </button>
        </div>

        {/* Warning chips - inline display of mix/risk warnings */}
        <WarningChips className="mt-3" />

        {/* PRO Actions - organized into logical groups */}
        {mode === "PRO" && (
          <>
            {/* Optimization & Rules */}
            <div className="flex flex-wrap gap-2">
              <div className="text-xs text-slate-400 font-medium w-full mb-1">
                Optimalizácia & pravidlá
              </div>
              <button
                onClick={optimizeRisk}
                className="px-3 py-1.5 rounded bg-violet-600/20 ring-1 ring-violet-500/40 text-xs font-medium hover:bg-violet-600/30 hover:scale-105 active:scale-95 transition-all duration-200"
                title="Maximalizuj výnos pri dodržaní risk cap"
              >
                🎯 Optimalizuj
              </button>
              <button
                onClick={applyRules}
                className="px-3 py-1.5 rounded bg-amber-600/20 ring-1 ring-amber-500/40 text-xs font-medium hover:bg-amber-600/30 hover:scale-105 active:scale-95 transition-all duration-200"
                title="Uprav mix aby dodržiaval limity (Dyn+Krypto ≤22%, Dyn ≤15%)"
              >
                🚦 Upraviť podľa pravidiel
              </button>
            </div>

            {/* Import/Export & Reset */}
            <div className="flex flex-wrap gap-2">
              <div className="text-xs text-slate-400 font-medium w-full mb-1">
                Správa mixu
              </div>
              <button
                onClick={() => {
                  const json = JSON.stringify(mix, null, 2);
                  navigator.clipboard.writeText(json);
                  showToast("✓ Mix skopírovaný do schránky", 2000);
                }}
                className="px-3 py-1.5 rounded bg-slate-700 text-xs font-medium hover:bg-slate-600 hover:scale-105 active:scale-95 transition-all duration-200"
                title="Exportuj mix do schránky (JSON)"
              >
                📋 Export (copy)
              </button>
              <button
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    const parsed = JSON.parse(text);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      // Validate structure
                      const valid = parsed.every(
                        (item: any) =>
                          typeof item === "object" &&
                          "key" in item &&
                          "pct" in item
                      );
                      if (valid) {
                        setMix(parsed as MixItem[]);
                        writeMixManual(parsed);
                        showToast("✓ Mix importovaný", 2000);
                      } else {
                        showToast("❌ Neplatný formát mixu", 2000);
                      }
                    } else {
                      showToast("❌ Neplatný JSON", 2000);
                    }
                  } catch (err) {
                    showToast("❌ Import zlyhal (neplatný JSON)", 2000);
                  }
                }}
                className="px-3 py-1.5 rounded bg-slate-700 text-xs font-medium hover:bg-slate-600 hover:scale-105 active:scale-95 transition-all duration-200"
                title="Importuj mix zo schránky (JSON)"
              >
                📥 Import (paste)
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
                  writeMixManual(seed);
                  showToast("✓ Mix resetovaný", 2000);
                }}
                aria-label="Resetovať hodnoty"
                className="px-3 py-1.5 rounded bg-red-600/20 ring-1 ring-red-500/40 text-xs font-medium hover:bg-red-600/30 hover:scale-105 active:scale-95 transition-all duration-200"
                title="Resetuj mix na počiatočné hodnoty (Gold 5%, ETF 60%, Bonds 20%, atď.)"
              >
                🔄 Resetovať hodnoty
              </button>
            </div>
          </>
        )}
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
                writeMixManual(normalized);
                showToast("Dyn+Krypto dorovnané na 22%", 2000);
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
