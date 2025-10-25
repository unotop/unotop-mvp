# UNOTOP MVP - Kompletný Kód Snapshot (Časť 3: Features & Sections)

**Pokračovanie z časti 2...**

---

## 7. FEATURE COMPONENTS (Sekcie aplikácie)

### src/features/profile/ProfileSection.tsx

```tsx
import React from "react";
import { writeV3, readV3 } from "../../persist/v3";

interface ProfileSectionProps {
  open: boolean;
  onToggle: () => void;
  onDebtOpen: () => void;
}

/**
 * ProfileSection (sec0: Profil klienta)
 * Client type, risk preference, crisis bias configuration
 */
export const ProfileSection: React.FC<ProfileSectionProps> = ({
  open,
  onToggle,
  onDebtOpen,
}) => {
  const seed = readV3();

  const [clientType, setClientType] = React.useState<
    "individual" | "family" | "firm"
  >(() => (seed.profile?.clientType as any) || "individual");

  const [riskPref, setRiskPref] = React.useState<string>(
    () => seed.profile?.riskPref || (seed as any).riskPref || "vyvazeny"
  );

  const [crisisBias, setCrisisBias] = React.useState<number>(
    () => (seed.profile?.crisisBias as any) ?? (seed as any).crisisBias ?? 0
  );

  const persistClientType = (value: "individual" | "family" | "firm") => {
    setClientType(value);
    const cur = readV3();
    writeV3({ profile: { ...(cur.profile || {}), clientType: value } as any });
  };

  const persistRiskPref = (value: string) => {
    setRiskPref(value);
    const cur = readV3();
    writeV3({ profile: { ...(cur.profile || {}), riskPref: value } as any });
  };

  const persistCrisisBias = (value: number) => {
    setCrisisBias(value);
    const cur = readV3();
    writeV3({ profile: { ...(cur.profile || {}), crisisBias: value } as any });
  };

  return (
    <>
      <button
        type="button"
        aria-controls="sec0"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-3 rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors text-left font-semibold"
      >
        <span id="profile-title">Profil klienta</span>
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${open ? "" : "rotate-180"}`}
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

      {open && (
        <section
          id="sec0"
          role="region"
          aria-labelledby="profile-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5"
        >
          <div className="space-y-4">
            {/* Typ klienta + Risk preferencia */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            {/* Krízový bias + Úver button */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
              <div className="space-y-2">
                <label
                  htmlFor="crisis-bias-slider"
                  className="text-xs text-slate-400 block"
                >
                  Krízový bias (0 až 3)
                </label>
                <div className="flex items-center gap-3 max-w-xs">
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
                    className="flex-1"
                    aria-label="Krízový bias (0 až 3)"
                  />
                  <span className="text-sm font-semibold tabular-nums w-8 text-center">
                    {crisisBias}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onDebtOpen}
                className="px-4 py-2 rounded-lg bg-amber-600/20 ring-1 ring-amber-500/40 text-sm font-medium hover:bg-amber-600/30 transition-colors whitespace-nowrap"
              >
                💳 Mám úver
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
};
```

### src/features/invest/InvestSection.tsx

```tsx
import React from "react";
import { writeV3, readV3 } from "../../persist/v3";
import { useUncontrolledValueInput } from "../_hooks/useUncontrolledValueInput";

interface InvestSectionProps {
  open: boolean;
  onToggle: () => void;
}

/**
 * InvestSection (sec2: Investičné nastavenia)
 * Investment parameters: lump sum, monthly contribution, horizon, goal
 */
export const InvestSection: React.FC<InvestSectionProps> = ({
  open,
  onToggle,
}) => {
  const seed = readV3();

  const [lumpSumEur, setLumpSumEur] = React.useState(
    () => (seed.profile?.lumpSumEur as any) || 0
  );
  const [horizonYears, setHorizonYears] = React.useState(
    () => (seed.profile?.horizonYears as any) || 10
  );
  const [goalAssetsEur, setGoalAssetsEur] = React.useState(
    () => (seed.profile?.goalAssetsEur as any) || 0
  );

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
    clamp: (n) => Math.max(0, Math.min(n, 100_000_000_000)),
    commit: (n) => {
      setGoalAssetsEur(n);
      const cur = readV3();
      writeV3({ profile: { ...(cur.profile || {}), goalAssetsEur: n } as any });
    },
  });

  return (
    <>
      <button
        type="button"
        aria-controls="sec2"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-3 rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors text-left font-semibold"
      >
        <span id="invest-title">Investičné nastavenia</span>
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${open ? "" : "rotate-180"}`}
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

      {open && (
        <section
          id="sec2"
          role="region"
          aria-labelledby="invest-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5"
        >
          {/* Visual cards (2×2 grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Jednorazová investícia */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/60 to-slate-800/40 ring-1 ring-white/5 hover:ring-emerald-500/40 transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">💰</span>
                <label
                  htmlFor="lump-sum-input"
                  className="text-sm font-semibold text-slate-200"
                >
                  Jednorazová investícia
                </label>
              </div>
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
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 ring-1 ring-white/5 text-sm focus:ring-2 focus:ring-emerald-500/50"
                placeholder="0 €"
              />
            </div>

            {/* Horizont */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/60 to-slate-800/40 ring-1 ring-white/5 hover:ring-blue-500/40 transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📅</span>
                <label
                  htmlFor="horizon-input"
                  className="text-sm font-semibold text-slate-200"
                >
                  Horizont
                </label>
              </div>
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
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 ring-1 ring-white/5 text-sm focus:ring-2 focus:ring-blue-500/50"
                placeholder="10 rokov"
              />
            </div>

            {/* Cieľ majetku */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/60 to-slate-800/40 ring-1 ring-white/5 hover:ring-violet-500/40 transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🎯</span>
                <label
                  htmlFor="goal-input"
                  className="text-sm font-semibold text-slate-200"
                >
                  Cieľ majetku
                </label>
              </div>
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
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 ring-1 ring-white/5 text-sm focus:ring-2 focus:ring-violet-500/50"
                placeholder="0 €"
              />
            </div>
          </div>
        </section>
      )}
    </>
  );
};
```

### src/features/overview/ProjectionMetricsPanel.tsx

```tsx
import React from "react";
import { readV3, type Debt } from "../../persist/v3";
import { ProjectionChart } from "../projection/ProjectionChart";
import { MetricsSection } from "../metrics/MetricsSection";
import type { MixItem } from "../mix/mix.service";

interface ProjectionMetricsPanelProps {
  mix: MixItem[];
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  goalAssetsEur: number;
  riskPref: "konzervativny" | "vyvazeny" | "rastovy";
  mode?: "BASIC" | "PRO";
}

/**
 * ProjectionMetricsPanel - spojený sec4 + sec5 (oba režimy)
 * Hore: Projekcia (graf FV), Dole: Metriky (riziko, výnos, progres)
 */
export const ProjectionMetricsPanel: React.FC<ProjectionMetricsPanelProps> = ({
  mix,
  lumpSumEur,
  monthlyVklad,
  horizonYears,
  goalAssetsEur,
  riskPref,
  mode = "PRO",
}) => {
  const debts = (readV3().debts || []) as Debt[];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-100 px-2">
        📈 Projekcia & Metriky
      </h2>

      {/* Projekcia (graf) */}
      <div className="rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4">
        <ProjectionChart
          mix={mix}
          debts={debts}
          lumpSumEur={lumpSumEur}
          monthlyVklad={monthlyVklad}
          horizonYears={horizonYears}
          goalAssetsEur={goalAssetsEur}
          riskPref={riskPref}
          hideDebts={mode === "BASIC"}
        />
      </div>

      {/* Metriky */}
      <div className="rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4">
        <MetricsSection
          lumpSumEur={lumpSumEur}
          monthlyVklad={monthlyVklad}
          horizonYears={horizonYears}
          goalAssetsEur={goalAssetsEur}
          riskPref={riskPref}
        />
      </div>
    </div>
  );
};
```

---

## 8. UTILITY HOOKS

### src/features/\_hooks/useUncontrolledValueInput.ts

```typescript
import React from "react";

interface UseUncontrolledValueInputOpts {
  initial: number;
  parse: (raw: string) => number;
  clamp: (val: number) => number;
  commit: (val: number) => void;
  debounceMs?: number;
}

/**
 * Hook for uncontrolled text inputs with delayed commit (debounce)
 * Usage: lumpSum, horizon, goal textboxes
 */
export function useUncontrolledValueInput(opts: UseUncontrolledValueInputOpts) {
  const { initial, parse, clamp, commit, debounceMs = 120 } = opts;
  const ref = React.useRef<HTMLInputElement | null>(null);
  const timerRef = React.useRef<number | undefined>(undefined);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Clear debounce timer on change
    if (timerRef.current) clearTimeout(timerRef.current);
    // Start new debounce
    timerRef.current = window.setTimeout(() => {
      const raw = e.currentTarget.value;
      const num = clamp(parse(raw));
      commit(num);
    }, debounceMs);
  };

  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Force immediate commit on blur (cancel debounce)
    if (timerRef.current) clearTimeout(timerRef.current);
    const raw = e.currentTarget.value;
    const num = clamp(parse(raw));
    commit(num);
  };

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    ref,
    onChange,
    onBlur,
    defaultValue: initial.toString(),
  };
}
```

---

**Pokračovanie v časti 4 (LegacyApp.tsx hlavný súbor)...**
