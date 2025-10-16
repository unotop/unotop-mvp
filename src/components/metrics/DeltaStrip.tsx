import React, { useEffect, useRef, useState } from "react";

export const DeltaStrip: React.FC<{
  prevEr: number;
  prevRisk: number;
  er: number;
  risk: number;
}> = ({ prevEr, prevRisk, er, risk }) => {
  const [show, setShow] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    // Only show for real changes (>= 0.01 p.b. in ER or >= 0.01 in risk)
    const dErPb = Math.abs((er - prevEr) * 100);
    const dRiskAbs = Math.abs(risk - prevRisk);
    if (dErPb < 0.01 && dRiskAbs < 0.01) return;
    setShow(true);
    const t = setTimeout(() => {
      if (mounted.current) setShow(false);
    }, 2000);
    return () => clearTimeout(t);
  }, [prevEr, prevRisk, er, risk]);
  if (!show) return null;
  const dEr = (er - prevEr) * 100; // p. b.
  const dRisk = risk - prevRisk;
  const sEr = `${dEr >= 0 ? "+" : ""}${dEr.toFixed(1)}\u00A0p.\u00A0b.`;
  const sRisk = `${dRisk >= 0 ? "+" : ""}${dRisk.toFixed(1)}`;
  return (
    <div className="absolute -top-2 right-2 text-[11px] px-2 py-1 rounded border border-indigo-400/50 bg-indigo-600/20 text-indigo-100 shadow">
      Zmena: výnos {sEr}, riziko {sRisk}
    </div>
  );
};
