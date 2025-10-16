// v3 persistence API – nikdy nevracia null; uiMode sa vynechá ak je null
export type UIMode = 'basic' | 'pro' | null;

export type V3Payload = {
  version: 3;
  // profil & cashflow (optional pre postupné dopĺňanie)
  monthlyIncome?: number;
  expensesFixed?: number;
  expensesVar?: number;
  reserveNow?: number;
  reserveMonths?: number;
  lumpSum?: number;
  monthly?: number; // monthlyContrib alias
  horizonYears?: number;
  goalAsset?: number;
  // invest & meta
  mix?: Record<string, number>;
  clientType?: 'individual' | 'family' | 'company';
  riskPref?: 'conservative' | 'balanced' | 'growth';
  crisisBias?: number; // 0..3
  debts?: Array<any>;
  // ui
  uiMode?: Exclude<UIMode, null>; // vynechať ak null
};

const KEY = 'unotop_v3';

const defaults: V3Payload = { version: 3 };

export function readLS(): V3Payload {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<V3Payload> | null;
    // Nikdy nevracaj null – vždy základ s version:3
    return { ...defaults, ...(parsed ?? {}) };
  } catch {
    return { ...defaults };
  }
}

export function writeLS(data: Partial<V3Payload> & { uiMode?: UIMode }): void {
  try {
    const { uiMode, ...rest } = data;
    const prev = readLS();
    const payload: V3Payload = {
      ...prev,
      ...rest,
      // vynecháme uiMode ak je null/undefined
      ...(uiMode ? { uiMode } : {}),
      version: 3,
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // swallow
  }
}
