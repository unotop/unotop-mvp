// Asset definitions and scenarios
export interface Asset {
  label: string;
  expReturn: number; // expected annual return (decimal, e.g. 0.07)
  risk: number;      // base risk 0-10
}

export type Assets = Record<string, Asset>;

// Dual parameter sets for legacy vs current models.
const legacySets = {
  conservative: {
    'ETF (svet – aktívne)': { label: 'ETF (svet – aktívne)', expReturn: 0.09, risk: 5 },
    'Zlato (fyzické)': { label: 'Zlato (fyzické)', expReturn: 0.07, risk: 2 },
    'Krypto (BTC/ETH)': { label: 'Krypto (BTC/ETH)', expReturn: 0.12, risk: 9 },
    'Dynamické riadenie': { label: 'Dynamické riadenie', expReturn: (1+0.02)**12 - 1, risk: 8 },
    'Garantovaný dlhopis 7,5% p.a.': { label: 'Garantovaný dlhopis 7,5% p.a.', expReturn: 0.075, risk: 2 },
    'Hotovosť/rezerva': { label: 'Hotovosť/rezerva', expReturn: 0.0, risk: 2 },
    'Reality (komerčné)': { label: 'Reality (komerčné)', expReturn: 0.075, risk: 4 },
  },
  base: {
    'ETF (svet – aktívne)': { label: 'ETF (svet – aktívne)', expReturn: 0.14, risk: 5 },
    'Zlato (fyzické)': { label: 'Zlato (fyzické)', expReturn: 0.095, risk: 2 },
    'Krypto (BTC/ETH)': { label: 'Krypto (BTC/ETH)', expReturn: 0.2, risk: 9 },
    'Dynamické riadenie': { label: 'Dynamické riadenie', expReturn: (1+0.03)**12 - 1, risk: 9 },
    'Garantovaný dlhopis 7,5% p.a.': { label: 'Garantovaný dlhopis 7,5% p.a.', expReturn: 0.075, risk: 2 },
    'Hotovosť/rezerva': { label: 'Hotovosť/rezerva', expReturn: 0.0, risk: 2 },
    'Reality (komerčné)': { label: 'Reality (komerčné)', expReturn: 0.087, risk: 4 },
  },
  aggressive: {
    'ETF (svet – aktívne)': { label: 'ETF (svet – aktívne)', expReturn: 0.18, risk: 6 },
    'Zlato (fyzické)': { label: 'Zlato (fyzické)', expReturn: 0.11, risk: 3 },
    'Krypto (BTC/ETH)': { label: 'Krypto (BTC/ETH)', expReturn: 0.35, risk: 9 },
    'Dynamické riadenie': { label: 'Dynamické riadenie', expReturn: (1+0.04)**12 - 1, risk: 9 },
    'Garantovaný dlhopis 7,5% p.a.': { label: 'Garantovaný dlhopis 7,5% p.a.', expReturn: 0.075, risk: 2 },
    'Hotovosť/rezerva': { label: 'Hotovosť/rezerva', expReturn: 0.0, risk: 2 },
    'Reality (komerčné)': { label: 'Reality (komerčné)', expReturn: 0.095, risk: 5 },
  }
} as const;

// Existing ("current") simplified set retained for comparison
const currentSets = {
  conservative: {
    'ETF (svet – aktívne)': { label: 'ETF (svet – aktívne)', expReturn: 0.065, risk: 5.5 },
    'Zlato (fyzické)': { label: 'Zlato (fyzické)', expReturn: 0.025, risk: 2.5 },
    'Krypto (BTC/ETH)': { label: 'Krypto (BTC/ETH)', expReturn: 0.22, risk: 10 },
    'Dynamické riadenie': { label: 'Dynamické riadenie', expReturn: 0.11, risk: 7 },
    'Garantovaný dlhopis 7,5% p.a.': { label: 'Garantovaný dlhopis 7,5% p.a.', expReturn: 0.075, risk: 1.5 },
    'Hotovosť/rezerva': { label: 'Hotovosť/rezerva', expReturn: 0.01, risk: 0.5 },
    'Reality (komerčné)': { label: 'Reality (komerčné)', expReturn: 0.08, risk: 4.5 },
  },
  base: {
    'ETF (svet – aktívne)': { label: 'ETF (svet – aktívne)', expReturn: 0.075, risk: 6 },
    'Zlato (fyzické)': { label: 'Zlato (fyzické)', expReturn: 0.03, risk: 3 },
    'Krypto (BTC/ETH)': { label: 'Krypto (BTC/ETH)', expReturn: 0.25, risk: 10 },
    'Dynamické riadenie': { label: 'Dynamické riadenie', expReturn: 0.12, risk: 7.5 },
    'Garantovaný dlhopis 7,5% p.a.': { label: 'Garantovaný dlhopis 7,5% p.a.', expReturn: 0.075, risk: 1.5 },
    'Hotovosť/rezerva': { label: 'Hotovosť/rezerva', expReturn: 0.01, risk: 0.5 },
    'Reality (komerčné)': { label: 'Reality (komerčné)', expReturn: 0.085, risk: 5 },
  },
  aggressive: {
    'ETF (svet – aktívne)': { label: 'ETF (svet – aktívne)', expReturn: 0.09, risk: 6 },
    'Zlato (fyzické)': { label: 'Zlato (fyzické)', expReturn: 0.035, risk: 3 },
    'Krypto (BTC/ETH)': { label: 'Krypto (BTC/ETH)', expReturn: 0.3, risk: 10 },
    'Dynamické riadenie': { label: 'Dynamické riadenie', expReturn: 0.14, risk: 8 },
    'Garantovaný dlhopis 7,5% p.a.': { label: 'Garantovaný dlhopis 7,5% p.a.', expReturn: 0.075, risk: 1.5 },
    'Hotovosť/rezerva': { label: 'Hotovosť/rezerva', expReturn: 0.01, risk: 0.5 },
    'Reality (komerčné)': { label: 'Reality (komerčné)', expReturn: 0.09, risk: 5 },
  }
} as const;

export type Scenario = 'conservative' | 'base' | 'aggressive';
export type RiskMode = 'legacy' | 'current';

export function getAssetsByScenario(scenario: Scenario = 'base', mode: RiskMode = 'legacy'): Assets {
  const table = mode === 'legacy' ? legacySets : currentSets;
  return (table as any)[scenario];
}

export const DEFAULT_MIX: Record<string, number> = {
  'ETF (svet – aktívne)': 30,
  'Zlato (fyzické)': 20,
  'Krypto (BTC/ETH)': 15,
  'Dynamické riadenie': 10,
  'Garantovaný dlhopis 7,5% p.a.': 15,
  'Hotovosť/rezerva': 10,
  'Reality (komerčné)': 0,
};
