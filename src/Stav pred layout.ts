/**
 * Stav pred layout – placeholder.
 * Legacy pre-layout logika bola odstránená kvôli masívnym TS chybám (>2000).
 * Ak treba obnoviť časť, vytiahneme ju selektívne z histórie.
 */
export {}; // empty module keeps TS happy

// NOTE: Žiadny ďalší kód tu zámerne nie je.
  const BOND_RISK = 2;

  const RE =
    scn === "conservative" ? 0.075 : scn === "aggressive" ? 0.095 : 0.087;
  const RE_RISK = scn === "aggressive" ? 5 : 4;

  return {
    "ETF (svet – aktívne)": { expReturn: ETF, risk: ETF_RISK },
    "Zlato (fyzické)": { expReturn: GOLD, risk: GOLD_RISK },
    "Krypto (BTC/ETH)": { expReturn: CRYPTO, risk: CRYPTO_RISK },
    "Dynamické riadenie": { expReturn: DYNAMIC, risk: DYNAMIC_RISK },
    "Garantovaný dlhopis 7,5% p.a.": { expReturn: BOND9, risk: BOND_RISK },
    "Hotovosť/rezerva": { expReturn: 0.0, risk: 2 },
    "Reality (komerčné)": { expReturn: RE, risk: RE_RISK },
  };
}

// END LEGACY (intentionally omitted)
  "ETF (svet – aktívne)": 40,
  "Zlato (fyzické)": 10,
  "Krypto (BTC/ETH)": 10,
  "Dynamické riadenie": 20,
  "Garantovaný dlhopis 7,5% p.a.": 15,
  "Hotovosť/rezerva": 5,
  "Reality (komerčné)": 0,
};
type RecArgs = {
  years: number;
  income: number;
  monthlyInvest: number;
  oneTime: number;
  missingReserve: number;
  reUnlocked: boolean;
  assetsKeys: string[];
};

/* ============================
   Gauge helpers & component
============================ */
function gaugeNeedle(value: number, cx: number, cy: number, r: number) {
  const needleLen = r * 0.85;
  const ang = Math.PI - (value / 100) * Math.PI;
  const nx = cx + needleLen * Math.cos(ang);
  const ny = cy - needleLen * Math.sin(ang);
  return { nx, ny };
}

function RiskGauge({ value }: { value: number }) {
  const size = 140;
  const cx = size / 2;
  const cy = size / 2 + 20;
  const r = 70;
  const { nx, ny } = gaugeNeedle(value, cx, cy, r);

  const segments = [
    { start: 180, end: 135, color: "#22c55e" },
    { start: 135, end: 105, color: "#84cc16" },
    { start: 105, end: 75, color: "#f59e0b" },
    { start: 75, end: 45, color: "#f97316" },
    { start: 45, end: 0, color: "#ef4444" },
  ];

  const arcPath = (startDeg: number, endDeg: number) => {
    const rad = (d: number) => (Math.PI * d) / 180;
    const sx = cx + r * Math.cos(rad(startDeg));
    const sy = cy - r * Math.sin(rad(startDeg));
    const ex = cx + r * Math.cos(rad(endDeg));
    const ey = cy - r * Math.sin(rad(endDeg));
    const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
  };

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size / 1.2}
        viewBox={`0 0 ${size} ${size / 1.2}`}
        aria-label="Rizikový poloblúk"
      >
        <path
          d={arcPath(180, 0)}
          stroke="#374151"
            strokeWidth={10}
          fill="none"
          strokeLinecap="butt"
        />
        {segments.map((s, i) => (
          <path
            key={i}
            d={arcPath(s.start, s.end)}
            stroke={s.color}
            strokeWidth={10}
            fill="none"
            strokeLinecap="butt"
          />
        ))}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#e2e8f0"
          strokeWidth={3}
        />
        <circle cx={cx} cy={cy} r={6} fill="#e2e8f0" />
      </svg>
    </div>
  );
}

