import React from "react";

/** -----------------------------
 *  Mini infra: persist V3 (colon + underscore mirror)
 *  ----------------------------- */
type RiskPref = "konzervativny" | "vyvazeny" | "rastovy";
type MixKey = "gold" | "dyn" | "etf" | "bond" | "cash" | "crypto" | "reality";
type MixItem = { key: MixKey; label: string; pct: number };
type Debt = { name: string; principal: number; ratePa: number; payment: number; monthsLeft?: number };

type V3State = {
  mix: MixItem[];
  reserveEur: number;
  reserveMonths: number;
  monthly: number;
  profile: { riskPref: RiskPref };
  debts: Debt[];
};

const KEY_V3_COLON = "unotop:v3";
const KEY_V3_UNDERSCORE = "unotop_v3";

const DEFAULT_MIX: MixItem[] = [
  { key: "gold",    label: "Zlato (fyzické)",             pct: 5 },
  { key: "dyn",     label: "Dynamické riadenie",           pct: 0 },
  { key: "etf",     label: "ETF (svet – aktívne)",         pct: 60 },
  { key: "bond",    label: "Garantovaný dlhopis 7,5% p.a.",pct: 20 },
  { key: "cash",    label: "Hotovosť/rezerva",             pct: 5 },
  { key: "crypto",  label: "Krypto (BTC/ETH)",             pct: 0 },
  { key: "reality", label: "Reality (komerčné)",           pct: 0 },
];

const DEFAULT_V3: V3State = {
  mix: DEFAULT_MIX,
  reserveEur: 500,
  reserveMonths: 3,
  monthly: 0,
  profile: { riskPref: "vyvazeny" },
  debts: [],
};

function readV3(): V3State {
  try {
    const raw = localStorage.getItem(KEY_V3_COLON) || localStorage.getItem(KEY_V3_UNDERSCORE);
    if (!raw) return DEFAULT_V3;
    const parsed = JSON.parse(raw);
    // mäkký merge s defaultmi – aby nikdy nechýbali kľúče
    return {
      ...DEFAULT_V3,
      ...parsed,
      mix: Array.isArray(parsed?.mix) ? parsed.mix : DEFAULT_MIX,
      profile: { ...DEFAULT_V3.profile, ...(parsed?.profile ?? {}) },
      debts: Array.isArray(parsed?.debts) ? parsed.debts : [],
    };
  } catch {
    return DEFAULT_V3;
  }
}

function writeV3(patch: Partial<V3State>) {
  try {
    const current = readV3();
    const next = { ...current, ...patch } as V3State;
    const json = JSON.stringify(next);
    localStorage.setItem(KEY_V3_COLON, json);
    localStorage.setItem(KEY_V3_UNDERSCORE, json);
  } catch {}
}

/** -----------------------------
 *  Pomocné – normalizácia & risk (light placeholders)
 *  ----------------------------- */
function normalize(list: MixItem[]): MixItem[] {
  const sum = list.reduce((a, b) => a + (Number(b.pct) || 0), 0) || 1;
  return list.map(i => ({ ...i, pct: parseFloat(((i.pct / sum) * 100).toFixed(2)) }));
}

function setGoldTarget(list: MixItem[], target: number): MixItem[] {
  const goldIdx = list.findIndex(i => i.key === "gold");
  if (goldIdx < 0) return list;
  const others = list.filter(i => i.key !== "gold");
  const remain = Math.max(0, 100 - target);
  const oSum = others.reduce((a, b) => a + b.pct, 0) || 1;
  const redistributed = others.map(o => ({ ...o, pct: parseFloat(((o.pct / oSum) * remain).toFixed(2)) }));
  const next = [{ ...list[goldIdx], pct: target }, ...redistributed];
  return normalize(next);
}

function riskScore(list: MixItem[]): number {
  // veľmi jednoduchá aproximácia – GH neskôr nahradí reálnou funkciou
  const dyn = list.find(i => i.key === "dyn")?.pct || 0;
  const crypto = list.find(i => i.key === "crypto")?.pct || 0;
  const etf = list.find(i => i.key === "etf")?.pct || 0;
  // 0..10 – rastie s dyn/crypto/etf
  return parseFloat(((dyn * 0.05 + crypto * 0.07 + etf * 0.02) / 2).toFixed(2));
}

function riskCap(pref: RiskPref) {
  return pref === "konzervativny" ? 4.0 : pref === "vyvazeny" ? 6.0 : 7.5;
}

