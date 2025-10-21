/**
 * Projection Engine - Core Logic
 * Simuluje mesačnú trajektóriu investícií a amortizáciu dlhov
 */

import type {
  SimulationParams,
  SimulationResult,
  SimulationPoint,
  DebtInput,
} from "./types";

/**
 * Vypočítaj anuitu (mesačnú splátku) pre dlh
 * M = P * r / (1 - (1+r)^(-n))
 */
function calculateAnnuity(
  principal: number,
  monthlyRate: number,
  termMonths: number
): number {
  if (termMonths <= 0 || principal <= 0) return 0;
  if (monthlyRate === 0) return principal / termMonths; // edge case: 0% úrok
  const denominator = 1 - Math.pow(1 + monthlyRate, -termMonths);
  return (principal * monthlyRate) / denominator;
}

/**
 * Stavový objekt pre jeden dlh počas simulácie
 */
interface DebtState {
  id: string;
  r: number; // mesačná úroková sadzba
  M: number; // pôvodná anuita (nemenná)
  balance: number; // aktuálny zostatok
  oneOffMap: Map<number, number>; // {mesiac → suma} pre jednorazové extra
  recurring: { startMonth: number; amount: number } | null;
}

/**
 * Hlavná simulácia: investície × dlhy × mimoriadne splátky
 * 
 * Algoritmus:
 * 1. Pre každý mesiac t:
 *    a) Investície: V_t = (V_{t-1} + monthly) * (1 + r_inv)
 *    b) Dlhy: pre každý dlh amortizuj podľa M + extra, skráť zostatok
 * 2. Zaznamenaj stav (investValue, totalDebtBalance)
 * 3. Detekuj prvý mesiac prelomu (crossover)
 * 
 * @param params - Investičné a dlhové parametre
 * @returns SimulationResult s mesačnými dátami a crossover bodom
 */
export function simulateProjection(
  params: SimulationParams
): SimulationResult {
  const { horizonMonths, invest, debts } = params;

  // Investičná mesačná výnosová sadzba: (1 + r_annual)^(1/12) - 1
  const rInv =
    invest.annualYieldPct > 0
      ? Math.pow(1 + invest.annualYieldPct / 100, 1 / 12) - 1
      : 0;

  // Inicializácia stavov dlhov
  const debtStates: DebtState[] = debts.map((d) => {
    const r = d.annualRate / 100 / 12; // mesačná sadzba
    const M = calculateAnnuity(d.principal, r, d.termMonths);
    return {
      id: d.id,
      r,
      M,
      balance: d.principal,
      oneOffMap: new Map((d.oneOffExtras || []).map((e) => [e.month, e.amount])),
      recurring: d.recurringExtra || null,
    };
  });

  const series: SimulationPoint[] = [];
  let V = invest.startLumpSum; // počiatočná investičná hodnota

  // t = 0 (vstupný bod)
  const t0TotalDebt = debtStates.reduce((sum, s) => sum + s.balance, 0);
  series.push({
    month: 0,
    investValue: V,
    totalDebtBalance: t0TotalDebt,
    perDebtBalance: Object.fromEntries(
      debtStates.map((s) => [s.id, s.balance])
    ),
  });

  // Mesačná simulácia (t = 1 až horizonMonths)
  for (let t = 1; t <= horizonMonths; t++) {
    // 1) INVESTÍCIE: pridaj mesačný vklad, potom zhodnoť
    V = (V + invest.monthly) * (1 + rInv);

    // 2) DLHY: amortizácia pre každý aktívny dlh
    for (const s of debtStates) {
      if (s.balance <= 0) continue; // už vyplatený

      // Extra splátky v tomto mesiaci
      const extraOnce = s.oneOffMap.get(t) ?? 0;
      const extraRecur =
        s.recurring && t >= s.recurring.startMonth
          ? s.recurring.amount
          : 0;

      // Úrok z aktuálneho zostatku
      const interest = s.balance * s.r;

      // Celková suma na zníženie istiny (anuita + extras - úrok)
      // Poznámka: M už zahŕňa úrok + istinu, takže: principalPart = (M - interest) + extras
      let principalPart = s.M - interest + extraRecur + extraOnce;

      // Poistka: ak by principalPart bola záporná (hypoteticky pri veľmi nízkych M)
      if (principalPart < 0) principalPart = 0;

      // Zníženie zostatku (nesmie ísť pod nulu)
      const newBalance = Math.max(0, s.balance - principalPart);
      s.balance = newBalance;
    }

    // 3) SUMÁR stavu v čase t
    const totalDebtBalance = debtStates.reduce((sum, s) => sum + s.balance, 0);

    series.push({
      month: t,
      investValue: V,
      totalDebtBalance,
      perDebtBalance: Object.fromEntries(
        debtStates.map((s) => [s.id, s.balance])
      ),
    });

    // Early exit (voliteľné): ak všetky dlhy splatené a horizon dlhý
    // if (totalDebtBalance === 0 && t > 24) break;
  }

  // 4) CROSSOVER DETECTION: prvý mesiac, kde investValue >= totalDebtBalance
  let crossoverMonth: number | null = null;
  for (const p of series) {
    if (p.investValue >= p.totalDebtBalance && p.totalDebtBalance > 0) {
      crossoverMonth = p.month;
      break;
    }
  }

  // Final values
  const lastPoint = series[series.length - 1];
  const finalInvestValue = lastPoint.investValue;
  const finalDebtBalance = lastPoint.totalDebtBalance;

  return {
    series,
    crossoverMonth,
    finalInvestValue,
    finalDebtBalance,
  };
}

/**
 * Helper: Konverzia mesiace → roky (pre os X grafu)
 */
export function monthsToYears(months: number): number {
  return months / 12;
}

/**
 * Helper: Formátovanie sumy pre tooltip
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Diagnostický výpočet: podiel úroku v prvej splátke anuity
 * u1_share ≈ 1 - (1+r)^(-n)
 * (Použiť pre zobrazovanie infotextu)
 */
export function getInterestShareFirstPayment(
  annualRate: number,
  termMonths: number
): number {
  if (termMonths <= 0) return 0;
  const r = annualRate / 100 / 12;
  return 1 - Math.pow(1 + r, -termMonths);
}
