/**
 * PR-4: AddDebtModal - Jednoduchý modal na pridanie dlhu
 *
 * Polia:
 * - Typ: Spotrebiteľský / Hypotéka
 * - Výška úveru (€)
 * - Úrok p.a. (%)
 * - Splatnosť (roky)
 * - Mimoriadna mesačná splátka (€) - voliteľné
 */

import React from "react";
import { writeV3, readV3, type Debt } from "../../persist/v3";
import { TEST_IDS } from "../../testIds";
import { buildAmortSchedule } from "../../domain/amortization";

interface AddDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddDebtModal: React.FC<AddDebtModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [debtType, setDebtType] = React.useState<"consumer" | "mortgage">(
    "consumer"
  );
  const [principal, setPrincipal] = React.useState("");
  const [rate, setRate] = React.useState("");
  const [years, setYears] = React.useState("");
  const [extraMonthly, setExtraMonthly] = React.useState("");

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const resetForm = () => {
    setDebtType("consumer");
    setPrincipal("");
    setRate("");
    setYears("");
    setExtraMonthly("");
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const principalNum = Number(principal);
    const rateNum = Number(rate);
    const yearsNum = Number(years);

    if (!principal || principalNum <= 0) {
      newErrors.principal = "Zadajte výšku úveru (min. 1 €)";
    }
    if (!rate || rateNum < 0 || rateNum > 100) {
      newErrors.rate = "Zadajte úrok p.a. (0-100 %)";
    }
    if (!years || yearsNum <= 0 || yearsNum > 50) {
      newErrors.years = "Zadajte splatnosť (1-50 rokov)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const principalNum = Number(principal);
    const rateNum = Number(rate) / 100; // % → decimal
    const yearsNum = Number(years);
    const extraMonthlyNum = extraMonthly ? Number(extraMonthly) : 0;
    const termMonths = yearsNum * 12;

    // Vypočítaj mesačnú splátku (annuita)
    const r = rateNum / 12;
    let monthlyPayment: number;

    if (r === 0) {
      // Bez úroku
      monthlyPayment = principalNum / termMonths;
    } else {
      // Annuita: P * [r(1+r)^n] / [(1+r)^n - 1]
      const pow = Math.pow(1 + r, termMonths);
      monthlyPayment = (principalNum * (r * pow)) / (pow - 1);
    }

    // Vytvor amortizačný plán
    const schedule = buildAmortSchedule({
      principal: principalNum,
      ratePa: rateNum,
      termMonths,
      monthlyPayment,
      extraMonthly: extraMonthlyNum,
    });

    // Vytvor debt objekt
    const v3 = readV3();
    const existingDebts = v3.debts || [];
    const newId = `debt-${Date.now()}`;
    const newDebt: Debt = {
      id: newId,
      name: debtType === "mortgage" ? "Hypotéka" : "Spotrebiteľský úver",
      principal: principalNum,
      ratePa: rateNum * 100, // späť na %
      monthly: monthlyPayment + extraMonthlyNum,
      monthsLeft: termMonths, // PR-13 FIX: Použiť pôvodný termMonths, nie schedule.months.length
      remaining: schedule.months[schedule.months.length - 1]?.balance || 0,
      extraMonthly: extraMonthlyNum,
    };

    // Pridaj do persist
    writeV3({
      debts: [...existingDebts, newDebt],
    });

    resetForm();
    onSuccess?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      // PR-13: Klik na backdrop nezatvára modal (len tlačidlo Zavrieť alebo ESC)
      // PR-13: z-index fix (z-50 → z-[1100], nad StickyBottomBar z-[1000])
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-debt-title"
      data-testid={TEST_IDS.MODAL_ADD_DEBT}
    >
      <div
        className="bg-slate-800 rounded-2xl p-6 max-w-md w-full ring-1 ring-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4">
          <h2 id="add-debt-title" className="text-xl font-semibold">
            Pridať dlh
          </h2>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Typ dlhu */}
          <div>
            <label className="text-xs text-slate-400 block mb-2">
              Typ dlhu
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid={TEST_IDS.DEBT_TYPE}
                onClick={() => setDebtType("consumer")}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  debtType === "consumer"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                Spotrebiteľský
              </button>
              <button
                type="button"
                onClick={() => setDebtType("mortgage")}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  debtType === "mortgage"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                Hypotéka
              </button>
            </div>
          </div>

          {/* Výška úveru */}
          <div>
            <label
              htmlFor="debt-principal"
              className="text-xs text-slate-400 block mb-1"
            >
              Výška úveru (€)
            </label>
            <input
              id="debt-principal"
              type="number"
              data-testid={TEST_IDS.DEBT_PRINCIPAL}
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              placeholder="napr. 50000"
              className={`w-full px-3 py-2 rounded-lg bg-slate-700 text-white placeholder:text-slate-500 ${
                errors.principal
                  ? "ring-2 ring-red-500"
                  : "ring-1 ring-white/10"
              }`}
            />
            {errors.principal && (
              <p className="text-xs text-red-400 mt-1">{errors.principal}</p>
            )}
          </div>

          {/* Úrok p.a. */}
          <div>
            <label
              htmlFor="debt-rate"
              className="text-xs text-slate-400 block mb-1"
            >
              Úrok p.a. (%)
            </label>
            <input
              id="debt-rate"
              type="number"
              step="0.01"
              data-testid={TEST_IDS.DEBT_RATE}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="napr. 5.5"
              className={`w-full px-3 py-2 rounded-lg bg-slate-700 text-white placeholder:text-slate-500 ${
                errors.rate ? "ring-2 ring-red-500" : "ring-1 ring-white/10"
              }`}
            />
            {errors.rate && (
              <p className="text-xs text-red-400 mt-1">{errors.rate}</p>
            )}
          </div>

          {/* Splatnosť */}
          <div>
            <label
              htmlFor="debt-years"
              className="text-xs text-slate-400 block mb-1"
            >
              Splatnosť (roky)
            </label>
            <input
              id="debt-years"
              type="number"
              data-testid={TEST_IDS.DEBT_YEARS}
              value={years}
              onChange={(e) => setYears(e.target.value)}
              placeholder="napr. 10"
              className={`w-full px-3 py-2 rounded-lg bg-slate-700 text-white placeholder:text-slate-500 ${
                errors.years ? "ring-2 ring-red-500" : "ring-1 ring-white/10"
              }`}
            />
            {errors.years && (
              <p className="text-xs text-red-400 mt-1">{errors.years}</p>
            )}
          </div>

          {/* Mimoriadna splátka (voliteľné) */}
          <div>
            <label
              htmlFor="debt-extra"
              className="text-xs text-slate-400 block mb-1"
            >
              Mimoriadna mesačná splátka (€) - voliteľné
            </label>
            <input
              id="debt-extra"
              type="number"
              data-testid={TEST_IDS.DEBT_EXTRA_MONTHLY}
              value={extraMonthly}
              onChange={(e) => setExtraMonthly(e.target.value)}
              placeholder="napr. 100"
              className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white placeholder:text-slate-500 ring-1 ring-white/10"
            />
          </div>

          {/* Akcie */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            >
              Zrušiť
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium"
            >
              Pridať dlh
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