/* ============================
   Recommended mix (heuristics)
============================ */
function computeRecommendedMix({
  years,
  income,
  monthlyInvest,
  oneTime,
  missingReserve,
  reUnlocked,
  assetsKeys,
}: RecArgs): Record<string, number> {
  let target: Record<string, number> = {
    "ETF (svet – aktívne)": 30,
    "Zlato (fyzické)": 20,
    "Krypto (BTC/ETH)": 15,
    "Dynamické riadenie": 10,
    "Garantovaný dlhopis 7,5% p.a.": 15,
    "Hotovosť/rezerva": 10,
  };

  const H = years <= 5 ? "short" : years <= 14 ? "mid" : "long";
  if (H === "short") {
    target = {
      ...target,
      "ETF (svet – aktívne)": 20,
      "Zlato (fyzické)": 25,
      "Krypto (BTC/ETH)": 10,
      "Dynamické riadenie": 5,
      "Garantovaný dlhopis 7,5% p.a.": 20,
      "Hotovosť/rezerva": 20,
    };
  } else if (H === "long") {
    target = {
      ...target,
      "ETF (svet – aktívne)": 40,
      "Zlato (fyzické)": 15,
      "Krypto (BTC/ETH)": 15,
      "Dynamické riadenie": 15,
      "Garantovaný dlhopis 7,5% p.a.": 10,
      "Hotovosť/rezerva": 5,
    };
  }

  if (oneTime >= 1_000_000) {
    target = {
      "ETF (svet – aktívne)": 32,
      "Zlato (fyzické)": 22,
      "Krypto (BTC/ETH)": 1,
      "Dynamické riadenie": 3,
      "Garantovaný dlhopis 7,5% p.a.": 37,
      "Hotovosť/rezerva": 5,
    };
  } else if (oneTime >= 500_000) {
    target = {
      "ETF (svet – aktívne)": 38,
      "Zlato (fyzické)": 20,
      "Krypto (BTC/ETH)": 2,
      "Dynamické riadenie": 5,
      "Garantovaný dlhopis 7,5% p.a.": 30,
      "Hotovosť/rezerva": 5,
    };
  } else if (oneTime >= 100_000) {
    target["Krypto (BTC/ETH)"] = Math.min(target["Krypto (BTC/ETH)"], 3);
    target["Dynamické riadenie"] = Math.min(target["Dynamické riadenie"], 7);
    target["Garantovaný dlhopis 7,5% p.a."] = Math.max(
      target["Garantovaný dlhopis 7,5% p.a."],
      25
    );
    target["Zlato (fyzické)"] = Math.max(target["Zlato (fyzické)"], 15);
  }

  if (monthlyInvest < 100) {
    target["Krypto (BTC/ETH)"] = Math.min(target["Krypto (BTC/ETH)"], 4);
    target["Dynamické riadenie"] = Math.min(target["Dynamické riadenie"], 6);
    target["Garantovaný dlhopis 7,5% p.a."] = Math.max(
      target["Garantovaný dlhopis 7,5% p.a."],
      30
    );
  } else if (monthlyInvest >= 500) {
    target["Krypto (BTC/ETH)"] = Math.min(
      10,
      (target["Krypto (BTC/ETH)"] || 0) + 2
    );
    target["Dynamické riadenie"] = Math.min(
      12,
      (target["Dynamické riadenie"] || 0) + 2
    );
  }

  if (missingReserve > 0) {
    target["Hotovosť/rezerva"] = Math.max(target["Hotovosť/rezerva"], 10);
    target["Garantovaný dlhopis 7,5% p.a."] = Math.max(
      target["Garantovaný dlhopis 7,5% p.a."],
      30
    );
    target["Krypto (BTC/ETH)"] = Math.min(target["Krypto (BTC/ETH)"], 5);
    target["Dynamické riadenie"] = Math.min(target["Dynamické riadenie"], 6);
  }

  if (reUnlocked) {
    const take = 10;
    target["Reality (komerčné)"] = take;
    const donors = ["ETF (svet – aktívne)", "Garantovaný dlhopis 7,5% p.a."];
    donors.forEach((k) => {
      if (k in target)
        target[k] = Math.max(0, (target[k] || 0) - take / donors.length);
    });
  }

  target["Zlato (fyzické)"] = Math.max(10, target["Zlato (fyzické)"] || 0);
  target["Dynamické riadenie"] = Math.min(
    30,
    target["Dynamické riadenie"] || 0
  );

  const riskySum =
    (target["Dynamické riadenie"] || 0) + (target["Krypto (BTC/ETH)"] || 0);
  if (riskySum > 22) {
    const over = riskySum - 22;
    const dynRoom = Math.max(0, (target["Dynamické riadenie"] || 0) - 8);
    const takeDyn = Math.min(over, dynRoom);
    target["Dynamické riadenie"] = Math.max(
      0,
      (target["Dynamické riadenie"] || 0) - takeDyn
    );
    target["Krypto (BTC/ETH)"] = Math.max(
      0,
      (target["Krypto (BTC/ETH)"] || 0) - (over - takeDyn)
    );
  }

  const filtered: Record<string, number> = {};
  for (const k of Object.keys(target)) {
    if (assetsKeys.includes(k)) filtered[k] = Math.max(0, target[k] || 0);
  }
  return fairRoundTo100(filtered);
}

type SearchOpts = {
  assets: AssetMap;
  step?: number;
  reUnlocked: boolean;
};

const ALPHA_OVERWEIGHT = 0.5;
const GAMMA_HHI = 1.0;
const OVERWEIGHT_START = 0.2;

type RiskResult = {
  score10: number;
  pct: number;
  raw: number;
  hhi: number;
  wMax: number;
  top2Sum: number;
};

function computeRisk(
  normMix: Record<string, number>,
  assets: AssetMap
): RiskResult {
  let weighted = 0;
  let HHI = 0;
  let wMax = 0;
  const entries = Object.entries(normMix);

  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const top2Sum = (sorted[0]?.[1] || 0) + (sorted[1]?.[1] || 0);

  for (const [k, w] of entries) {
    const base = assets[k]?.risk ?? 5;
    const baseWithCash =
      k === "Hotovosť/rezerva" ? 2 + 6 * clamp(w, 0, 1) : base;
    const over = Math.max(0, w - OVERWEIGHT_START) / (1 - OVERWEIGHT_START);
    const eff = baseWithCash * (1 + ALPHA_OVERWEIGHT * over);

    weighted += w * eff;
    HHI += w * w;
    if (w > wMax) wMax = w;
  }

  const concPenalty = 10 * GAMMA_HHI * Math.max(0, HHI - 0.22);

  const dynW = normMix["Dynamické riadenie"] || 0;
  let dynExtra = 0;
  if (dynW >= 0.2 && dynW < 0.3) {
    dynExtra = 10 * (dynW - 0.2);
  } else if (dynW >= 0.3 && dynW < 0.4) {
    dynExtra = 1 + 10 * (dynW - 0.3);
  } else if (dynW >= 0.4 && dynW < 0.5) {
    dynExtra = 2 + 20 * (dynW - 0.4);
  } else if (dynW >= 0.5) {
    dynExtra = 4 + 30 * (dynW - 0.5);
  }

  let raw = weighted + concPenalty + dynExtra;
  const score10 = Math.min(11, raw);
  const pct = clamp((Math.min(raw, 10) / 10) * 100, 0, 100);
  return { score10, pct, raw, hhi: HHI, wMax, top2Sum };
}

