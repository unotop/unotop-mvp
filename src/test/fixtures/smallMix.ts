/**
 * Test fixtures: Deterministický mix pre testy výpočtov
 * Nezávislý od default hodnôt v aplikácii
 */

import type { MixItem } from '../../features/mix/mix.service';
import type { RiskPref } from '../../features/mix/assetModel';

/**
 * SMALL_MIX_VYVAZENY
 * 
 * Stabilný testovací mix pre vyvážený profil
 * Spolu: 100%
 * 
 * Očakávaný výnos (vyvažený): 0.1214380443423 (12.14% p.a.)
 * FV pri lump=10000, monthly=500, years=20: 566 964.28 €
 */
export const SMALL_MIX_VYVAZENY: MixItem[] = [
  { key: 'etf', pct: 30 },       // 30% × 0.14 = 0.042
  { key: 'gold', pct: 15 },      // 15% × 0.095 = 0.01425
  { key: 'bonds', pct: 10 },     // 10% × 0.075 = 0.0075
  { key: 'bond3y9', pct: 10 },   // 10% × 0.09 = 0.009
  { key: 'cash', pct: 5 },       // 5% × 0 = 0
  { key: 'real', pct: 20 },      // 20% × 0.087 = 0.0174
  { key: 'dyn', pct: 5 },        // 5% × 0.4258 = 0.02129
  { key: 'crypto', pct: 5 },     // 5% × 0.20 = 0.01
];

export const SMALL_MIX_RISK_PREF: RiskPref = 'vyvazeny';

/**
 * Očakávané hodnoty pre validáciu testov
 */
export const EXPECTED_VALUES = {
  // Modelový ročný výnos portfólia (p.a.)
  approxYield: 0.1214380443423,
  
  // Budúca hodnota pri lump=10000, monthly=500, years=20
  futureValue: 566964.28,
  
  // Tolerancie pre testy
  yieldTolerance: 0.000001,      // ±0.0001% pre výnos
  fvTolerance: 0.003,            // ±0.30% pre FV
} as const;
