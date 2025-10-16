import type { Assets } from "./assets";

export function selectErPa(normMix: Record<string, number>, assets: Assets): number {
  return Object.entries(normMix).reduce(
    (a, [k, w]) => a + w * (assets[k]?.expReturn || 0),
    0
  );
}

export function selectRiskRaw(normMix: Record<string, number>, assets: Assets): number {
  // Compute similarly to computeRisk but expecting caller to already have riskModel.raw available; here we keep a simple proxy
  // For safety, let calling code keep computeRisk; this selector is a placeholder for future refactor.
  // Returning NaN would be worse; return 0 as neutral in isolation.
  return 0;
}

export function selectFutureValue(
  years: number,
  lumpSum: number,
  monthlyContrib: number,
  erPa: number
): number {
  const months = Math.max(0, Math.round(years * 12));
  const i = erPa / 12;
  let value = Math.max(0, lumpSum);
  for (let m = 1; m <= months; m++) {
    value = value * (1 + i) + Math.max(0, monthlyContrib);
  }
  return value;
}

export function selectReserveGap(fixedExpenses: number, emergencyMonths: number, currentReserve: number): number {
  const requiredReserve = Math.max(0, emergencyMonths * fixedExpenses);
  return Math.max(0, requiredReserve - Math.max(0, currentReserve));
}
