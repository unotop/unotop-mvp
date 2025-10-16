export type DebtType = 'hypoteka' | 'spotrebny' | 'auto' | 'ine';

export interface Debt {
  id: string;
  type: DebtType;
  name?: string;
  balance: number; // € zostávajúca istina
  rate_pa: number; // % p.a.
  monthly_payment: number; // € / mesiac
  months_remaining: number; // zostávajúce mesiace (informatívne)
  fixed_until_month?: number; // voliteľné, informatívne
}

export interface AmortizationResult {
  months: number;
  totalInterest: number;
}

/**
 * Jednoduchá amortizácia: iteruje po mesiacoch s fixnou splátkou (plus extra) a vracia mesiace do nuly a zaplatené úroky.
 * Guard: ak splátka nepokrýva ani úrok, vráti pôvodné months_remaining a úrok ako NaN (nedáva zmysel pokračovať).
 */
export function amortize(debt: Debt, extraMonthly = 0): AmortizationResult {
  let balance = Math.max(0, debt.balance || 0);
  const r = Math.max(0, (debt.rate_pa || 0) / 100 / 12);
  const payment = Math.max(0, (debt.monthly_payment || 0) + Math.max(0, extraMonthly));
  if (balance <= 0) return { months: 0, totalInterest: 0 };
  if (r === 0) {
    if (payment <= 0) return { months: debt.months_remaining || 0, totalInterest: 0 };
    const months = Math.ceil(balance / payment);
    return { months, totalInterest: 0 };
  }
  let months = 0;
  let interestSum = 0;
  let safeGuard = 0;
  while (balance > 0 && months < 3600) {
    const interest = balance * r;
    if (payment <= interest + 1e-9) {
      // neodporúčaná situácia: splátka nepostačuje na zníženie istiny
      return { months: debt.months_remaining || months, totalInterest: NaN };
    }
    const principal = payment - interest;
    balance = Math.max(0, balance - principal);
    interestSum += interest;
    months++;
    if (++safeGuard > 12000) break; // brut guard
  }
  return { months, totalInterest: interestSum };
}

function fvMonthly(oneTime: number, monthly: number, years: number, rPa: number) {
  const n = Math.max(0, Math.floor(years * 12));
  const r = rPa / 12;
  let v = oneTime;
  for (let m = 1; m <= n; m++) v = v * (1 + r) + monthly;
  return v;
}

export interface CompareResult {
  payDown: { months: number; savedInterest: number };
  invest: { fv: number; er_pa: number };
  verdict: 'splácať' | 'investovať';
}

/**
 * Porovnanie: variant A – extra splácať; variant B – investovať extra do portfólia s očak. výnosom er_pa.
 * Bezpečnostná rezerva: 2 p.b. (0.02).
 */
export function comparePayDownVsInvestWithER(
  debt: Debt,
  extraMonthly: number,
  horizonYears: number,
  expectedReturn_pa: number
): CompareResult {
  const base = amortize(debt, 0);
  const withExtra = amortize(debt, Math.max(0, extraMonthly));
  const savedInterest = isFinite(base.totalInterest) && isFinite(withExtra.totalInterest)
    ? Math.max(0, (base.totalInterest || 0) - (withExtra.totalInterest || 0))
    : 0;
  const fv = fvMonthly(0, Math.max(0, extraMonthly), horizonYears, Math.max(0, expectedReturn_pa || 0));
  const decisionThreshold = Math.max(0, expectedReturn_pa - 0.02);
  const verdict: 'splácať' | 'investovať' = (debt.rate_pa/100) > decisionThreshold ? 'splácať' : 'investovať';
  return {
    payDown: { months: withExtra.months, savedInterest },
    invest: { fv, er_pa: expectedReturn_pa },
    verdict,
  };
}

// Komfortná obálka so samostatným výpočtom expectedReturn_pa môže žiť v App – tu ponecháme alias
export const comparePayDownVsInvest = comparePayDownVsInvestWithER;
