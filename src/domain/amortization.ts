export type AmortInput = {
  principal: number;
  ratePa: number; // e.g. 0.12 for 12% p.a.
  termMonths: number;
  monthlyPayment: number;
  extraMonthly?: number;
  extraOnce?: number;
  extraOnceAtMonth?: number; // 1-based month index
};

export type AmortMonth = {
  month: number; // 1..N
  interest: number;
  principal: number;
  balance: number;
};

export type AmortResult = {
  months: AmortMonth[];
  negativeAmort: boolean;
};

export function buildAmortSchedule(inp: AmortInput): AmortResult {
  const {
    principal,
    ratePa,
    termMonths,
    monthlyPayment,
    extraMonthly = 0,
    extraOnce = 0,
    extraOnceAtMonth = 0,
  } = inp;
  const r = Math.max(0, ratePa) / 12;
  let bal = Math.max(0, principal);
  const out: AmortMonth[] = [];
  let negativeAmort = false;

  // If payment doesn't cover interest, mark negative amortization, but still progress with minimal steps
  if (r > 0 && monthlyPayment <= bal * r) {
    negativeAmort = true;
  }

  for (let m = 1; m <= Math.max(1, Math.floor(termMonths)); m++) {
    if (bal <= 0) break;
    const interest = bal * r;
    let pay = Math.max(0, monthlyPayment) + Math.max(0, extraMonthly);
    if (extraOnce > 0 && m === Math.floor(extraOnceAtMonth)) {
      pay += extraOnce;
    }
    let principalPay = Math.max(0, pay - interest);
    if (principalPay > bal) principalPay = bal;
    bal = Math.max(0, bal - principalPay);
    out.push({ month: m, interest, principal: principalPay, balance: bal });
  }
  return { months: out, negativeAmort };
}
