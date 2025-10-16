import React from "react";

function euro0(n: number) {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
function pct(n: number) {
  return (
    new Intl.NumberFormat("sk-SK", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(n * 100) + " %"
  );
}

export const FreeCashCard: React.FC<{
  monthlyIncome: number;
  fixed: number;
  variable: number;
  currentReserve: number;
  emergencyMonths: number;
  horizonYears: number;
  monthlyContrib: number;
  setMonthlyContrib: (v: number) => void;
  monthlyRef?: React.RefObject<HTMLInputElement | null>;
}> = ({
  monthlyIncome,
  fixed,
  variable,
  currentReserve,
  emergencyMonths,
  horizonYears,
  monthlyContrib,
  setMonthlyContrib,
  monthlyRef,
}) => {
  const incomeNet = Math.max(0, monthlyIncome - fixed - variable);
  const requiredReserve = Math.max(0, emergencyMonths * fixed);
  const reserveGap = Math.max(0, requiredReserve - currentReserve);
  const monthsToGoal = Math.max(1, Math.round(horizonYears * 12));
  const reserveGapMonthly = reserveGap / monthsToGoal;
  const freeCash = Math.max(0, incomeNet - reserveGapMonthly);
  const savingRate = Math.max(
    0,
    Math.min(1, freeCash / Math.max(1, monthlyIncome))
  );
  const target = Math.round(Math.round(freeCash / 50) * 50);
  function focusMonthlyField() {
    const input = monthlyRef?.current;
    if (input) {
      try {
        input.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch {}
      try {
        input.focus();
      } catch {}
      input.classList.add("animate-pulse");
      setTimeout(() => input.classList.remove("animate-pulse"), 900);
    }
  }
  return (
    <div
      className="mt-3 p-3 rounded border border-slate-700 bg-slate-900/60 text-[12px] text-slate-200 relative"
      role="status"
      aria-label="Voľná hotovosť (odhad)"
    >
      <div className="font-medium">
        Voľná hotovosť (odhad): {euro0(freeCash)}
      </div>
      <div className="mt-1">
        Miera sporenia: {pct(savingRate)}
        <div
          className="h-2 rounded bg-slate-800 overflow-hidden mt-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(savingRate * 100)}
        >
          <div
            className="h-full bg-emerald-500/70"
            style={{ width: `${savingRate * 100}%` }}
          />
        </div>
      </div>
      <div className="text-[11px] text-slate-400 mt-1" aria-live="polite">
        Výpočet: príjem − fixné − variabilné − doplatok rezervy.
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setMonthlyContrib(target);
            focusMonthlyField();
          }}
          className="px-2 py-1 rounded border border-indigo-500/70 bg-indigo-600/25 hover:bg-indigo-600/35 text-indigo-100 text-[11px]"
          aria-label={`Nastaviť mesačný vklad na ${target} €`}
        >
          Nastaviť mesačný vklad na {euro0(target)}
        </button>
      </div>
    </div>
  );
};
