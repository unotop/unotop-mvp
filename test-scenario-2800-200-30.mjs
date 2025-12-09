import { computePortfolioFromInputs } from './src/features/portfolio/portfolioEngine.ts';

const inputs = { lumpSumEur: 2800, monthlyVklad: 200, horizonYears: 30, reserveEur: 0 };

const c = computePortfolioFromInputs({ ...inputs, riskPref: 'konzervativny' });
const b = computePortfolioFromInputs({ ...inputs, riskPref: 'vyvazeny' });
const g = computePortfolioFromInputs({ ...inputs, riskPref: 'rastovy' });

console.log('\n=== 2800/200/30 (75k EUR) ===\n');
console.log('Conservative:', (c.yieldPa*100).toFixed(2) + '%', 'risk', c.riskScore.toFixed(2), '| Band:', c.volumeBand);
console.log('Balanced:    ', (b.yieldPa*100).toFixed(2) + '%', 'risk', b.riskScore.toFixed(2), '| Band:', b.volumeBand);
console.log('Growth:      ', (g.yieldPa*100).toFixed(2) + '%', 'risk', g.riskScore.toFixed(2), '| Band:', g.volumeBand);

console.log('\n--- Mix Details ---');
console.log('C:', c.mix.filter(m=>m.pct>0).map(m=>`${m.key}:${m.pct.toFixed(1)}`).join(', '));
console.log('B:', b.mix.filter(m=>m.pct>0).map(m=>`${m.key}:${m.pct.toFixed(1)}`).join(', '));
console.log('G:', g.mix.filter(m=>m.pct>0).map(m=>`${m.key}:${m.pct.toFixed(1)}`).join(', '));

console.log('\n--- Hierarchy Check ---');
if (g.yieldPa < b.yieldPa) {
  console.log('⚠️ INVERSION: Growth yield', (g.yieldPa*100).toFixed(2), '< Balanced', (b.yieldPa*100).toFixed(2));
  console.log('   Difference:', ((b.yieldPa - g.yieldPa)*100).toFixed(2), 'p.b.');
}
if (g.riskScore < b.riskScore) {
  console.log('⚠️ INVERSION: Growth risk', g.riskScore.toFixed(2), '< Balanced', b.riskScore.toFixed(2));
  console.log('   Difference:', (b.riskScore - g.riskScore).toFixed(2));
}