function applyRiskConstrainedMix(list: MixItem[], cap: number): MixItem[] {
  // placeholder: ak risk > cap, zober z dyn+crypto do bond/cash
  const score = riskScore(list);
  if (score <= cap) return list;
  const over = score - cap;
  const dynIdx = list.findIndex(i => i.key === "dyn");
  const cryIdx = list.findIndex(i => i.key === "crypto");
  const bondIdx = list.findIndex(i => i.key === "bond");
  const cashIdx = list.findIndex(i => i.key === "cash");
  const take = Math.min(10, Math.max(2, over * 2)); // uber trochu
  const next = list.map(i => ({ ...i }));
  if (dynIdx >= 0) next[dynIdx].pct = Math.max(0, next[dynIdx].pct - take);
  if (cryIdx >= 0) next[cryIdx].pct = Math.max(0, next[cryIdx].pct - take / 2);
  if (bondIdx >= 0) next[bondIdx].pct = next[bondIdx].pct + take * 0.75;
  if (cashIdx >= 0) next[cashIdx].pct = next[cashIdx].pct + take * 0.75;
  return normalize(next);
}

/** -----------------------------
 *  Uncontrolled input hook (stabilné tipovanie)
 *  ----------------------------- */
function useUncontrolledValue(
  initial: number,
  commit: (n: number) => void,
  opts: { min?: number; max?: number; step?: number } = {}
) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const rawRef = React.useRef<string>(String(initial));
  const debRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    // keď sa initial zmení zvonka → sync do DOM
    if (inputRef.current) inputRef.current.value = String(initial);
    rawRef.current = String(initial);
  }, [initial]);

  function parseClamp(raw: string) {
    const num = Number(String(raw).replace(",", ".").replace(/[^\d.]/g, ""));
    if (isNaN(num)) return undefined;
    const { min = 0, max = 100 } = opts;
    return Math.max(min, Math.min(max, num));
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    rawRef.current = e.target.value;
    if (debRef.current) window.clearTimeout(debRef.current);
    debRef.current = window.setTimeout(() => {
      const n = parseClamp(rawRef.current);
      if (typeof n === "number") commit(n);
    }, 120);
  };

  const onBlur = () => {
    if (debRef.current) window.clearTimeout(debRef.current);
    const n = parseClamp(rawRef.current);
    if (typeof n === "number") commit(n);
  };

  return { inputRef, onChange, onBlur };
}

/** -----------------------------
 *  PageLayout – jednoduchý dvojstĺpcový shell
 *  ----------------------------- */
const PageLayout: React.FC<{ left: React.ReactNode; right: React.ReactNode }> = ({ left, right }) => {
  return (
    <div className="px-6 py-6">
      <div className="grid grid-cols-12 gap-6">
        <main className="col-span-12 lg:col-span-8" id="main-content">
          {left}
        </main>
        <aside className="col-span-12 lg:col-span-4" role="complementary" aria-label="Prehľad">
          <div className="sticky top-4 space-y-4">{right}</div>
        </aside>
      </div>
    </div>
  );
};

/** -----------------------------
 *  Sekcia: Cashflow & rezerva (ľavý panel 1)
 *  ----------------------------- */
const CashflowPanel: React.FC<{
  reserveEur: number;
  reserveMonths: number;
  monthly: number;
  setReserveEur: (n: number) => void;
  setReserveMonths: (n: number) => void;
  setMonthly: (n: number) => void;
}> = ({ reserveEur, reserveMonths, monthly, setReserveEur, setReserveMonths, setMonthly }) => {
  const eurCtl = useUncontrolledValue(reserveEur, setReserveEur, { min: 0, max: 1_000_000 });
  const monCtl = useUncontrolledValue(reserveMonths, setReserveMonths, { min: 0, max: 60 });
  return (
    <section id="sec1" aria-labelledby="sec1-title" className="card space-y-3">
      <h2 id="sec1-title" className="text-sm font-semibold">Cashflow & rezerva</h2>

      <div className="space-y-2" aria-label="Mesačný vklad">
        <label className="text-xs">Mesačný vklad – slider</label>
        <input
          id="monthly-slider"
          data-testid="slider-monthly"
          aria-label="Mesačný vklad – slider"
          type="range" min={0} max={2000}
          value={monthly}
          onChange={(e) => setMonthly(+e.target.value)}
        />
        <div className="text-[11px]">{monthly} €</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs">Súčasná rezerva (EUR)</label>
          <input
            ref={eurCtl.inputRef}
            onChange={eurCtl.onChange}
            onBlur={eurCtl.onBlur}
            defaultValue={reserveEur}
            aria-label="Súčasná rezerva"
            type="text" inputMode="decimal"
            className="w-full border px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label className="text-xs">Rezerva (mesiace)</label>
          <input
            ref={monCtl.inputRef}
            onChange={monCtl.onChange}
            onBlur={monCtl.onBlur}
            defaultValue={reserveMonths}
            aria-label="Rezerva (mesiace)"
            type="text" inputMode="decimal"
            className="w-full border px-2 py-1 text-xs"
          />
        </div>
      </div>
    </section>
  );
};