function findBestPortfolio({ assets, step = 5, reUnlocked }: SearchOpts) {
  // 1) Dynamické zistenie reálnych kľúčov (robustné voči odchýlkam)
  const dynKey =
    Object.keys(assets).find((k) => k.toLowerCase().includes("dynam")) ??
    "Dynamické riadenie";
  const goldKey =
    Object.keys(assets).find((k) => k.toLowerCase().startsWith("zlato")) ??
    "Zlato (fyzické)";
  const reKey =
    Object.keys(assets).find((k) => k.toLowerCase().startsWith("reality")) ??
    "Reality (komerčné)";
  const cashKey =
    Object.keys(assets).find((k) => k.toLowerCase().startsWith("hotov")) ??
    "Hotovosť/rezerva";

  // 2) Poradie – cash posledný aby dorovnal, reálne iba existujúce
  const order = [
    "Garantovaný dlhopis 7,5% p.a.",
    "ETF (svet – aktívne)",
    goldKey,
    dynKey,
    "Krypto (BTC/ETH)",
    reKey,
    cashKey,
  ].filter((k) => k in assets);

  let bestMix: Record<string, number> | null = null;
  let bestScore = -Infinity;

  function scoreOf(mix: Record<string, number>) {
    const total = Object.values(mix).reduce((a, b) => a + (b || 0), 0) || 1;
    const norm: Record<string, number> = {};
    Object.keys(assets).forEach((k) => {
      norm[k] = (mix[k] || 0) / total;
    });
    const exp = Object.entries(norm).reduce((acc, [k, w]) => {
      const r = assets[k]?.expReturn ?? 0;
      return acc + w * r;
    }, 0);
    const r = computeRisk(norm, assets);
    const riskTen = Math.min(10, r.raw);
    return riskTen > 0 ? (exp * 100) / riskTen : 0;
  }

  function rec(i: number, assignedSum: number, cur: Record<string, number>) {
    // Base-case – posledný (cash) dorovná zvyšok
    if (i === order.length - 1) {
      const lastKey = order[i];
      const rest = 100 - assignedSum;
      if (rest < 0 || rest > 100) return;
      const cand: Record<string, number> = { ...cur, [lastKey]: rest };

      // Reality zamknuté => 0
      if (!reUnlocked && reKey in cand) cand[reKey] = 0;

      // Gold min 10 %
      if ((cand[goldKey] ?? 0) < 10) return;
      // Dynamic max 30 %
      if ((cand[dynKey] ?? 0) > 30) return;

      const sc = scoreOf(cand);
      if (sc > bestScore) {
        bestScore = sc;
        bestMix = cand;
      }
      return;
    }

    const key = order[i];
    const maxForThis = key === dynKey ? 30 : 100;
    for (let w = 0; w <= Math.min(maxForThis, 100 - assignedSum); w += step) {
      const newSum = assignedSum + w;
      if (newSum > 100) break;
      rec(i + 1, newSum, { ...cur, [key]: w });
    }
  }

  rec(0, 0, {});
  if (bestMix) bestMix = fairRoundTo100(bestMix);
  return { bestMix, bestScore };
}

