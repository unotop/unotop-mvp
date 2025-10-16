// Basic numeric/text helpers
export function clamp(v: number, min: number, max: number){
  return Math.min(max, Math.max(min, v));
}

export function pctFmt(v: number, digits = 1){
  if(!Number.isFinite(v)) return '—';
  return (v*100).toFixed(digits)+'%';
}

export function euro(v: number, digits = 0){
  if(!Number.isFinite(v)) return '—';
  return v.toLocaleString('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: digits });
}

// Strict money parser: accepts optional spaces, thousands separators (spaces or non-breaking), optional trailing € sign.
// Rejects scientific notation and any letters. Returns NaN if invalid.
export function parseMoneyStrict(input: string): number {
  if (input == null) return NaN;
  const raw = String(input).trim();
  if(raw === '') return NaN;
  // Reject scientific notation explicitly
  if(/[eE]/.test(raw)) return NaN;
  // Remove euro sign at end (optional) and surrounding spaces
  const cleaned = raw
    .replace(/€/g, '')
    .replace(/\s+/g, ' ') // collapse internal whitespace
    .trim()
    .replace(/\u00A0/g, ''); // non-breaking spaces
  // Allow spaces as thousand separators: remove spaces
  const digitsOnly = cleaned.replace(/ /g,'');
  if(!/^[-+]?\d*(?:\.\d+)?$/.test(digitsOnly)) return NaN;
  if(digitsOnly === '' || digitsOnly === '+' || digitsOnly === '-') return NaN;
  const n = Number(digitsOnly);
  return Number.isFinite(n) ? n : NaN;
}
