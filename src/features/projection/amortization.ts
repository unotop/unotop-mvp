/**
 * amortization.ts - Debt amortization simulator
 * Podporuje štandardnú anuitnú schému + mimoriadne splátky
 */

export interface DebtSnapshot {
  month: number;
  balance: number;
  interest: number;
  principal: number;
  payment: number;
}

export interface ExtraPayment {
  month: number; // Mesiac aplikácie (1-indexed)
  amount: number; // EUR
}

export interface DebtAmortizationInput {
  principal: number; // Počiatočná istina (EUR)
  ratePa: number; // Ročná úroková sadzba (napr. 0.05 = 5%)
  monthlyPayment: number; // Pravidelná mesačná splátka (EUR)
  monthlyExtra?: number; // Mesačná mimoriadna splátka (každý mesiac)
  oneOffExtras?: ExtraPayment[]; // Jednorazové mimoriadne splátky
}

/**
 * Simuluje amortizáciu dlhu po mesiacoch
 * @param input - Parametre dlhu
 * @param horizonMonths - Maximálny počet mesiacov simulácie
 * @returns Pole s balance pre každý mesiac; po doplatení balance=0
 */
export function simulateDebtAmortization(
  input: DebtAmortizationInput,
  horizonMonths: number
): DebtSnapshot[] {
  const {
    principal,
    ratePa,
    monthlyPayment,
    monthlyExtra = 0,
    oneOffExtras = [],
  } = input;

  if (principal <= 0 || monthlyPayment <= 0) {
    // Ak nie je dlh alebo splátka, vráť nulové balance
    return Array.from({ length: horizonMonths }, (_, i) => ({
      month: i + 1,
      balance: 0,
      interest: 0,
      principal: 0,
      payment: 0,
    }));
  }

  const monthlyRate = ratePa / 12;
  let balance = principal;
  const snapshots: DebtSnapshot[] = [];

  // Index extra payments pre rýchle vyhľadanie
  const extraMap = new Map<number, number>();
  for (const extra of oneOffExtras) {
    extraMap.set(extra.month, (extraMap.get(extra.month) || 0) + extra.amount);
  }

  for (let month = 1; month <= horizonMonths; month++) {
    if (balance <= 0) {
      // Dlh už splatený, zvyšné mesiace balance=0
      snapshots.push({
        month,
        balance: 0,
        interest: 0,
        principal: 0,
        payment: 0,
      });
      continue;
    }

    // 1) Úrok za tento mesiac
    const interest = balance * monthlyRate;

    // 2) Pravidelná splátka (istina z pravidelnej splátky)
    const regularPrincipal = Math.max(0, monthlyPayment - interest);

    // 3) Mimoriadne splátky (mesačná + jednorazová)
    const extraThisMonth = monthlyExtra + (extraMap.get(month) || 0);

    // 4) Celková suma istiny za tento mesiac
    const totalPrincipal = regularPrincipal + extraThisMonth;

    // 5) Nová balance (nemôže ísť pod 0)
    const newBalance = Math.max(0, balance - totalPrincipal);

    // 6) Skutočná zaplatená istina (ak balance < totalPrincipal, splatí sa iba zvyšok)
    const actualPrincipal = balance - newBalance;
    const actualPayment = interest + actualPrincipal;

    snapshots.push({
      month,
      balance: newBalance,
      interest,
      principal: actualPrincipal,
      payment: actualPayment,
    });

    balance = newBalance;
  }

  return snapshots;
}

/**
 * Helper: vypočítaj celkovú sumu dlhov v danom mesiaci
 * @param allDebts - Pole DebtSnapshot[] pre každý dlh
 * @param month - Mesiac (1-indexed)
 * @returns Suma všetkých balancov v danom mesiaci
 */
export function getTotalDebtBalance(
  allDebts: DebtSnapshot[][],
  month: number
): number {
  return allDebts.reduce((sum, debtSnapshots) => {
    const snapshot = debtSnapshots.find((s) => s.month === month);
    return sum + (snapshot?.balance || 0);
  }, 0);
}