/* ============================
   App
============================ */
// export default function App() {
  const [income, setIncome] = useState(1500);
  const [fixed, setFixed] = useState(800);
  const [variable, setVariable] = useState(300);
  const [oneTime, setOneTime] = useState(2000);
  const [monthlyInvest, setMonthlyInvest] = useState(200);
  const [years, setYears] = useState(10);
  const [target, setTarget] = useState(50000);
  const [emergencyMonths, setEmergencyMonths] = useState(6);
  const [currentReserve, setCurrentReserve] = useState(1500);
  const [recMix, setRecMix] = useState<Record<string, number> | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Doplenené stavy potrebné pre UI
  const [scenario, setScenario] = useState<"conservative" | "base" | "aggressive">("base");
  const [mix, setMix] = useState<Record<string, number>>(DEFAULT_MIX);
  const deferredMix = useDeferredValue(mix);
  const [logoOk, setLogoOk] = useState(true);
  const [showMethod, setShowMethod] = useState(false);
  const [showRec, setShowRec] = useState(false);

  // Chýbajúca rezerva (heuristika: fixné výdavky * mesiace - aktuálna rezerva)
  const missingReserve = useMemo(
    () => Math.max(0, emergencyMonths * fixed - currentReserve),
    [emergencyMonths, fixed, currentReserve]
  );
  function resetAll() {
    if (!confirm("Naozaj chceš resetovať všetky hodnoty na predvolené?"))
      return;
    setIncome(1500);
    setFixed(800);
    setVariable(300);
    setOneTime(2000);
    setMonthlyInvest(200);
    setYears(10);
    setTarget(50000);
    setEmergencyMonths(6);
    setCurrentReserve(1500);
    setMix(DEFAULT_MIX);
    setScenario("base");
    setRecMix(null);
    setShowRec(false);
    setShowMethod(false);
  }
  useEffect(() => {
    document.title = "UNOTOP Investičný plánovač – Interaktívny";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "Interaktívny investičný plánovač UNOTOP – modelovanie portfólia, ciele, riziko a výnos v reálnom čase."
    );
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap";
    document.head.appendChild(link);
    document.body.style.fontFamily =
      "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";
  }, []);

  const reUnlocked = oneTime >= 300_000 || income >= 3_500;

  const assets = useMemo(() => {
    const A = { ...getAssetsByScenario(scenario) };
    return A;
  }, [scenario]);

  function findAndApplyBest(step = 5) {
    const { bestMix } = findBestPortfolio({
      assets,
      step,
      reUnlocked,
    });
    if (bestMix) {
      setMix(bestMix);
      setShowRec(false);
      setRecMix(null);
    } else {
      alert("Nenašlo sa žiadne portfólio (skontroluj obmedzenia).");
    }
  }

  const savings = useMemo(
    () => Math.max(0, income - fixed - variable),
    [income, fixed, variable]
  );
  const savingsRate = useMemo(
    () => (income > 0 ? savings / income : 0),
    [savings, income]
  );

  const mixTotal = useMemo(
    () => Object.keys(assets).reduce((a, k) => a + (Number(mix[k]) || 0), 0),
    [assets, mix]
  );
  const normMix = useMemo(() => {
    const t = mixTotal || 1;
    const obj: Record<string, number> = {};
    Object.keys(assets).forEach(
      (k) => (obj[k] = (Number(deferredMix[k]) || 0) / t)
    );
    return obj;
  }, [assets, deferredMix, mixTotal]);

  const portfolioExpReturn = useMemo(() => {
    return Object.entries(normMix).reduce((acc, [k, w]) => {
      const r = assets[k]?.expReturn ?? 0;
      return acc + w * r;
    }, 0);
  }, [normMix, assets]);

  const riskModel = useMemo(
    () => computeRisk(normMix, assets),
    [normMix, assets]
  );

  const fv = useMemo(
    () =>
      fvMonthly({
        initial: oneTime,
        monthly: monthlyInvest,
        years,
        rate: portfolioExpReturn,
      }),
    [oneTime, monthlyInvest, years, portfolioExpReturn]
  );

  const goalProgress = useMemo(
    () => (target > 0 ? fv / target : 0),
    [fv, target]
  );

  const series = useMemo(() => {
    const r = portfolioExpReturn / 12;
    const n = years * 12;
    let value = oneTime;
    const arr: { month: number; value: number }[] = [];
    for (let m = 0; m <= n; m++) {
      if (m > 0) value = value * (1 + r) + monthlyInvest;
      arr.push({ month: m, value: Math.max(0, Math.round(value)) });
    }
    return arr;
  }, [oneTime, monthlyInvest, years, portfolioExpReturn]);

  const rr = useMemo(() => {
    const riskTen = Math.min(10, riskModel.raw);
    return riskTen > 0 ? (portfolioExpReturn * 100) / riskTen : 0;
  }, [portfolioExpReturn, riskModel.raw]);

  const rrBand = useMemo(() => {
    if (rr >= 3) return { label: "Výborné", color: "#22c55e" };
    if (rr >= 2) return { label: "Dobré", color: "#84cc16" };
    if (rr >= 1.3) return { label: "Neutrálne", color: "#f59e0b" };
    return { label: "Slabé", color: "#ef4444" };
  }, [rr]);

  const topMix = useMemo(
    () =>
      Object.entries(normMix)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
    [normMix]
  );

  const srColor = useMemo(() => {
    const r = clamp(savingsRate, 0, 0.5) / 0.5;
    const hue = 0 + 120 * r;
    return `hsl(${hue} 80% 45%)`;
  }, [savingsRate]);

  const progressColor = useMemo(() => {
    const r = clamp(goalProgress, 0, 1);
    const hue = 0 + 120 * r;
    return `hsl(${hue} 80% 45%)`;
  }, [goalProgress]);

  const RISK_THRESHOLD = 7;
  const riskExceeded = riskModel.raw > RISK_THRESHOLD;
  const riskHardBlock = riskModel.raw >= 10;
  const cashPct = normMix["Hotovosť/rezerva"] || 0;
  const cashExceeded = cashPct > 0.4;
  const highConcentration = riskModel.wMax >= 0.7 || riskModel.top2Sum >= 0.85;

  const goldPct = normMix["Zlato (fyzické)"] || 0;

  const normalizeMixTo100 = () => {
    const keys = Object.keys(assets);
    if (!keys.length) return;
    const base: Record<string, number> = {};
    keys.forEach((k) => (base[k] = Math.max(0, Number(mix[k]) || 0)));
    let next = fairRoundTo100(base);

    const GOLD_KEY = "Zlato (fyzické)";
    const GOLD_MIN = 10;
    const curGold = next[GOLD_KEY] || 0;
    if (curGold < GOLD_MIN) {
      let need = GOLD_MIN - curGold;
      next[GOLD_KEY] = GOLD_MIN;
      const others = keys.filter((k) => k !== GOLD_KEY && next[k] > 0);
      let pool = others.reduce((a, k) => a + next[k], 0) || 1;
      for (const k of others) {
        if (need <= 0) break;
        const take = Math.min(next[k], Math.round((next[k] / pool) * need));
        next[k] -= take;
        need -= take;
      }
      if (need > 0) {
        for (const k of others) {
          if (need <= 0) break;
            const take = Math.min(next[k], need);
          next[k] -= take;
          need -= take;
        }
      }
    }

    setMix(next);
  };

  const dynPa = assets["Dynamické riadenie"].expReturn;
  const dynPm = monthlyFromAnnual(dynPa);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("unotop_iwa_state");
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.income === "number") setIncome(s.income);
        if (typeof s.fixed === "number") setFixed(s.fixed);
        if (typeof s.variable === "number") setVariable(s.variable);
        if (typeof s.oneTime === "number") setOneTime(s.oneTime);
        if (typeof s.monthlyInvest === "number")
          setMonthlyInvest(s.monthlyInvest);
        if (typeof s.years === "number") setYears(s.years);
        if (typeof s.target === "number") setTarget(s.target);
        if (typeof s.emergencyMonths === "number")
          setEmergencyMonths(s.emergencyMonths);
        if (typeof s.currentReserve === "number")
          setCurrentReserve(s.currentReserve);
        if (s.mix && typeof s.mix === "object") setMix(s.mix);
        if (s.scenario) setScenario(s.scenario);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const state = {
      income,
      fixed,
      variable,
      oneTime,
      monthlyInvest,
      years,
      target,
      emergencyMonths,
      currentReserve,
      mix,
      scenario,
    };
    localStorage.setItem("unotop_iwa_state", JSON.stringify(state));
  }, [
    hydrated,
    income,
    fixed,
    variable,
    oneTime,
    monthlyInvest,
    years,
    target,
    emergencyMonths,
    currentReserve,
    mix,
    scenario,
  ]);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto w-full space-y-6">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            {logoOk ? (
              <img
                src="/unotop_logo_transparent.png"
                alt="UNOTOP logo"
                onError={() => setLogoOk(false)}
                className="h-20 mb-3 opacity-90"
              />
            ) : (
              <div className="h-10 mb-3 flex items-center">
                <div className="rounded-full border border-slate-700 bg-slate-800 text-slate-200 px-3 py-1 text-sm font-semibold tracking-wide">
                  UNOTOP
                </div>
              </div>
            )}
            <h1
              className="text-3xl md:text-4xl font-bold tracking-tight bg-clip-text text-transparent mb-2"
              style={{
                backgroundImage: "linear-gradient(90deg,#0f2847,#c59a2a)",
              }}
            >
              UNOTOP Investičný plánovač
            </h1>
            <p className="text-slate-300">
              Profesionálny nástroj na modelovanie portfólia a finančných cieľov
              v reálnom čase. Údaje sú ilustratívne; nejde o investičné
              odporúčanie.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
            <div className="text-sm text-slate-400">
              Očakávaný ročný výnos (p.a.)
            </div>
            <div className="text-2xl font-semibold">
              {pctFmt(portfolioExpReturn)}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-sm text-slate-400">
                  Rizikové skóre portfólia
                </div>
                <button
                  aria-label="Zobraziť metodiku rizika"
                  onClick={() => setShowMethod((v) => !v)}
                  className="w-5 h-5 rounded-full border border-slate-700 bg-slate-900/60 text-slate-300 text-xs leading-none flex items-center justify-center hover:bg-slate-800/80"
                >
                  i
                </button>
              </div>
              <div className="text-xs text-slate-500">
                0 = nízke · 100 = vysoké
              </div>
            </div>

            <div className="mt-1">
              <RiskGauge value={riskModel.pct} />
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: "#22c55e" }}
                ></span>
                Nízke 0–39
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: "#84cc16" }}
                ></span>
                Neutrálne 40–69
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: "#f59e0b" }}
                ></span>
                Zvýšené 70–84
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: "#ef4444" }}
                ></span>
                Vysoké 85–100
              </span>
            </div>

            {showMethod && (
              <div className="text-xs text-slate-400 mt-2 space-y-1">
                <div>
                  • Očakávaný výnos <em>(p.a.)</em> = Σ wᵢ · rᵢ.
                </div>
                <div>
                  • Rizikové skóre (0–100) = škálované váženie rizík + prirážky
                  (koncentrácia, dynamické).
                </div>
                <div>
                  • Projekcia používa mesačné zložené úročenie a pravidelné
                  vklady.
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-2 bg-slate-950/80 backdrop-blur border-b border-slate-800">
          <div className="max-w-6xl mx-auto flex flex-wrap gap-2 text-xs md:text-sm">
            <span className="px-2 py-1 rounded bg-slate-900/60 border border-slate-800">
              Oč. výnos: {pctFmt(portfolioExpReturn)}
            </span>
            <span className="px-2 py-1 rounded bg-slate-900/60 border border-slate-800">
              Riziko: {riskModel.raw.toFixed(1)}/10
            </span>
            <span className="px-2 py-1 rounded bg-slate-900/60 border border-slate-800">
              FV: {euro(fv)}
            </span>
            <span className="px-2 py-1 rounded bg-slate-900/60 border border-slate-800">
              Plnenie: {(goalProgress * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {riskHardBlock && (
          <div className="max-w-6xl mx-auto -mt-2">
            <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 text-rose-200 px-4 py-3 text-sm">
              Max. riziko <b>10/10</b> prekročené. Prosím uprav rozloženie
              portfólia (zniž podiel <i>Dynamické riadenie</i> alebo{" "}
              <i>Krypto</i>), aby si pokračoval.
            </div>
          </div>
        )}
        {(normMix["Dynamické riadenie"] || 0) > 0.3 && (
          <div className="max-w-6xl mx-auto -mt-2">
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-200 px-4 py-3 text-sm">
              Upozornenie: Dynamické riadenie presahuje 30 % portfólia. Zváž
              zníženie podielu kvôli primeranému riziku.
            </div>
          </div>
        )}

        {riskExceeded && !riskHardBlock && (
          <div className="max-w-6xl mx-auto -mt-2">
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-200 px-4 py-3 text-sm">
              Upozornenie: rizikové skóre je {riskModel.raw.toFixed(1)} / 10
              (&gt; {RISK_THRESHOLD}). Zváž úpravu rozloženia portfólia (zniž
              dynamické/krypto alebo zvýš dlhopis/zlato).
            </div>
          </div>
        )}
        {cashExceeded && (
          <div className="max-w-6xl mx-auto -mt-2">
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-200 px-4 py-3 text-sm">
              Upozornenie: hotovosť tvorí {(cashPct * 100).toFixed(0)} %
              portfólia. Hodnota hotovosti dlhodobo klesá vplyvom inflácie;
              odporúčame držať len krátkodobú rezervu.
            </div>
          </div>
        )}
        {highConcentration && (
          <div className="max-w-6xl mx-auto -mt-2">
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 text-rose-200 px-4 py-3 text-sm">
              Upozornenie: portfólio je veľmi koncentrované (jeden alebo dva
              podiely tvoria väčšinu). Zváž vyváženie kvôli stabilite.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-6 xl:order-1">
            <section className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                <h2 className="text-xl font-semibold">
                  1) Tvoja aktuálna situácia
                </h2>
                <Field
                  label="Mesačný príjem"
                  value={income}
                  setValue={setIncome}
                  min={0}
                  max={50000}
                  step={50}
                  prefix="€"
                />
                <Field
                  label="Fixné výdavky"
                  value={fixed}
                  setValue={setFixed}
                  min={0}
                  max={10000}
                  step={50}
                  prefix="€"
                />
                <Field
                  label="Variabilné výdavky"
                  value={variable}
                  setValue={setVariable}
                  min={0}
                  max={10000}
                  step={50}
                  prefix="€"
                />

                <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
                  <div className="text-sm text-slate-400">
                    Voľná hotovosť (odhad)
                  </div>
                  <div className="text-2xl font-bold">{euro(savings)}</div>
                  <div className="text-sm text-slate-400 mt-2">
                    Miera sporenia
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="text-lg font-semibold"
                      style={{ color: srColor }}
                    >
                      {pctFmt(savingsRate)}
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(100, savingsRate * 100)}%`,
                          background: srColor,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SmallField
                    label="Súčasná rezerva"
                    value={currentReserve}
                    setValue={setCurrentReserve}
                    min={0}
                    max={9_999_999}
                    step={100}
                    prefix="€"
                  />
                  <SmallField
                    label="Cieľ rezervy (mesiace)"
                    value={emergencyMonths}
                    setValue={setEmergencyMonths}
                    min={0}
                    max={36}
                    step={1}
                  />
                </div>
                <p className="text-sm text-slate-400">
                  Chýbajúca rezerva:{" "}
                  <span className="font-semibold text-slate-200">
                    {euro(Math.max(0, missingReserve))}
                  </span>
                </p>
              </div>

              <div className="space-y-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                <h2 className="text-xl font-semibold">
                  2) Investičné nastavenie
                </h2>
                <Field
                  label="Jednorazová investícia"
                  value={oneTime}
                  setValue={setOneTime}
                  min={0}
                  max={1_000_000}
                  step={100}
                  prefix="€"
                />
                <Field
                  label="Pravidelná investícia / mes."
                  value={monthlyInvest}
                  setValue={setMonthlyInvest}
                  min={0}
                  max={10_000}
                  step={50}
                  prefix="€"
                />
                {monthlyInvest > savings && (
                  <div className="text-xs text-rose-300 -mt-2">
                    Upozornenie: pravidelná suma presahuje voľnú hotovosť (
                    {euro(savings)}).
                  </div>
                )}
                <Field
                  label="Horizont (roky)"
                  value={years}
                  setValue={setYears}
                  min={1}
                  max={60}
                  step={1}
                />

                <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
                  <div className="text-sm text-slate-300 mb-2">
                    Scenár výnosov
                  </div>
                  <select
                    value={scenario}
                    onChange={(e) =>
                      setScenario(
                        e.target.value as "conservative" | "base" | "aggressive"
                      )
                    }
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2 text-slate-100"
                  >
                    <option value="conservative">Konzervatívny (nižší)</option>
                    <option value="base">Základný</option>
                    <option value="aggressive">Dynamický (vyšší)</option>
                  </select>
                  <div className="text-xs text-slate-500 mt-2">
                    ETF {pctFmt(assets["ETF (svet – aktívne)"].expReturn)} ·
                    Zlato {pctFmt(assets["Zlato (fyzické)"].expReturn)} · Krypto{" "}
                    {pctFmt(assets["Krypto (BTC/ETH)"].expReturn)} · Dynamické{" "}
                    {(dynPa * 100).toFixed(1)}% p.a. (≈{" "}
                    {(dynPm * 100).toFixed(1)}%/m)
                  </div>
                </div>

                <div
                  className="rounded-xl bg-slate-950/60 p-3 border space-y-3"
                  style={{
                    borderColor:
                      mixTotal === 100 ? "rgb(51 65 85 / 1)" : "#f59e0b",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      Zloženie portfólia (musí dávať 100%)
                    </div>
                    <div className="text-sm text-slate-400">
                      Súčet:{" "}
                      <span
                        className={
                          mixTotal === 100 ? "text-green-400" : "text-red-400"
                        }
                      >
                        {mixTotal}%
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={normalizeMixTo100}
                      disabled={riskHardBlock}
                      className={`px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs ${
                        riskHardBlock ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      Dorovnať do 100%
                    </button>
                    <button
                      onClick={() =>
                        setMix({
                          "ETF (svet – aktívne)": 30,
                          "Zlato (fyzické)": 20,
                          "Krypto (BTC/ETH)": 15,
                          "Dynamické riadenie": 10,
                          "Garantovaný dlhopis 7,5% p.a.": 15,
                          "Hotovosť/rezerva": 10,
                          ...(assets["Reality (komerčné)"]
                            ? { "Reality (komerčné)": 0 }
                            : {}),
                        })
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs"
                    >
                      Vyvážené (UNOTOP)
                    </button>
                    <button
                      onClick={() => {
                        const rec = computeRecommendedMix({
                          years,
                          income,
                          monthlyInvest,
                          oneTime,
                          missingReserve,
                          reUnlocked,
                          assetsKeys: Object.keys(assets),
                        });
                        setRecMix(rec);
                        setShowRec(true);
                      }}
                      disabled={riskHardBlock}
                      className={`px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs ${
                        riskHardBlock ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      Odporúčané nastavenie
                    </button>

                    <button
                      onClick={() => findAndApplyBest(5)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs"
                    >
                      Nájsť maximum (MVP)
                    </button>

                    <button
                      onClick={resetAll}
                      title="Vráti všetky vstupy a mix na predvolené hodnoty"
                      className="px-3 py-1.5 rounded-lg border border-rose-700 bg-rose-900 hover:bg-rose-800 text-xs"
                    >
                      Resetovať hodnoty
                    </button>
                  </div>

                  {Object.keys(assets).map((k) => (
                    <MixField
                      key={k}
                      label={k}
                      value={mix[k]}
                      setValue={(v: number) =>
                        setMix((m) => ({ ...m, [k]: clamp(v, 0, 100) }))
                      }
                      reUnlocked={reUnlocked}
                    />
                  ))}

                  {mixTotal !== 100 && (
                    <div className="text-amber-300 text-sm">
                      Tip: uprav percentá tak, aby súčet bol 100% (aktuálne{" "}
                      {mixTotal}%).
                    </div>
                  )}
                  {goldPct < 0.1 && (
                    <div className="text-rose-300 text-xs">
                      Upozornenie: Zlato je definované ako „nedotýkaj sa“
                      rezerva. Odporúčame aspoň 10% portfólia.
                    </div>
                  )}

                  {showRec && recMix && (
                    <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">
                          Odporúčané nastavenie (náhľad)
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowRec(false)}
                            className="px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs"
                          >
                            Zavrieť
                          </button>
                          <button
                            onClick={() => {
                              setMix(recMix);
                              setShowRec(false);
                            }}
                            disabled={riskHardBlock}
                            className={`px-3 py-1 rounded border border-emerald-600 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs ${
                              riskHardBlock
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            Použiť
                          </button>
                        </div>
                      </div>
                      <ul className="text-sm text-slate-300 space-y-1">
                        {Object.keys(assets).map((k) => (
                          <li
                            key={k}
                            className="flex items-center justify-between"
                          >
                            <span>{k}</span>
                            <span className="text-slate-400">
                              {recMix[k] ?? 0}%
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="text-xs text-slate-500 mt-1">
                        Pozn.: mix je prispôsobený horizontu, veľkosti vkladov a
                        rezerve.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                <h2 className="text-xl font-semibold">3) Projekcia & ciele</h2>
                <Field
                  label="Cieľová suma"
                  value={target}
                  setValue={setTarget}
                  min={0}
                  max={10000000}
                  step={1000}
                  prefix="€"
                />

                <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800 space-y-2">
                  <div className="text-sm text-slate-400">
                    Odhadovaný budúci majetok
                  </div>
                  <div className="text-3xl font-extrabold">{euro(fv)}</div>
                  <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, goalProgress * 100)}%`,
                        background: progressColor,
                      }}
                    />
                  </div>
                  <div className="text-sm text-slate-400">
                    Plnenie cieľa:{" "}
                    <span
                      className="font-semibold"
                      style={{ color: progressColor }}
                    >
                      {(goalProgress * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Výpočty používajú ilustratívne priemerné ročné výnosy a
                    mesačné zložené úročenie.
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800 space-y-3">
                  <div className="font-medium">Trajektória portfólia</div>
                  <div className="h-48 md:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={series}
                        margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={(v) => `${Math.floor(v / 12)}y`}
                        />
                        <YAxis
                          tickFormatter={(v) => v.toLocaleString("sk-SK")}
                        />
                        <Tooltip
                          formatter={(v: any) => euro(Number(v))}
                          labelFormatter={(v: any) => `Mesiac ${v}`}
                        />
                        <Line type="monotone" dataKey="value" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800">
                  <div className="font-medium mb-2">
                    Rizikový profil portfólia
                  </div>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {Object.keys(assets).map((k) => (
                      <li key={k} className="flex items-center justify-between">
                        <span>{k}</span>
                        <span>
                          {pctFmt(normMix[k] || 0)} · oč. výnos{" "}
                          {pctFmt(assets[k].expReturn)} · základné riziko{" "}
                          {assets[k].risk}/10
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs text-slate-500 mt-2">
                    Skutočné skóre rizika sa škáluje podľa váh; pozri horný
                    panel.
                  </div>
                </div>
              </div>

              <div className="space-y-6 xl:order-2">
                <div className="space-y-4 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 xl:sticky xl:top-4">
                  <h2 className="text-xl font-semibold">
                    4) Portfóliové metriky & odporúčania
                  </h2>
                  <div className="font-medium">Portfóliové metriky</div>
                  <div>
                    <div className="text-sm text-slate-400">Výnos / riziko</div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${clamp((rr / 3) * 100, 0, 100)}%`,
                          background: rrBand.color,
                        }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {rr.toFixed(2)} % p.a. na 1 bod rizika ·{" "}
                      <span style={{ color: rrBand.color }}>
                        {rrBand.label}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-slate-400">Top podiely</div>
                    <ul className="text-sm text-slate-300">
                      {topMix.map(([k, w]) => (
                        <li
                          key={k}
                          className="flex items-center justify-between"
                        >
                          <span>{k}</span>
                          <span>{pctFmt(w)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                  <div className="font-medium">Doporučenie na ďalší krok</div>
                  <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                    {missingReserve > 0 && (
                      <li>
                        Najprv dobuduj rezervu približne {euro(missingReserve)}{" "}
                        (≈ {emergencyMonths} mesačných príjmov).
                      </li>
                    )}
                    {monthlyInvest > savings && (
                      <li>
                        Zníž pravidelnú investíciu alebo výdavky: aktuálne
                        investuješ viac než voľná hotovosť.
                      </li>
                    )}
                    {goldPct < 0.1 && (
                      <li>
                        Nedotýkaj sa zlatej rezervy: doplň aspoň 10 % do zlata,
                        nech chrániš stabilitu portfólia.
                      </li>
                    )}
                    {cashExceeded && (
                      <li>
                        Hotovosť tvorí {(cashPct * 100).toFixed(0)} %. Zváž
                        presun prebytočnej časti do výnosnejších a
                        diverzifikovaných zložiek.
                      </li>
                    )}
                    {riskExceeded && (
                      <li>
                        Riziko presahuje odporúčaný limit {RISK_THRESHOLD}/10 –
                        uprav mix (menej Dynamické/Krypto, viac
                        dlhopisov/zlata).
                      </li>
                    )}
                    {riskHardBlock && (
                      <li className="text-rose-300">
                        Max. riziko 10/10 prekročené – bez úpravy mixu nebude
                        možné pokračovať.
                      </li>
                    )}
                    {goalProgress < 1 && (
                      <li>
                        Pre splnenie cieľa skús zvýšiť horizont, pravidelnú sumu
                        alebo upraviť mix s vyšším očakávaným výnosom (za cenu
                        rizika).
                      </li>
                    )}
                    {goalProgress >= 1 && <li>Gratulujem! Dosahuješ cieľ.</li>}
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
// }
*/

/* ============================
   Reusable fields
============================ */
function Field({
  label,
  value,
  setValue,
  min = 0,
  max = 100,
  step = 1,
  prefix,
}: {
  label: string;
  value: number;
  setValue: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
}) {
  const toNumber = (x: any) => {
    const n = Number(x);
    return isFinite(n) ? n : 0;
  };

  const onNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = toNumber(e.target.value);
    setValue(clamp(raw, min, max));
  };

  const onRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = toNumber(e.target.value);
    setValue(clamp(raw, min, max));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-slate-200">{label}</label>
        <div className="flex items-center gap-1">
          {prefix ? (
            <span className="text-slate-400 text-sm">{prefix}</span>
          ) : null}
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step}
            value={Number.isFinite(value) ? value : 0}
            onChange={onNumChange}
            onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
            className="w-24 rounded-lg bg-slate-950/60 border border-slate-800 px-2 py-1 text-sm text-slate-100 text-right"
          />
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={onRangeChange}
        onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
        className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}

type SmallFieldProps = {
  label: string;
  value: number;
  setValue: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
};
function SmallField(props: SmallFieldProps) {
  const { label, value, setValue, min, max, step = 1, prefix } = props;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <label className="text-slate-300">{label}</label>
        <div className="text-slate-400">
          {prefix ? `${prefix} ` : ""}
          {Number(value).toLocaleString("sk-SK")}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-28 rounded-lg bg-slate-950/60 border border-slate-800 px-2 py-1 text-sm text-slate-100"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          onWheel={(e) => e.currentTarget.blur()}
          className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
}

type MixFieldProps = {
  label: string;
  value: number;
  setValue: (v: number) => void;
  reUnlocked: boolean;
};
function MixField(props: MixFieldProps) {
  const { label, value, setValue, reUnlocked } = props;
  const hardMin = label === "Zlato (fyzické)" ? 10 : 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-200">{label}</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={hardMin}
            max={100}
            step={1}
            disabled={label === "Reality (komerčné)" && !reUnlocked}
            value={Number(value) || 0}
            onChange={(e) =>
              setValue(
                Math.min(100, Math.max(hardMin, Number(e.target.value || 0)))
              )
            }
            className="w-16 rounded-lg bg-slate-950/60 border border-slate-800 px-2 py-1 text-sm text-slate-100"
          />
          <span className="text-sm text-slate-400">%</span>
        </div>
      </div>

      <input
        type="range"
        min={hardMin}
        max={100}
        step={1}
        disabled={label === "Reality (komerčné)" && !reUnlocked}
        value={Number(value) || 0}
        onChange={(e) =>
          setValue(
            Math.min(100, Math.max(hardMin, Number(e.target.value || 0)))
          )
        }
        onWheel={(e) => e.currentTarget.blur()}
        className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer"
      />

      {label === "Reality (komerčné)" && !reUnlocked && (
        <div className="text-xs text-slate-500 mt-1">
          Odomkne sa pri príjme ≥ 3 500 € alebo jednorazovej investícii ≥ 300
          000 €
        </div>
      )}
    </div>
  );
}

/* ============================
   Lightweight tests (console)
============================ */
(function runTests() {
  const approx = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
  console.assert(
    approx(fvMonthly({ initial: 1000, monthly: 0, years: 1, rate: 0 }), 1000),
    "fvMonthly: zero rate lumpsum"
  );
  console.assert(
    approx(fvMonthly({ initial: 0, monthly: 100, years: 1, rate: 0 }), 1200),
    "fvMonthly: zero rate annuity"
  );
  const v = fvMonthly({ initial: 0, monthly: 100, years: 1, rate: 0.12 });
  console.assert(v > 1200, "fvMonthly: positive rate should exceed simple sum");
})();

if (typeof window !== "undefined" && import.meta?.env?.DEV) {
  const rr = computeRisk(
    {
      "ETF (svet – aktívne)": 0.3,
      "Zlato (fyzické)": 0.2,
      "Krypto (BTC/ETH)": 0.15,
      "Dynamické riadenie": 0.1,
      "Garantovaný dlhopis 7,5% p.a.": 0.15,
      "Hotovosť/rezerva": 0.1,
    },
    getAssetsByScenario("base")
  );
  console.assert(
    rr && typeof rr.raw === "number",
    "computeRisk: should return object with raw number"
  );
}
