export type PersistState = Record<string, unknown>;

export const KEY = "unotop_v1";
const LEGACY_V3 = "unotop:v3";

// Module-level debounced writer with flush capability
let pending: PersistState | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function writeNow(data: PersistState) {
  try {
    // Strip obviously derived or unsafe fields if present
    const cleaned = JSON.parse(
      JSON.stringify(data, (_k, v) => (typeof v === "function" ? undefined : v))
    );
    localStorage.setItem(KEY, JSON.stringify(cleaned));
  } catch {
    // ignore quota/serialization errors
  }
}

export function flushState() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending) {
    writeNow(pending);
    pending = null;
  }
}

export function saveState(data: PersistState) {
  pending = data;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    if (pending) writeNow(pending);
    pending = null;
    timer = null;
  }, 200);
}

function migrateFromV3(raw: string): PersistState | null {
  try {
    const d = JSON.parse(raw);
    // Map legacy v3 payload fields to our v1 app state shape.
    const out: PersistState = {
      // profile
      clientType: d.clientType,
      riskPref: d.riskPref,
      // cashflow
      monthlyIncome: d.monthlyIncome,
      fixedExpenses: d.fixedExpenses,
      variableExpenses: d.variableExpenses,
      current_reserve: d.current_reserve,
      emergency_months: d.emergency_months,
      goal_asset: d.goal_asset,
      // portfolio
      mix: d.mix,
      // toggles
      uiMode: d.uiMode,
      riskMode: d.riskMode,
      // debts
      debts: Array.isArray(d.debts) ? d.debts : [],
      // debt vs invest inputs (not present in v3) -> defaults
      extraMonthly: 0,
      extraOnce: 0,
      extraOnceAtMonth: 0,
      mergePreview: false,
      // UI prefs
      sec0Open: typeof d.sec0Open === "boolean" ? d.sec0Open : true,
      sec1Open: typeof d.sec1Open === "boolean" ? d.sec1Open : true,
      sec2Open: typeof d.sec2Open === "boolean" ? d.sec2Open : true,
      sec3Open: typeof d.sec3Open === "boolean" ? d.sec3Open : true,
      sec4Open: typeof d.sec4Open === "boolean" ? d.sec4Open : true,
      sec5Open: typeof d.sec5Open === "boolean" ? d.sec5Open : true,
      showGraph: false,
      // extras
      lumpSum: d.lumpSum,
      monthlyContrib: d.monthlyContrib,
      horizon: d.horizon,
      crisisBias: d.crisisBias,
      agentEmail: d.agentEmail,
      referralLink: d.referralLink,
    };
    return out;
  } catch {
    return null;
  }
}

export function loadState<T = PersistState>(): T | null {
  // Try v1 first
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        // corrupted – cleanup
        localStorage.removeItem(KEY);
      }
    }
  } catch {}
  // Migrate from legacy v3 if available
  try {
    const v3 = localStorage.getItem(LEGACY_V3);
    if (v3) {
      const migrated = migrateFromV3(v3);
      if (migrated) {
        writeNow(migrated);
        return migrated as T;
      }
    }
  } catch {}
  return null;
}

export function resetState() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  try {
    localStorage.removeItem(LEGACY_V3);
  } catch {}
}
