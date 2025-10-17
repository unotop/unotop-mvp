import React from "react";

// Stable TEST_IDS used by tests
export const TEST_IDS = {
  ROOT: "clean-root",
  INSIGHTS_WRAP: "insights-wrap",
  GOLD_SLIDER: "slider-gold",
  GOLD_INPUT: "input-gold-number",
  MONTHLY_SLIDER: "slider-monthly",
  CHIPS_STRIP: "scenario-chips",
  SCENARIO_CHIP: "scenario-chip",
  WIZARD_DIALOG: "mini-wizard-dialog",
  WIZARD_ACTION_APPLY: "wizard-apply",
} as const;

interface MixItem {
  key: string;
  pct: number;
}
interface PersistShape {
  mix: MixItem[];
  reserveEur: number;
  reserveMonths: number;
  monthly: number;
}

const KEY_V3_COLON = "unotop:v3";
const KEY_V3_UNDERSCORE = "unotop_v3";

function normalize(list: MixItem[]): MixItem[] {
  const sum = list.reduce((a, b) => a + b.pct, 0);
  if (sum === 0) return list;
  return list.map((i) => ({
    ...i,
    pct: parseFloat(((i.pct / sum) * 100).toFixed(2)),
  }));
}
function setGoldTarget(list: MixItem[], target: number): MixItem[] {
  const gold = list.find((i) => i.key === "gold");
  if (!gold) return list;
  const others = list.filter((i) => i.key !== "gold");
  const remaining = 100 - target;
  const otherSum = others.reduce((a, b) => a + b.pct, 0) || 1;
  const redistributed = others.map((o) => ({
    ...o,
    pct: parseFloat(((o.pct / otherSum) * remaining).toFixed(2)),
  }));
  return normalize([{ ...gold, pct: target }, ...redistributed]);
}
function persist(state: PersistShape) {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(KEY_V3_COLON, json);
    localStorage.setItem(KEY_V3_UNDERSCORE, json);
  } catch {}
}
function readInitial(): PersistShape | null {
  try {
    const raw =
      localStorage.getItem(KEY_V3_COLON) ||
      localStorage.getItem(KEY_V3_UNDERSCORE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const DEFAULT_MIX: MixItem[] = [
  { key: "gold", pct: 8 },
  { key: "dyn", pct: 12 },
  { key: "crypto", pct: 4 },
  { key: "other", pct: 76 },
];

const PULSE_MS = 320;

const AppClean: React.FC = () => {
  const seed = readInitial();
  const [mix, setMix] = React.useState<MixItem[]>(seed?.mix || DEFAULT_MIX);
  const [reserveEur, setReserveEur] = React.useState<number>(
    typeof seed?.reserveEur === "number" ? seed.reserveEur : 500
  );
  const [reserveMonths, setReserveMonths] = React.useState<number>(
    typeof seed?.reserveMonths === "number" ? seed.reserveMonths : 3
  );
  const [monthly, setMonthly] = React.useState<number>(
    typeof seed?.monthly === "number" ? seed.monthly : 200
  );
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [pulseGold, setPulseGold] = React.useState(false);
  const [chips, setChips] = React.useState<string[]>([]);

  const goldSliderRef = React.useRef<HTMLInputElement | null>(null);
  const monthlySliderRef = React.useRef<HTMLInputElement | null>(null);

  const goldPct = mix.find((i) => i.key === "gold")?.pct || 0;
  const dynPct = mix.find((i) => i.key === "dyn")?.pct || 0;
  const cryptoPct = mix.find((i) => i.key === "crypto")?.pct || 0;
  const totalPct = mix.reduce((a, b) => a + b.pct, 0);

  const needsGold = goldPct < 12;
  const needsReserve = reserveEur < 1000 || reserveMonths < 6;

  React.useEffect(
    () => persist({ mix, reserveEur, reserveMonths, monthly }),
    [mix, reserveEur, reserveMonths, monthly]
  );
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && wizardOpen) setWizardOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wizardOpen]);

  function applyGold12() {
    setMix((m) => setGoldTarget(m, 12));
    setWizardOpen(false);
    setPulseGold(true);
    setTimeout(() => setPulseGold(false), PULSE_MS);
    setChips((c) => [...c, "Zlato dorovnané"]);
    setTimeout(() => goldSliderRef.current?.focus(), 0);
  }
  function applyReserveBaseline() {
    setReserveEur((e) => (e < 1000 ? 1000 : e));
    setReserveMonths((m) => (m < 6 ? 6 : m));
    setMonthly((v) => (v < 300 ? 300 : v));
    setWizardOpen(false);
    setChips((c) => [...c, "Rezerva dorovnaná"]);
    monthlySliderRef.current?.focus();
  }
  function updateGold(v: number) {
    setMix((m) =>
      normalize(m.map((a) => (a.key === "gold" ? { ...a, pct: v } : a)))
    );
  }

  const scenarioChips = React.useMemo(() => {
    const list: string[] = [];
    if (goldPct >= 12) list.push("Zlato dorovnané");
    if (dynPct + cryptoPct > 22) list.push("Dyn+Krypto obmedzené");
    if (Math.abs(totalPct - 100) < 0.01) list.push("Súčet dorovnaný");
    return Array.from(new Set([...chips, ...list]));
  }, [chips, goldPct, dynPct, cryptoPct, totalPct]);

  return (
    <div
      aria-label="UNO clean root"
      data-testid={TEST_IDS.ROOT}
      className="p-4 space-y-4"
    >
      <h1 className="text-base font-semibold">Clean Test Harness</h1>
      <section aria-label="Metriky & odporúčania" className="space-y-2">
        <div
          className="flex gap-2 flex-wrap"
          aria-label="Insights"
          data-testid={TEST_IDS.INSIGHTS_WRAP}
        >
          {needsGold && (
            <button
              onClick={() => setWizardOpen(true)}
              className="px-2 py-1 text-xs bg-yellow-100 border rounded"
            >
              Gold 12 %
            </button>
          )}
          {needsReserve && (
            <button
              data-testid="insight-reserve"
              onClick={() => setWizardOpen(true)}
              className="px-2 py-1 text-xs bg-blue-100 border rounded"
            >
              Rezervu doplň
            </button>
          )}
        </div>
      </section>
      <section aria-label="Zloženie portfólia" className="space-y-3">
        <div className="flex items-center gap-2">
          <label htmlFor="gold-slider" className="text-xs">
            Gold
          </label>
          <input
            ref={goldSliderRef}
            id="gold-slider"
            type="range"
            min={0}
            max={40}
            value={goldPct}
            onChange={(e) => updateGold(+e.target.value)}
            data-testid={TEST_IDS.GOLD_SLIDER}
            aria-label="Gold percent slider"
            className={pulseGold ? "animate-pulse" : ""}
          />
          <input
            type="number"
            min={0}
            max={40}
            value={goldPct}
            onChange={(e) => {
              const v = +e.target.value;
              if (!isNaN(v)) updateGold(v);
            }}
            data-testid={TEST_IDS.GOLD_INPUT}
            aria-label="Gold percent (number)"
            className="w-16 border px-1 py-0.5 text-xs"
          />
        </div>
        <div className="flex flex-col gap-2" aria-label="Reserve inputs">
          <label className="text-xs">Súčasná rezerva (EUR)</label>
          <input
            type="number"
            value={reserveEur}
            onChange={(e) => setReserveEur(+e.target.value || 0)}
            aria-label="Súčasná rezerva"
            className="border px-1 py-0.5 w-32 text-xs"
          />
          <label className="text-xs">Rezerva (mesiace)</label>
          <input
            type="number"
            value={reserveMonths}
            onChange={(e) => setReserveMonths(+e.target.value || 0)}
            aria-label="Rezerva (mesiace)"
            className="border px-1 py-0.5 w-32 text-xs"
          />
        </div>
        <div className="flex items-center gap-2" aria-label="Mesačný vklad">
          <label htmlFor="monthly-slider" className="text-xs">
            Mesačný vklad
          </label>
          <input
            ref={monthlySliderRef}
            id="monthly-slider"
            type="range"
            min={0}
            max={2000}
            value={monthly}
            onChange={(e) => setMonthly(+e.target.value)}
            data-testid={TEST_IDS.MONTHLY_SLIDER}
            aria-label="Mesačný vklad – slider"
            className="flex-1"
          />
          <span className="text-[11px] tabular-nums">{monthly} €</span>
        </div>
      </section>
      <div
        data-testid={TEST_IDS.CHIPS_STRIP}
        className="flex gap-2 flex-wrap"
        aria-label="Scenáre"
      >
        {scenarioChips.map((c, i) => (
          <span
            key={i}
            data-testid={TEST_IDS.SCENARIO_CHIP}
            className="px-2 py-0.5 bg-gray-100 text-[11px] border rounded"
            aria-live="polite"
          >
            {c}
          </span>
        ))}
      </div>
      <div data-testid={TEST_IDS.WIZARD_DIALOG} data-open={wizardOpen ? 1 : 0}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mini-wizard odporúčania"
          className={
            wizardOpen
              ? "fixed inset-0 bg-black/30 flex items-center justify-center"
              : "hidden"
          }
        >
          <div className="bg-white p-4 rounded shadow w-72 space-y-3">
            <h2 className="text-sm font-semibold">Mini-wizard odporúčania</h2>
            <div className="space-y-2 text-xs">
              {needsGold && <div>Zlato pod 12 % – dorovnať.</div>}
              {needsReserve && <div>Rezerva pod minimom – upraviť.</div>}
            </div>
            <div className="flex flex-wrap gap-2">
              {(needsGold || needsReserve) && (
                <button
                  onClick={() => {
                    if (needsGold) applyGold12();
                    if (needsReserve) applyReserveBaseline();
                  }}
                  data-testid={TEST_IDS.WIZARD_ACTION_APPLY}
                  className="px-2 py-1 text-xs bg-green-200 border rounded"
                >
                  Použiť odporúčanie
                </button>
              )}
              <button
                onClick={() => setWizardOpen(false)}
                className="px-2 py-1 text-xs border rounded"
              >
                Zavrieť
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppClean;
