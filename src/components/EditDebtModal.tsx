/**
 * PR-13 Task 1: EditDebtModal - refactor s validaciami
 *
 * Validacne limity:
 * - Hypoteka: max 2M EUR, urok <= 10%, roky <= 50
 * - Spotrebny: max 100k EUR, urok <= 30%, roky <= 10
 * - Mimoriadna splatka: max 20% istiny/rok / 12
 */

import React, { useState, useEffect, useRef } from "react";
import type { Debt } from "../persist/v3";
import { TEST_IDS } from "../testIds";

// PR-13: Validacne limity
export const DEBT_LIMITS = {
  mortgage: {
    maxPrincipal: 2_000_000,
    maxRate: 10,
    maxYears: 50,
  },
  consumer: {
    maxPrincipal: 100_000,
    maxRate: 30,
    maxYears: 10,
  },
  extraMonthlyRatio: 0.2,
} as const;

interface EditDebtModalProps {
  debt: Debt | null;
  onClose: () => void;
  onSave: (updated: Debt) => void;
}

export function EditDebtModal({ debt, onClose, onSave }: EditDebtModalProps) {
  const [type, setType] = useState<"mortgage" | "consumer">("mortgage");
  const [name, setName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [ratePa, setRatePa] = useState("");
  const [years, setYears] = useState("");
  const [extraMonthly, setExtraMonthly] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isEdit = !!debt;

  // Hydrate from debt prop
  useEffect(() => {
    if (debt) {
      // PR-13 Fix: Type default na mortgage ak nie je nastavený
      setType(debt.type || "mortgage");
      setName(debt.name || "");
      setPrincipal(debt.principal?.toString() || "");
      setRatePa(debt.ratePa?.toFixed(1) || ""); // PR-13 Fix: 1 desatinné miesto
      setYears(
        debt.monthsLeft ? Math.round(debt.monthsLeft / 12).toString() : ""
      ); // PR-13 Fix: Celé číslo
      setExtraMonthly(debt.extraMonthly?.toString() || "");
      setErrors({});
    }
  }, [debt]);

  // Close on Esc
  useEffect(() => {
    if (!debt) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [debt, onClose]);

  // Focus trap
  useEffect(() => {
    if (debt && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [debt]);

  if (!debt) return null;

  // Validacia
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const principalNum = parseFloat(principal);
    const rateNum = parseFloat(ratePa);
    const yearsNum = parseFloat(years);
    const extraNum = parseFloat(extraMonthly || "0");

    const limits =
      type === "mortgage" ? DEBT_LIMITS.mortgage : DEBT_LIMITS.consumer;

    if (!name.trim()) {
      newErrors.name = "Názov je povinný";
    }

    if (!principal || isNaN(principalNum) || principalNum <= 0) {
      newErrors.principal = "Istina musí byť > 0 €";
    } else if (principalNum > limits.maxPrincipal) {
      newErrors.principal = `${
        type === "mortgage" ? "Hypotéka" : "Spotrebný úver"
      } max ${limits.maxPrincipal.toLocaleString("sk-SK")} €`;
    }

    if (!ratePa || isNaN(rateNum) || rateNum <= 0) {
      newErrors.ratePa = "Úrok musí byť > 0 %";
    } else if (rateNum > limits.maxRate) {
      newErrors.ratePa = `${
        type === "mortgage" ? "Hypotéka" : "Spotrebný úver"
      } max ${limits.maxRate} % p.a.`;
    }

    if (!years || isNaN(yearsNum) || yearsNum <= 0) {
      newErrors.years = "Splatnosť musí byť > 0 rokov";
    } else if (yearsNum > limits.maxYears) {
      newErrors.years = `${
        type === "mortgage" ? "Hypotéka" : "Spotrebný úver"
      } max ${limits.maxYears} rokov`;
    }

    if (extraNum > 0) {
      const maxExtraMonthly =
        (principalNum * DEBT_LIMITS.extraMonthlyRatio) / 12;
      if (extraNum > maxExtraMonthly) {
        newErrors.extraMonthly = `Max ${maxExtraMonthly.toFixed(
          0
        )} € mesačne (20 % istiny/rok)`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const principalNum = parseFloat(principal);
    const rateNum = parseFloat(ratePa);
    const yearsNum = parseFloat(years);
    const extraNum = parseFloat(extraMonthly || "0");
    const monthsLeft = Math.round(yearsNum * 12);

    const monthlyRate = rateNum / 100 / 12;
    const monthly =
      monthlyRate > 0
        ? (principalNum * monthlyRate) /
          (1 - Math.pow(1 + monthlyRate, -monthsLeft))
        : principalNum / monthsLeft;

    const savedDebt: Debt = {
      id: debt.id,
      type,
      name: name.trim(),
      principal: principalNum,
      ratePa: rateNum,
      monthly,
      monthsLeft,
      extraMonthly: extraNum > 0 ? extraNum : undefined,
    };

    onSave(savedDebt);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      // PR-13: Klik na backdrop nezatvára modal (len tlačidlo Zrušiť alebo ESC)
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-debt-title"
      data-testid={TEST_IDS.EDIT_DEBT_MODAL}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 ring-1 ring-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/5">
          <h2
            id="edit-debt-title"
            className="text-xl font-bold text-white flex items-center gap-2"
          >
            <span>{isEdit ? "✏️" : "➕"}</span>
            <span>{isEdit ? "Upraviť dlh" : "Pridať dlh"}</span>
          </h2>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Typ
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setType("mortgage")}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  type === "mortgage"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
                data-testid={TEST_IDS.DEBT_TYPE_MORTGAGE}
              >
                🏠 Hypotéka
              </button>
              <button
                type="button"
                onClick={() => setType("consumer")}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  type === "consumer"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
                data-testid={TEST_IDS.DEBT_TYPE_CONSUMER}
              >
                💳 Spotrebný
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="edit-debt-name"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Názov
            </label>
            <input
              id="edit-debt-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="napr. Byt Bratislava, Auto..."
              className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              data-testid={TEST_IDS.DEBT_NAME_INPUT}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="edit-debt-principal"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Výška istiny €
            </label>
            <input
              id="edit-debt-principal"
              type="number"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              data-testid={TEST_IDS.DEBT_PRINCIPAL_INPUT}
            />
            {errors.principal && (
              <p className="mt-1 text-xs text-red-400">{errors.principal}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="edit-debt-rate"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Úrok p.a. %
            </label>
            <input
              id="edit-debt-rate"
              type="number"
              step="0.1"
              value={ratePa}
              onChange={(e) => setRatePa(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              data-testid={TEST_IDS.DEBT_RATE_INPUT}
            />
            {errors.ratePa && (
              <p className="mt-1 text-xs text-red-400">{errors.ratePa}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="edit-debt-years"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Splatnosť (roky)
            </label>
            <input
              id="edit-debt-years"
              type="number"
              step="0.5"
              value={years}
              onChange={(e) => setYears(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              data-testid={TEST_IDS.DEBT_YEARS_INPUT}
            />
            {errors.years && (
              <p className="mt-1 text-xs text-red-400">{errors.years}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="edit-debt-extra"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Mimoriadna mesačná splátka €{" "}
              <span className="text-slate-500">(voliteľné)</span>
            </label>
            <input
              id="edit-debt-extra"
              type="number"
              value={extraMonthly}
              onChange={(e) => setExtraMonthly(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 text-white border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              data-testid={TEST_IDS.DEBT_EXTRA_INPUT}
            />
            {errors.extraMonthly && (
              <p className="mt-1 text-xs text-red-400">{errors.extraMonthly}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-slate-900/80">
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
            data-testid={TEST_IDS.DEBT_CANCEL_BTN}
          >
            Zrušiť
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-medium transition-colors"
            data-testid={TEST_IDS.DEBT_SAVE_BTN}
          >
            {isEdit ? "Uložiť" : "Pridať"}
          </button>
        </div>
      </div>
    </div>
  );
}
