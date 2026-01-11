/**
 * Test: Overenie že pri 0/50/23 (13.8k EUR) má rastový profil dyn > 0%
 * 
 * Scenár:
 * - lumpSum: 0 EUR
 * - monthly: 50 EUR
 * - horizon: 23 rokov
 * - effectivePlanVolume: 13,800 EUR → STARTER band
 * 
 * Očakávaný výsledok:
 * - dyn > 0% (nie 0%!)
 * - Výnos Vyvážený ~12-13%
 * - Výnos Rastový ~14-15%
 */

import { getAdjustedMix } from './src/features/portfolio/mixAdjustments.js';
import { approxYieldAnnualFromMix } from './src/features/mix/assetModel.js';
import { presets } from './src/features/portfolio/presets.js';

const profile = {
  lumpSumEur: 0,
  monthlyEur: 50,
  horizonYears: 23,
  monthlyIncome: 2500,
  fixedExpenses: 1200,
  variableExpenses: 800,
  reserveEur: 1000,
  reserveMonths: 3,
  goalAssetsEur: 100000,
};

console.log('=== TEST: Yield @ 0/50/23 (13.8k EUR) ===');
console.log(`Effective volume: ${(50 * 23 * 12).toLocaleString()} EUR (STARTER band)\n`);

// Test Balanced
const balancedProfile = { ...profile, riskPref: 'vyvazeny' };
const balancedResult = getAdjustedMix(presets.balanced.mix, balancedProfile);
const balancedYield = approxYieldAnnualFromMix(balancedResult.mix);
const balancedDyn = balancedResult.mix.find(m => m.key === 'dyn')?.pct || 0;

console.log('VYVÁŽENÝ (Balanced):');
console.log(`  dyn: ${balancedDyn.toFixed(1)}% (expected > 0%)`);
console.log(`  Yield: ${(balancedYield * 100).toFixed(2)}% (expected ~12-13%)`);
console.log(`  Mix:`, balancedResult.mix.filter(m => m.pct > 0).map(m => `${m.key}:${m.pct.toFixed(1)}%`).join(', '));

// Test Growth
const growthProfile = { ...profile, riskPref: 'rastovy' };
const growthResult = getAdjustedMix(presets.growth.mix, growthProfile);
const growthYield = approxYieldAnnualFromMix(growthResult.mix);
const growthDyn = growthResult.mix.find(m => m.key === 'dyn')?.pct || 0;

console.log('\nRASTOVÝ (Growth):');
console.log(`  dyn: ${growthDyn.toFixed(1)}% (expected > 0%)`);
console.log(`  Yield: ${(growthYield * 100).toFixed(2)}% (expected ~14-15%)`);
console.log(`  Mix:`, growthResult.mix.filter(m => m.pct > 0).map(m => `${m.key}:${m.pct.toFixed(1)}%`).join(', '));

// Validation
console.log('\n=== VALIDATION ===');
const balancedPass = balancedDyn > 0 && balancedYield >= 0.11;
const growthPass = growthDyn > 0 && growthYield >= 0.13 && growthYield > balancedYield;

console.log(`Balanced: ${balancedPass ? '✅ PASS' : '❌ FAIL'} (dyn > 0: ${balancedDyn > 0}, yield >= 11%: ${balancedYield >= 0.11})`);
console.log(`Growth: ${growthPass ? '✅ PASS' : '❌ FAIL'} (dyn > 0: ${growthDyn > 0}, yield >= 13%: ${growthYield >= 0.13}, yield > Balanced: ${growthYield > balancedYield})`);

if (balancedPass && growthPass) {
  console.log('\n🎯 SUCCESS: Dynamic management (dyn) is active at low volumes!');
  process.exit(0);
} else {
  console.log('\n❌ FAIL: dyn still blocked or yields too low');
  process.exit(1);
}
