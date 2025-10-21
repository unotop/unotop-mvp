import React from "react";
import { writeV3, readV3 } from "../../persist/v3";
import { useUncontrolledValueInput } from "../_hooks/useUncontrolledValueInput";

interface BasicSettingsPanelProps {
  open: boolean;
  onToggle: () => void;
}

/**
 * BasicSettingsPanel - kompaktný all-in-one box pre BASIC režim
 * Obsahuje: Profil klienta, Cashflow, Investičné nastavenia
 */
export const BasicSettingsPanel: React.FC<BasicSettingsPanelProps> = ({
  open,
  onToggle,
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

  // Voľné prostriedky (live calculation)
  const freeCash = monthlyIncome - fixedExp - varExp;

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

          {/* 2. Cashflow */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Cashflow</h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-3">
                <label htmlFor="income-input" className="text-xs w-32 text-slate-400">
                  Mesačný príjem
                </label>
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
                  className="flex-1 px-3 py-2 rounded bg-slate-800 text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="fixed-exp-input" className="text-xs w-32 text-slate-400">
                  Fixné výdavky
                </label>
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
                  className="flex-1 px-3 py-2 rounded bg-slate-800 text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="var-exp-input" className="text-xs w-32 text-slate-400">
                  Variabilné výdavky
                </label>
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
                  className="flex-1 px-3 py-2 rounded bg-slate-800 text-sm"
                />
              </div>

              {/* Voľné prostriedky - výsledok */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-700">
                <span className="text-xs w-32 text-slate-400 font-semibold">
                  Voľné prostriedky
                </span>
                <div
                  className={`flex-1 px-3 py-2 rounded text-sm font-bold ${
                    freeCash >= 0
                      ? "bg-emerald-900/30 text-emerald-300"
                      : "bg-red-900/30 text-red-300"
                  }`}
                >
                  {freeCash.toFixed(0)} €
                </div>
              </div>
            </div>
          </div>

          {/* 3. Investičné nastavenia */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">
              Investičné nastavenia
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-3">
                <label htmlFor="lump-sum-basic" className="text-xs w-40 text-slate-400">
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
                  className="flex-1 px-3 py-2 rounded bg-slate-800 text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="monthly-vklad-basic" className="text-xs w-40 text-slate-400">
                  Mesačný vklad
                </label>
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
                  className="flex-1 px-3 py-2 rounded bg-slate-800 text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="horizon-basic" className="text-xs w-40 text-slate-400">
                  Horizont investovania
                </label>
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
                  className="flex-1 px-3 py-2 rounded bg-slate-800 text-sm"
                  placeholder="roky"
                />
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="goal-basic" className="text-xs w-40 text-slate-400">
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
                  className="flex-1 px-3 py-2 rounded bg-slate-800 text-sm"
                />
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
};
