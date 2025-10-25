import React from "react";
import { writeV3, readV3 } from "../../persist/v3";
import { useUncontrolledValueInput } from "../_hooks/useUncontrolledValueInput";
import { calculateFutureValue } from "../../engine/calculations";
import { approxYieldAnnualFromMix, type RiskPref } from "../mix/assetModel";
import type { MixItem } from "../mix/mix.service";
import type { ValidationState } from "../../utils/validation";
import { WarningCenter } from "../ui/warnings/WarningCenter";

interface BasicSettingsPanelProps {
  open: boolean;
  onToggle: () => void;
  mix?: MixItem[];
  riskPref?: string;
  validationState?: ValidationState;
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
  validationState,
}) => {
  const seed = readV3();

  // Profil klienta
  const [clientType, setClientType] = React.useState<
    "individual" | "family" | "firm"
  >(() => (seed.profile?.clientType as any) || "individual");

  // Warning modal pre zmenu profilu
  const [showProfileWarning, setShowProfileWarning] = React.useState(false);
  const [pendingClientType, setPendingClientType] = React.useState<
    "individual" | "family" | "firm" | null
  >(null);

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
    // Ak už má nastavené hodnoty, zobraz warning
    const hasSettings =
      monthlyIncome > 0 ||
      lumpSumEur > 0 ||
      monthlyVklad > 0 ||
      goalAssetsEur > 0 ||
      horizonYears !== 10;

    if (hasSettings && value !== clientType) {
      setPendingClientType(value);
      setShowProfileWarning(true);
      return;
    }

    // Priamy presun bez warningu
    setClientType(value);
    writeV3({ profile: { clientType: value } });
  };

  const confirmProfileChange = () => {
    if (!pendingClientType) return;

    // Reset všetkých hodnôt
    setMonthlyIncome(0);
    setFixedExp(0);
    setVarExp(0);
    setLumpSumEur(0);
    setMonthlyVklad(0);
    setHorizonYears(10);
    setGoalAssetsEur(0);

    // Aktualizuj clientType
    setClientType(pendingClientType);

    // Persist reset (včítane rezervy)
    writeV3({
      profile: {
        clientType: pendingClientType,
        monthlyIncome: 0,
        fixedExp: 0,
        varExp: 0,
        lumpSumEur: 0,
        horizonYears: 10,
        goalAssetsEur: 0,
      } as any,
      monthly: 0,
      reserveEur: 0,
      reserveMonths: 0,
    });

    // PR-11 FIX: Reset uncontrolled inputs (visual clear)
    incomeCtl.syncToDom(0);
    fixedExpCtl.syncToDom(0);
    varExpCtl.syncToDom(0);
    lumpSumCtl.syncToDom(0);
    monthlyVkladCtl.syncToDom(0);
    horizonCtl.syncToDom(10);
    goalCtl.syncToDom(0);

    // Zatvor modal
    setShowProfileWarning(false);
    setPendingClientType(null);
  };

  // Uncontrolled hooks pre numerické inputy
  const incomeCtl = useUncontrolledValueInput({
    initial: monthlyIncome,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) =>
      Math.max(0, Math.min(clientType === "firm" ? 50000 : 10000, n)),
    commit: (n) => {
      setMonthlyIncome(n);
      const cur = readV3();
      writeV3({ profile: { ...(cur.profile || {}), monthlyIncome: n } as any });
    },
  });

  const fixedExpCtl = useUncontrolledValueInput({
    initial: fixedExp,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) =>
      Math.max(0, Math.min(clientType === "firm" ? 50000 : 10000, n)),
    commit: (n) => {
      setFixedExp(n);
      const cur = readV3();
      writeV3({ profile: { ...(cur.profile || {}), fixedExp: n } as any });
    },
  });

  const varExpCtl = useUncontrolledValueInput({
    initial: varExp,
    parse: (r) => Number(r.replace(",", ".")) || 0,
    clamp: (n) =>
      Math.max(0, Math.min(clientType === "firm" ? 50000 : 10000, n)),
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
    clamp: (n) => Math.max(0, Math.min(n, 100_000_000_000)), // Max 100 miliárd
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
            <div id="sec1" className="space-y-3">
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
                      max={clientType === "firm" ? 50000 : 10000}
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
                      aria-valuemin={0}
                      aria-valuemax={clientType === "firm" ? 50000 : 10000}
                      aria-valuenow={monthlyIncome}
                      aria-valuetext={`${monthlyIncome.toLocaleString("sk-SK")} eur`}
                      className="flex-1"
                    />
                    <span className="text-sm tabular-nums font-semibold w-20 text-right">
                      {monthlyIncome.toLocaleString("sk-SK")} €
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
                    {!validationState?.hasIncome && (
                      <span className="ml-1 text-amber-400 text-xs">
                        (Najprv nastavte príjem)
                      </span>
                    )}
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
                      disabled={!validationState?.hasIncome}
                      className="w-24 px-2 py-1 rounded bg-slate-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <input
                      type="range"
                      min={0}
                      max={clientType === "firm" ? 50000 : 5000}
                      step={50}
                      value={fixedExp}
                      disabled={!validationState?.hasIncome}
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
                      aria-valuemin={0}
                      aria-valuemax={clientType === "firm" ? 50000 : 5000}
                      aria-valuenow={fixedExp}
                      aria-valuetext={`${fixedExp.toLocaleString("sk-SK")} eur`}
                      className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm tabular-nums font-semibold w-20 text-right">
                      {fixedExp.toLocaleString("sk-SK")} €
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
                    {!validationState?.hasIncome && (
                      <span className="ml-1 text-amber-400 text-xs">
                        (Najprv nastavte príjem)
                      </span>
                    )}
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
                      disabled={!validationState?.hasIncome}
                      className="w-24 px-2 py-1 rounded bg-slate-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <input
                      type="range"
                      min={0}
                      max={clientType === "firm" ? 50000 : 3000}
                      step={50}
                      value={varExp}
                      disabled={!validationState?.hasIncome}
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
                      aria-valuemin={0}
                      aria-valuemax={clientType === "firm" ? 50000 : 3000}
                      aria-valuenow={varExp}
                      aria-valuetext={`${varExp.toLocaleString("sk-SK")} eur`}
                      className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm tabular-nums font-semibold w-20 text-right">
                      {varExp.toLocaleString("sk-SK")} €
                    </span>
                  </div>
                </div>

                {/* Spacer pre zarovnanie s Cieľ majetku v pravom stĺpci */}
                <div className="space-y-2">
                  <div style={{ height: "40px" }}></div>
                </div>

                {/* Pridať dlh button - NAD Voľné prostriedky */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      const message =
                        "Pre správu dlhov prepnite do PRO režimu.\n\n" +
                        "V PRO režime môžete:\n" +
                        "• Pridávať hypotéky a spotrebné úvery\n" +
                        "• Sledovať zostatok a splátky\n" +
                        "• Plánovať rýchlejšie splatenie";
                      WarningCenter.push({
                        type: "info",
                        message,
                        scope: "global",
                        dedupeKey: "pro-mode-info",
                      });
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 transition-colors text-sm font-medium text-slate-200"
                  >
                    <span>💳</span>
                    <span>Pridať dlh alebo hypotéku</span>
                  </button>
                </div>

                {/* Voľné prostriedky - kompaktný box (zarovnaný s Konečná hodnota) */}
                <div>
                  <div
                    className={`px-3 py-2 rounded-lg ring-1 ${
                      freeCash >= 0
                        ? "bg-emerald-900/30 text-emerald-300 ring-emerald-500/20"
                        : "bg-red-900/30 text-red-300 ring-red-500/20"
                    }`}
                  >
                    <div className="text-xs text-slate-400 mb-0.5">
                      Voľné prostriedky
                    </div>
                    <div className="text-lg tabular-nums font-bold">
                      {Math.round(freeCash).toLocaleString("sk-SK")} €/mes
                    </div>
                  </div>
                </div>
              </div>
              {/* Koniec ľavého stĺpca */}
            </div>

            {/* Pravý stĺpec: Investičné nastavenia */}
            <div id="sec2" className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">
                Investičné nastavenia
                {!validationState?.cashflowComplete && (
                  <span className="ml-1 text-amber-400 text-xs font-normal">
                    (dokončite cashflow)
                  </span>
                )}
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
                    disabled={!validationState?.cashflowComplete}
                    className="w-full px-3 py-2 rounded bg-slate-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                {/* Mesačný vklad - textbox + slider */}
                <div className="space-y-2">
                  <label
                    htmlFor="monthly-vklad-basic"
                    className="text-xs text-slate-400 block"
                  >
                    Mesačný vklad
                    {validationState?.isLosingMoney && (
                      <span className="ml-1 text-red-400 text-xs">
                        (výdavky prekračujú príjem!)
                      </span>
                    )}
                    {!validationState?.isLosingMoney &&
                      validationState?.cashflowComplete &&
                      validationState.freeCash < monthlyVklad && (
                        <span className="ml-1 text-red-400 text-xs">
                          (max {validationState.freeCash} €)
                        </span>
                      )}
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
                      disabled={
                        !validationState?.cashflowComplete ||
                        !validationState?.hasPositiveFreeCash
                      }
                      className="w-24 px-2 py-1 rounded bg-slate-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <input
                      type="range"
                      min={0}
                      max={Math.min(
                        5000,
                        validationState?.monthlyVkladMax || 5000
                      )}
                      step={50}
                      value={monthlyVklad}
                      disabled={
                        !validationState?.cashflowComplete ||
                        !validationState?.hasPositiveFreeCash
                      }
                      onChange={(e) => {
                        const val = Number(e.currentTarget.value);
                        setMonthlyVklad(val);
                        monthlyVkladCtl.syncToDom(val); // Sync textbox
                        writeV3({ monthly: val });
                      }}
                      aria-label="Mesačný vklad slider"
                      aria-valuemin={0}
                      aria-valuemax={Math.min(
                        5000,
                        validationState?.monthlyVkladMax || 5000
                      )}
                      aria-valuenow={monthlyVklad}
                      aria-valuetext={`${monthlyVklad.toLocaleString("sk-SK")} eur`}
                      className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm tabular-nums font-semibold w-20 text-right">
                      {monthlyVklad.toLocaleString("sk-SK")} €
                    </span>
                  </div>
                  {validationState?.isLosingMoney && (
                    <p className="text-xs text-amber-400 mt-1 flex items-start gap-1">
                      <span>⚠️</span>
                      <span>
                        Vaše výdavky presahujú príjem. Zvážte optimalizáciu
                        rozpočtu pre zdravú finančnú situáciu.
                      </span>
                    </p>
                  )}
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
                      disabled={!validationState?.cashflowComplete}
                      className="w-24 px-2 py-1 rounded bg-slate-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={horizonYears}
                      disabled={!validationState?.cashflowComplete}
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
                      aria-valuemin={1}
                      aria-valuemax={50}
                      aria-valuenow={horizonYears}
                      aria-valuetext={`${horizonYears} rokov`}
                      className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm tabular-nums font-semibold w-20 text-right">
                      {horizonYears} r.
                    </span>
                  </div>
                </div>
                {/* Cieľ majetku - zvýraznený (dôležitý), disabled until cashflow complete */}
                <div className="space-y-2 p-3 rounded-lg ring-2 ring-amber-500/40 bg-amber-900/10">
                  <label
                    htmlFor="goal-basic"
                    className="text-xs font-semibold text-amber-400 block flex items-center gap-1"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Cieľ majetku
                    {validationState?.cashflowComplete &&
                      goalAssetsEur === 0 && (
                        <span className="ml-2 text-xs font-normal text-amber-300">
                          (potrebné vyplniť)
                        </span>
                      )}
                  </label>
                  <input
                    id="goal-basic"
                    type="text"
                    role="textbox"
                    inputMode="decimal"
                    aria-label="Cieľ majetku"
                    placeholder="Napr. 100000"
                    ref={goalCtl.ref}
                    onChange={goalCtl.onChange}
                    onBlur={goalCtl.onBlur}
                    defaultValue={goalCtl.defaultValue}
                    disabled={!validationState?.cashflowComplete}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 text-sm font-semibold ring-1 ring-amber-500/30 focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* FV (Future Value) - konečná hodnota investície (zarovnaný s Voľné prostriedky) */}
                <div>
                  <div className="px-3 py-2 rounded-lg bg-blue-900/30 text-blue-300 ring-1 ring-blue-500/20">
                    <div className="text-xs text-slate-400 mb-0.5">
                      Konečná hodnota (za {horizonYears}r)
                    </div>
                    <div className="text-lg tabular-nums font-bold">
                      {Math.round(fv).toLocaleString("sk-SK")} €
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

      {/* Warning modal pri zmene profilu */}
      {showProfileWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => {
            setShowProfileWarning(false);
            setPendingClientType(null);
          }}
        >
          <div
            className="bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-warning-title"
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">⚠️</span>
              <div className="flex-1">
                <h3
                  id="profile-warning-title"
                  className="text-lg font-bold text-white mb-2"
                >
                  Zmena profilu klienta
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Vaše doterajšie nastavenie bude pri zmene profilu{" "}
                  <strong>resetované</strong>. Všetky vyplnené hodnoty (príjem,
                  výdavky, investície) sa vymažú. Naozaj si želáte pokračovať?
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowProfileWarning(false);
                  setPendingClientType(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors"
              >
                Zrušiť
              </button>
              <button
                type="button"
                onClick={confirmProfileChange}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 transition-colors"
              >
                Áno, resetovať
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
