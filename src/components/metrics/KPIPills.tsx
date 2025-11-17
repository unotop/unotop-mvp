import React from "react";
import { formatPercentPa, formatMoneySk } from "../../utils/format";

export type KPIPillsProps = {
  erPa: number; // expected return per annum as fraction e.g. 0.075
  fv: number; // PR-8: Očakávaný majetok (projected future value in euros)
  riskRaw: number; // 0..10
  onClickEr?: () => void;
  onClickFv?: () => void;
  onClickRR?: () => void;
};

function pctSk(n: number, digits = 2) {
  // Deprecated in favor of formatPercentPa; keep signature for minimal change and call util to ensure "p. a." suffix.
  return formatPercentPa(n, digits);
}
function euroSk(n: number) {
  return formatMoneySk(n);
}

export const KPIPills: React.FC<KPIPillsProps> = ({
  erPa,
  fv,
  riskRaw,
  onClickEr,
  onClickFv,
  onClickRR,
}) => {
  const rr = erPa / Math.max(riskRaw, 1e-6);
  const rrGood = rr >= 2.0;
  const riskWarn = riskRaw > 7.5;
  const rrText = rr.toFixed(2);
  const pillBase =
    "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] cursor-pointer select-none ring-1 ring-transparent hover:ring-slate-500/40 transition-colors font-tabular-nums";
  const neutral =
    "border-slate-700 bg-slate-900/50 text-slate-200 hover:bg-slate-800/60";
  const good = "border-emerald-500/50 bg-emerald-600/20 text-emerald-200";
  const warn = "border-amber-500/50 bg-amber-600/20 text-amber-100";
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="KPI pás">
      <button
        type="button"
        onClick={onClickEr}
        className={`${pillBase} ${neutral}`}
        aria-label="KPI: Ročný výnos"
        title="Ročný výnos (odhad) – očakávaný ročný výnos"
      >
        <span aria-hidden>📈</span>
        <span className="font-medium">Ročný výnos {pctSk(erPa, 2)}</span>
      </button>
      <button
        type="button"
        onClick={onClickFv}
        className={`${pillBase} ${neutral}`}
        aria-label="KPI: Očakávaný majetok"
        title="Očakávaný majetok – odhad budúcej hodnoty po horizonte"
      >
        <span aria-hidden>🎯</span>
        <span className="font-medium">Očakávaný majetok {euroSk(fv)}</span>
      </button>
      <button
        type="button"
        onClick={onClickRR}
        className={`${pillBase} ${rrGood ? good : riskWarn ? warn : neutral}`}
        aria-label="KPI: Výnos / riziko"
        title="Výnos / riziko – vyššie je lepšie"
      >
        <span aria-hidden>⚖️</span>
        <span className="font-medium">Výnos/riziko {rrText}</span>
      </button>
    </div>
  );
};
