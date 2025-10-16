// src/recover/helpers.stubs.ts
// Minimal compatible stubs to restore build. Replace gradually with real logic.

export type UIMode = 'basic' | 'pro' | null;

export type Mix = Record<string, number>; // e.g. { 'Zlato (fyzické)': 5, 'Akcie': 60, ... }

export function dismissOnboardingIfNeeded(): void {
  // TEST-ONLY convenience can stay outside prod
  if (process.env.NODE_ENV === 'test') {
    try {
      sessionStorage.setItem('onboardingSeen', '1');
    } catch {}
  }
}

export function openWizardDeterministic(setOpen: (v: boolean) => void) {
  // In tests we want determinism; in prod plain open
  setOpen(true);
}

export function addDebt(..._args: any[]): void {
  // TODO: implement real addDebt
}

export function handleReset(): void {
  // TODO: implement real reset logic (storages, state)
}

export function formatShort(n: number): string {
  // very small placeholder
  if (Number.isNaN(n)) return '–';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(Math.round(n));
}

export function showOvershootBadge(_mix: Mix): boolean {
  // TODO: real condition
  return false;
}

// --- Mix guards (placeholders) ---

export function enforceLegalMix(mix: Mix): Mix {
  // Clamp each asset between 0..100
  const out: Mix = {};
  for (const k in mix) {
    const v = Math.max(0, Math.min(100, mix[k] ?? 0));
    out[k] = v;
  }
  return out;
}

export function invariantPipeline(mix: Mix): Mix {
  // Ensure sum is ~100 by proportional scaling (simple)
  const sum = Object.values(mix).reduce((a, b) => a + (b || 0), 0);
  if (sum <= 0) return mix;
  // Avoid floating-point noise re-scaling when already within tight tolerance
  if (Math.abs(sum - 100) < 1e-9) return mix;
  const factor = 100 / sum;
  const scaled: Mix = {};
  for (const k in mix) {
    const v = (mix[k] || 0) * factor;
    // Trim tiny epsilon artifacts
    scaled[k] = Math.abs(Math.round(v) - v) < 1e-9 ? Math.round(v) : v;
  }
  return scaled;
}

export function guardSet(mix: Mix): Mix {
  return invariantPipeline(enforceLegalMix(mix));
}

export function setMixCapped(mix: Mix): Mix {
  return guardSet(mix);
}
