/**
 * PR-9 Task B: Debt Amortization Engine v2
 * 
 * Správny výpočet mesačných splátok (úrok + istina) s podporou extra splátok.
 * 
 * Features:
 * - annuityPayment(): PMT formula (mesačná anuita)
 * - scheduleWithExtra(): plný plán splátok s extra monthly payments
 * - Sumarizácia: payoffMonth, totalInterest, monthsSaved, interestSaved
 */

export interface AmortizationSchedule {
  /** Mesačné zostatky (index = mesiac, value = zostatok po splátke) */
  balances: number[];
  
  /** Mesiac kedy je dlh splatený (0-indexed) */
  payoffMonth: number;
  
  /** Celkový zaplatený úrok */
  totalInterest: number;
  
  /** Ušetrené mesiace (ak je extra) */
  monthsSaved: number;
  
  /** Ušetrený úrok (ak je extra) */
  interestSaved: number;
}

/**
 * Vypočítaj mesačnú anuitu (PMT formula)
 * 
 * @param principal - Výška úveru (€)
 * @param annualRate - Ročný úrok (decimal, napr. 0.08 = 8%)
 * @param termMonths - Doba splácania (mesiace)
 * @returns Mesačná splátka (€)
 */
export function annuityPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  if (annualRate <= 0) return principal / termMonths; // Bezúročný úver
  
  const monthlyRate = annualRate / 12;
  const pmt =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  
  return pmt;
}

/**
 * Vygeneruj amortizačný plán s extra mesačnými splátkami
 * 
 * @param principal - Výška úveru (€)
 * @param annualRate - Ročný úrok (decimal, napr. 0.08 = 8%)
 * @param termMonths - Pôvodná doba splácania (mesiace)
 * @param extraMonthly - Extra mesačná splátka (€, default 0)
 * @returns AmortizationSchedule
 */
export function scheduleWithExtra(
  principal: number,
  annualRate: number,
  termMonths: number,
  extraMonthly = 0
): AmortizationSchedule {
  // Validácia vstupov
  if (principal <= 0 || termMonths <= 0) {
    return {
      balances: [0],
      payoffMonth: 0,
      totalInterest: 0,
      monthsSaved: 0,
      interestSaved: 0,
    };
  }

  const monthlyRate = annualRate / 12;
  const basePayment = annuityPayment(principal, annualRate, termMonths);
  
  // Vypočítaj plán BEZ extra (pre porovnanie)
  const baseSchedule = calculateSchedule(principal, monthlyRate, basePayment, termMonths, 0);
  
  // Vypočítaj plán S extra
  const extraSchedule = calculateSchedule(
    principal,
    monthlyRate,
    basePayment,
    termMonths,
    extraMonthly
  );
  
  return {
    balances: extraSchedule.balances,
    payoffMonth: extraSchedule.payoffMonth,
    totalInterest: extraSchedule.totalInterest,
    monthsSaved: Math.max(0, baseSchedule.payoffMonth - extraSchedule.payoffMonth),
    interestSaved: Math.max(0, baseSchedule.totalInterest - extraSchedule.totalInterest),
  };
}

/**
 * Helper: Vypočítaj plán splátok (core algoritmus)
 */
function calculateSchedule(
  principal: number,
  monthlyRate: number,
  basePayment: number,
  maxMonths: number,
  extraMonthly: number
): { balances: number[]; payoffMonth: number; totalInterest: number } {
  const balances: number[] = [];
  let balance = principal;
  let totalInterest = 0;
  let month = 0;

  balances.push(balance); // Month 0 = starting balance

  while (balance > 0.01 && month < maxMonths * 2) {
    // Safety: max 2x termMonths
    month++;

    // Úrok za tento mesiac
    const interestPayment = balance * monthlyRate;
    totalInterest += interestPayment;

    // Celková splátka = base + extra
    const totalPayment = basePayment + extraMonthly;

    // Istina = total payment - úrok
    let principalPayment = totalPayment - interestPayment;

    // Posledná splátka: nezaplatíme viac než zostatok
    if (principalPayment >= balance) {
      principalPayment = balance;
      balance = 0;
    } else {
      balance -= principalPayment;
    }

    balances.push(Math.max(0, balance));

    if (balance <= 0.01) {
      break; // Splatené
    }
  }

  return {
    balances,
    payoffMonth: month,
    totalInterest,
  };
}
