export function formatPercentPa(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  // value is fraction e.g., 0.1234
  const formatted = new Intl.NumberFormat("sk-SK", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return `${formatted} p. a.`;
}

export function formatMoneySk(value: number, opts?: { minimumFractionDigits?: number; maximumFractionDigits?: number }) {
  if (!Number.isFinite(value)) return "—";
  const isInt = Math.abs(value - Math.trunc(value)) < 1e-6;
  const minimumFractionDigits = opts?.minimumFractionDigits ?? (isInt ? 0 : 2);
  const maximumFractionDigits = opts?.maximumFractionDigits ?? (isInt ? 0 : 2);
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}
