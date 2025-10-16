export function selectPortfolioFVOverTime(
  years: number,
  lumpSum: number,
  monthlyContrib: number,
  erPa: number
): { month: number; value: number }[] {
  const months = Math.max(0, Math.round(years * 12));
  const i = erPa / 12;
  const out: { month: number; value: number }[] = [];
  let value = Math.max(0, lumpSum);
  out.push({ month: 0, value });
  for (let m = 1; m <= months; m++) {
    value = value * (1 + i) + Math.max(0, monthlyContrib);
    out.push({ month: m, value });
  }
  return out;
}

export function firstCrossoverIndex(
  fvSeries: { month: number; value: number }[],
  balanceSeries: { month: number; balance: number }[]
): number | null {
  // Returns the month number (1..N) when FV first reaches/exceeds balance.
  // Skips month 0 to avoid "mesiac 0" in UI notes.
  const n = Math.min(fvSeries.length, balanceSeries.length);
  for (let idx = 0; idx < n; idx++) {
    const m = fvSeries[idx]?.month;
    if (m == null || m <= 0) continue;
    const fv = fvSeries[idx]?.value ?? 0;
    const bal = balanceSeries[idx]?.balance ?? 0;
    if (fv >= bal) return m;
  }
  return null;
}
