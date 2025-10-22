import React from "react";
import { writeV3, readV3 } from "../../persist/v3";
import { useUncontrolledValueInput } from "../_hooks/useUncontrolledValueInput";
import { calculateFutureValue } from "../../engine/calculations";
import { approxYieldAnnualFromMix, type RiskPref } from "../mix/assetModel";
import type { MixItem } from "../mix/mix.service";

interface BasicSettingsPanelProps {
  open: boolean;
  onToggle: () => void;
  mix?: MixItem[];
  riskPref?: string;
}

/**
 * BasicSettingsPanel - kompaktný all-in-one box pre BASIC režim
 * Obsahuje: Profil klienta, Cashflow, Investičné nastavenia
 */
export const BasicSettingsPanel: React.FC<BasicSettingsPanelProps> = ({
  open,
  onToggle,
  mix = [],
  riskPref = "vyvazeny",
}) => {
  const seed = readV3();

  // Profil klienta
  const [clientType, setClientType] = React.useState<
    "individual" | "family" | "firm"
  >(() => (seed.profile?.clientType as any) || "individual");

  // Cashflow
  const [monthlyIncome, setMonthlyIncome] = React.useState(
    () => (seed.profile?.monthlyIncome as any) || 0
  );
  const [fixedExp, setFixedExp] = React.useState(
    () => (seed.profile?.fixedExp as any) || 0
  );
  const [varExp, setVarExp] = React.useState(
    () => (seed.profile?.varExp as any) || 0
  );

  // Investičné nastavenia
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

  // Persist helpers
  const persistClientType = (value: "individual" | "family" | "firm") => {
    setClientType(value);
    writeV3({ profile: { clientType: value } });
  };

  // Uncontrolled hooks pre numerické inputy
  const incomeCtl = useUncontrolledValueInput({
    initial: monthlyIncome,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, n),
    commit: (n) => {
      setMonthlyIncome(n);
      const cur = readV3();
      writeV3({ profile: { ...(cur.profile || {}), monthlyIncome: n } as any });
    },
  });

  const fixedExpCtl = useUncontrolledValueInput({
    initial: fixedExp,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, n),
    commit: (n) => {
      setFixedExp(n);
      const cur = readV3();
      writeV3({ profile: { ...(cur.profile || {}), fixedExp: n } as any });
    },
  });

  const varExpCtl = useUncontrolledValueInput({
    initial: varExp,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, n),
    commit: (n) => {
      setVarExp(n);
      const cur = readV3();
      writeV3({ profile: { ...(cur.profile || {}), varExp: n } as any });
    },
  });

  const lumpSumCtl = useUncontrolledValueInput({
    initial: lumpSumEur,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) => Math.max(0, Math.min(n, 1000000)), // Cap na 1M €
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

  // Voľné prostriedky (live calculation)
  const freeCash = monthlyIncome - fixedExp - varExp;

  // FV (Future Value) - konečná hodnota investície
  const fv = React.useMemo(() => {
    if (horizonYears <= 0) return 0;

    // Validácia riskPref
    const validRiskPref =
      riskPref === "konzervativny" ||
      riskPref === "rastovy" ||
      riskPref === "vyvazeny"
        ? (riskPref as RiskPref)
        : "vyvazeny";

    // Použiť mix-based yield (rovnako ako v projekcii)
    const approxYield =
      Array.isArray(mix) && mix.length > 0
        ? approxYieldAnnualFromMix(mix, validRiskPref)
        : 0.06; // fallback ak mix je prázdny

    return calculateFutureValue(
      lumpSumEur,
      monthlyVklad,
      horizonYears,
      approxYield
    );
  }, [lumpSumEur, monthlyVklad, horizonYears, mix, riskPref]);

  return (
    <>
      <button
        type="button"
        aria-controls="basic-settings"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-3 rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors text-left font-semibold"
      >
        <span id="basic-settings-title">⚙️ Nastavenia</span>
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
          id="basic-settings"
          role="region"
          aria-labelledby="basic-settings-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-5 transition-all duration-300 space-y-6"
        >
          {/* 1. Profil klienta - kompaktný inline */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">
              Profil klienta
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => persistClientType("individual")}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  clientType === "individual"
                    ? "bg-blue-600 text-white ring-2 ring-blue-400"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
                aria-pressed={clientType === "individual"}
              >
                👤 Jednotlivec
              </button>
              <button
                type="button"
                onClick={() => persistClientType("family")}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  clientType === "family"
                    ? "bg-blue-600 text-white ring-2 ring-blue-400"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
                aria-pressed={clientType === "family"}
              >
                👨‍👩‍👧 Rodina
              </button>
              <button
                type="button"
                onClick={() => persistClientType("firm")}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  clientType === "firm"
                    ? "bg-blue-600 text-white ring-2 ring-blue-400"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
                aria-pressed={clientType === "firm"}
              >
                🏢 Firma
              </button>
            </div>
          </div>

          {/* 2. Cashflow + Investície (2-column grid na desktop) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Ľavý stĺpec: Cashflow */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">Cashflow</h3>
              <div className="grid grid-cols-1 gap-3">
                {/* Mesačný príjem: textbox + slider */}
                <div className="space-y-2">
                  <label
                    htmlFor="income-input"
                    className="text-xs text-slate-400 block"
                  >
                    Mesačný príjem
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="income-input"
                      type="text"
                      role="textbox"
                      inputMode="decimal"
                      aria-label="Mesačný príjem"
                      ref={incomeCtl.ref}
                      onChange={incomeCtl.onChange}
                      onBlur={incomeCtl.onBlur}
                      defaultValue={incomeCtl.defaultValue}
                      className="w-24 px-2 py-1 rounded bg-slate-800 text-sm"
                    />
                    <input
                      type="range"
                      min={0}
                      max={10000}
                      step={100}
                      value={monthlyIncome}
                      onChange={(e) => {
                        const val = Number(e.currentTarget.value);
                        setMonthlyIncome(val);
                        incomeCtl.syncToDom(val); // Sync textbox
                        const cur = readV3();
                        writeV3({
                          profile: {
                            ...(cur.profile || {}),
                            monthlyIncome: val,
                          } as any,
                        });
                      }}
                      aria-label="Mesačný príjem slider"
                      className="flex-1"
                    />
                    <span className="text-sm tabular-nums font-semibold w-20 text-right">
                      {monthlyIncome} €
                    </span>
                  </div>
                </div>
                {/* Fixné výdavky: textbox + slider */}
                <div className="space-y-2">
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
                      ref={fixedExpCtl.ref}
                      onChange={fixedExpCtl.onChange}
                      onBlur={fixedExpCtl.onBlur}
                      defaultValue={fixedExpCtl.defaultValue}
                      className="w-24 px-2 py-1 rounded bg-slate-800 text-sm"
                    />
                    <input
                      type="range"
                      min={0}
                      max={5000}
                      step={50}
                      value={fixedExp}
                      onChange={(e) => {
                        const val = Number(e.currentTarget.value);
                        setFixedExp(val);
                        fixedExpCtl.syncToDom(val); // Sync textbox
                        const cur = readV3();
                        writeV3({
                          profile: {
                            ...(cur.profile || {}),
                            fixedExp: val,
                          } as any,
                        });
                      }}
                      aria-label="Fixné výdavky slider"
                      className="flex-1"
                    />
                    <span className="text-sm tabular-nums font-semibold w-20 text-right">
                      {fixedExp} €
                    </span>
                  </div>
                </div>
                {/* Variabilné výdavky: textbox + slider */}
                <div className="space-y-2">
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
                      ref={varExpCtl.ref}
                      onChange={varExpCtl.onChange}
                      onBlur={varExpCtl.onBlur}
                      defaultValue={varExpCtl.defaultValue}
                      className="w-24 px-2 py-1 rounded bg-slate-800 text-sm"
                    />
                    <input
                      type="range"
                      min={0}
                      max={3000}
                      step={50}
                      value={varExp}
                      onChange={(e) => {
                        const val = Number(e.currentTarget.value);
                        setVarExp(val);
                        varExpCtl.syncToDom(val); // Sync textbox
                        const cur = readV3();
                        writeV3({
                          profile: {
                            ...(cur.profile || {}),
                            varExp: val,
                          } as any,
                        });
                      }}
                      aria-label="Variabilné výdavky slider"
                      className="flex-1"
                    />
                    <span className="text-sm tabular-nums font-semibold w-20 text-right">
                      {varExp} €
                    </span>
                  </div>
                </div>

                {/* Pridať dlh button */}
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      const message =
                        "Pre správu dlhov prepnite do PRO režimu.\n\n" +
                        "V PRO režime môžete:\n" +
                        "• Pridávať hypotéky a spotrebné úvery\n" +
                        "• Sledovať zostatok a splátky\n" +
                        "• Plánovať rýchlejšie splatenie";
                      alert(message);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 transition-colors text-sm font-medium text-slate-200"
                  >
                    <span>💳</span>
                    <span>Pridať dlh alebo hypotéku</span>
                  </button>
                </div>

                {/* Voľné prostriedky - kompaktný box */}
                <div className="pt-2">
                  <div
                    className={`px-3 py-2 rounded-lg ${
                      freeCash >= 0
                        ? "bg-emerald-900/30 text-emerald-300"
                        : "bg-red-900/30 text-red-300"
                    }`}
                  >
                    <div className="text-xs text-slate-400 mb-0.5">
                      Voľné prostriedky
                    </div>
                    <div className="text-lg tabular-nums font-bold">
                      {freeCash.toFixed(0)} €/mes
                    </div>
                  </div>
                </div>
              </div>
              {/* Koniec ľavého stĺpca */}
            </div>

            {/* Pravý stĺpec: Investičné nastavenia */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">
                Investičné nastavenia
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {/* Jednorazová investícia - len textbox (nie často mení) */}
                <div className="space-y-2">
                  <label
                    htmlFor="lump-sum-basic"
                    className="text-xs text-slate-400 block"
                  >
                    Jednorazová investícia
                  </label>
                  <input
                    id="lump-sum-basic"
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
                {/* Mesačný vklad - textbox + slider */}
                <div className="space-y-2">
                  <label
                    htmlFor="monthly-vklad-basic"
                    className="text-xs text-slate-400 block"
                  >
                    Mesačný vklad
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="monthly-vklad-basic"
                      type="text"
                      role="textbox"
                      inputMode="decimal"
                      aria-label="Mesačný vklad"
                      ref={monthlyVkladCtl.ref}
                      onChange={monthlyVkladCtl.onChange}
                      onBlur={monthlyVkladCtl.onBlur}
                      defaultValue={monthlyVkladCtl.defaultValue}
                      className="w-24 px-2 py-1 rounded bg-slate-800 text-sm"
                    />
                    <input
                      type="range"
                      min={0}
                      max={5000}
                      step={50}
                      value={monthlyVklad}
                      onChange={(e) => {
                        const val = Number(e.currentTarget.value);
                        setMonthlyVklad(val);
                        monthlyVkladCtl.syncToDom(val); // Sync textbox
                        writeV3({ monthly: val });
                      }}
                      aria-label="Mesačný vklad slider"
                      className="flex-1"
                    />
                    <span className="text-sm tabular-nums font-semibold w-20 text-right">
                      {monthlyVklad} €
                    </span>
                  </div>
                </div>
                {/* Horizont - textbox + slider */}
                <div className="space-y-2">
                  <label
                    htmlFor="horizon-basic"
                    className="text-xs text-slate-400 block"
                  >
                    Horizont investovania (roky)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="horizon-basic"
                      type="text"
                      role="textbox"
                      inputMode="decimal"
                      aria-label="Horizont investovania (roky)"
                      ref={horizonCtl.ref}
                      onChange={horizonCtl.onChange}
                      onBlur={horizonCtl.onBlur}
                      defaultValue={horizonCtl.defaultValue}
                      className="w-24 px-2 py-1 rounded bg-slate-800 text-sm"
                    />
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={horizonYears}
                      onChange={(e) => {
                        const val = Number(e.currentTarget.value);
                        setHorizonYears(val);
                        horizonCtl.syncToDom(val); // Sync textbox
                        const cur = readV3();
                        writeV3({
                          profile: {
                            ...(cur.profile || {}),
                            horizonYears: val,
                          } as any,
                        });
                      }}
                      aria-label="Horizont slider"
                      className="flex-1"
                    />
                    <span className="text-sm tabular-nums font-semibold w-20 text-right">
                      {horizonYears} r.
                    </span>
                  </div>
                </div>
                {/* Cieľ majetku - len textbox (veľké čísla) */}
                <div className="space-y-2">
                  <label
                    htmlFor="goal-basic"
                    className="text-xs text-slate-400 block"
                  >
                    Cieľ majetku
                  </label>
                  <input
                    id="goal-basic"
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

                {/* FV (Future Value) - konečná hodnota investície */}
                <div className="pt-2">
                  <div className="px-3 py-2 rounded-lg bg-blue-900/30 text-blue-300 ring-1 ring-blue-500/20">
                    <div className="text-xs text-slate-400 mb-0.5">
                      Konečná hodnota (za {horizonYears}r)
                    </div>
                    <div className="text-lg tabular-nums font-bold">
                      {fv.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €
                    </div>
                  </div>
                </div>
              </div>
              {/* Koniec pravého stĺpca */}
            </div>
          </div>
          {/* Koniec 2-column grid */}
        </section>
      )}
    </>
  );
};