/** -----------------------------
 *  Sekcia: Investičné nastavenia (ľavý panel 2) – zatiaľ len placeholder
 *  ----------------------------- */
const InvestPanel: React.FC = () => {
  return (
    <section id="sec2" aria-labelledby="sec2-title" className="card space-y-2">
      <h2 id="sec2-title" className="text-sm font-semibold">Investičné nastavenia</h2>
      <p className="text-[12px] opacity-70">Placeholder (GH doplní parametre, projekciu a KPI).</p>
    </section>
  );
};

/** -----------------------------
 *  Sekcia: MixPanel BASIC (ľavý panel 3)
 *  ----------------------------- */
const MixPanel: React.FC<{
  mix: MixItem[];
  setMix: (m: MixItem[]) => void;
  riskPref: RiskPref;
}> = ({ mix, setMix, riskPref }) => {

  function commit(key: MixKey, pct: number) {
    const next = mix.map(i => i.key === key ? { ...i, pct } : i);
    setMix(next); // BEZ implicitnej normalizácie – drift je povolený
  }

  const sum = parseFloat(mix.reduce((a, b) => a + b.pct, 0).toFixed(2));
  const cap = riskCap(riskPref);
  const score = riskScore(mix);

  // Uncontrolled text inputy pre stabilné tipovanie
  const ctlMap = Object.fromEntries(
    mix.map(item => [
      item.key,
      useUncontrolledValue(item.pct, (n) => commit(item.key, n), { min: 0, max: 100 }),
    ])
  ) as Record<MixKey, ReturnType<typeof useUncontrolledValue>>;

  function sliderFor(k: MixKey, aria: string, testId?: string) {
    const value = mix.find(i => i.key === k)?.pct || 0;
    return (
      <input
        type="range" min={0} max={100}
        value={value}
        onChange={(e) => commit(k, +e.target.value)}
        aria-label={aria}
        data-testid={testId}
      />
    );
  }

  return (
    <section id="sec3" aria-labelledby="sec3-title" className="card space-y-4">
      <h2 id="sec3-title" className="text-sm font-semibold">Zloženie portfólia</h2>

      <div className="flex flex-wrap gap-2" data-testid="insights-wrap" aria-label="Insights">
        <button className="btn-sm" onClick={() => setMix(setGoldTarget(mix, 12))}>Gold 12 % (odporúčanie)</button>
        <button className="btn-sm" onClick={() => {/* GH doplní wizard */}}>Rezervu doplň</button>
      </div>

      <div className="space-y-2">
        {mix.map(item => (
          <div className="grid grid-cols-12 gap-3 items-center" key={item.key}>
            <div className="col-span-3 text-xs">{item.label}</div>
            <div className="col-span-2">
              <input
                ref={ctlMap[item.key].inputRef}
                onChange={ctlMap[item.key].onChange}
                onBlur={ctlMap[item.key].onBlur}
                defaultValue={item.pct}
                type="text" inputMode="decimal"
                aria-label={item.label}
                data-testid={
                  item.key === "gold"
                    ? "input-gold-number"
                    : undefined
                }
                className="w-full border px-2 py-1 text-xs"
              />
            </div>
            <div className="col-span-7">
              {sliderFor(
                item.key,
                `${item.label} – slider`,
                item.key === "gold" ? "slider-gold" : undefined
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="px-2 py-0.5 rounded bg-neutral-800/60">Súčet mixu: {sum}%</span>
        <button className="btn-sm" onClick={() => setMix(normalize(mix))}>Dorovnať</button>
        <button className="btn-sm" onClick={() => setMix(applyRiskConstrainedMix(mix, cap))}>
          Max výnos (riziko ≤ {cap})
        </button>
      </div>

      <div data-testid="scenario-chips" className="flex flex-wrap gap-2 text-[12px]" aria-label="Scenáre">
        {mix.find(i => i.key === "gold")!.pct >= 12 && <span data-testid="scenario-chip" className="chip">🟡 Zlato dorovnané</span>}
        {(mix.find(i => i.key === "dyn")!.pct + mix.find(i => i.key === "crypto")!.pct) > 22 && (
          <span data-testid="scenario-chip" className="chip">🚦 Dyn+Krypto obmedzené</span>
        )}
        {Math.abs(sum - 100) < 0.01 && <span data-testid="scenario-chip" className="chip">✅ Súčet dorovnaný</span>}
        {riskScore(mix) > cap && <span data-testid="scenario-chip" className="chip">⚠️ Nad limit rizika</span>}
      </div>
    </section>
  );
};

/** -----------------------------
 *  Pravý panel: metriky + projekcia
 *  ----------------------------- */
const MetricsPanel: React.FC<{ riskPref: RiskPref; setRiskPref: (r: RiskPref) => void; mix: MixItem[] }> = ({ riskPref, setRiskPref, mix }) => {
  const cap = riskCap(riskPref);
  const score = riskScore(mix);
  return (
    <section id="sec4" aria-labelledby="sec4-title" className="card space-y-3">
      <h2 id="sec4-title" className="text-sm font-semibold">Metriky & odporúčania</h2>

      <div className="space-x-2 text-xs">
        <span>Preferencia rizika:</span>
        <label><input type="radio" name="riskPref" checked={riskPref==="konzervativny"} onChange={()=>setRiskPref("konzervativny")} /> Konzervatívny</label>
        <label><input type="radio" name="riskPref" checked={riskPref==="vyvazeny"} onChange={()=>setRiskPref("vyvazeny")} /> Vyvážený</label>
        <label><input type="radio" name="riskPref" checked={riskPref==="rastovy"} onChange={()=>setRiskPref("rastovy")} /> Rastový</label>
        <div className="text-[11px] opacity-70">Limit ≤ {cap} | Aktuálne riziko {score}</div>
        {score > cap && <div className="text-[12px]">⚠️ Nad limit rizika – zvážte úpravu mixu.</div>}
      </div>
    </section>
  );
};

const ProjectionPanel: React.FC = () => (
  <section id="sec5" aria-labelledby="sec5-title" className="card">
    <h2 id="sec5-title" className="text-sm font-semibold">Projekcia</h2>
    <p className="text-[12px] opacity-70">Simplified projekcia placeholder.</p>
  </section>
);

/** -----------------------------
 *  Deep-link banner (hash #state=)
 *  ----------------------------- */
const DeeplinkBanner: React.FC = () => {
  const [show, setShow] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (window.location.hash.startsWith("#state=")) setShow(window.location.hash);
  }, []);
  if (!show) return null;
  return (
    <div className="mx-6 my-3 p-3 rounded bg-yellow-200/10 border border-yellow-500/40" data-testid="deeplink-banner">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">Načítaný stav z URL. Môžete zavrieť tento banner.</div>
        <button
          className="btn-sm"
          onClick={() => {
            setShow(null);
            // clear hash až po close (test friendly)
            setTimeout(() => history.replaceState({}, document.title, window.location.pathname + window.location.search), 0);
          }}
        >
          Zavrieť
        </button>
      </div>
    </div>
  );
};

/** -----------------------------
 *  APP SHELL – tu sa všetko spája
 *  ----------------------------- */
const AppShell: React.FC = () => {
  const seed = readV3();
  const [mix, setMix] = React.useState<MixItem[]>(seed.mix);
  const [reserveEur, setReserveEur] = React.useState(seed.reserveEur);
  const [reserveMonths, setReserveMonths] = React.useState(seed.reserveMonths);
  const [monthly, setMonthly] = React.useState(seed.monthly);
  const [riskPref, setRiskPref] = React.useState<RiskPref>(seed.profile.riskPref);

  // persistuj v3 na zmeny
  React.useEffect(() => { writeV3({ mix }); }, [mix]);
  React.useEffect(() => { writeV3({ reserveEur }); }, [reserveEur]);
  React.useEffect(() => { writeV3({ reserveMonths }); }, [reserveMonths]);
  React.useEffect(() => { writeV3({ monthly }); }, [monthly]);
  React.useEffect(() => { writeV3({ profile: { riskPref } as any }); }, [riskPref]);

  const left = (
    <div className="space-y-6">
      <CashflowPanel
        reserveEur={reserveEur}
        reserveMonths={reserveMonths}
        monthly={monthly}
        setReserveEur={setReserveEur}
        setReserveMonths={setReserveMonths}
        setMonthly={setMonthly}
      />
      <InvestPanel />
      <MixPanel mix={mix} setMix={setMix} riskPref={riskPref} />
    </div>
  );
  const right = (
    <>
      <MetricsPanel riskPref={riskPref} setRiskPref={setRiskPref} mix={mix} />
      <ProjectionPanel />
    </>
  );

  return (
    <>
      <DeeplinkBanner />
      <PageLayout left={left} right={right} />
    </>
  );
};

export default AppShell;

/** -----------------------------
 *  Štýly pre demo (neblokujú projekt)
 *  ----------------------------- */
// Ak projekt už používa Tailwind, tieto classNames sa prejavia automaticky.
// Pre plain CSS si prípadne doplň .card, .btn-sm, .chip do globálu.
