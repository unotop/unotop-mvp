import { computePortfolioFromInputs } from './src/features/portfolio/portfolioEngine.ts';

const problematicScenarios = [
  { lump: 2800, monthly: 200, horizon: 30, desc: 'User report' },
  { lump: 1000, monthly: 100, horizon: 30, desc: 'Low inputs' },
  { lump: 5000, monthly: 300, horizon: 20, desc: 'Mid inputs' },
  { lump: 10000, monthly: 500, horizon: 20, desc: 'High inputs' },
  { lump: 0, monthly: 150, horizon: 30, desc: 'No lump' },
  { lump: 20000, monthly: 0, horizon: 20, desc: 'No monthly' },
];

console.log('\n=== PROFILE HIERARCHY CHECK ===\n');

const inversions = [];

problematicScenarios.forEach(({ lump, monthly, horizon, desc }) => {
  const inputs = { lumpSumEur: lump, monthlyVklad: monthly, horizonYears: horizon, reserveEur: 0 };
  const volume = lump + monthly * 12 * horizon;
  
  const c = computePortfolioFromInputs({ ...inputs, riskPref: 'konzervativny' });
  const b = computePortfolioFromInputs({ ...inputs, riskPref: 'vyvazeny' });
  const g = computePortfolioFromInputs({ ...inputs, riskPref: 'rastovy' });

  const yieldInversion = g.yieldPa < b.yieldPa || g.yieldPa < c.yieldPa;
  const riskInversion = g.riskScore < b.riskScore || g.riskScore < c.riskScore;
  const identicalCG = Math.abs(c.yieldPa - g.yieldPa) < 0.001 && Math.abs(c.riskScore - g.riskScore) < 0.1;
  
  if (yieldInversion || riskInversion || identicalCG) {
    console.log(`${lump}/${monthly}/${horizon} (${(volume/1000).toFixed(0)}k) - ${desc}`);
    console.log(`  C: ${(c.yieldPa*100).toFixed(2)}% yield, ${c.riskScore.toFixed(2)} risk | ${c.volumeBand}`);
    console.log(`  B: ${(b.yieldPa*100).toFixed(2)}% yield, ${b.riskScore.toFixed(2)} risk | ${b.volumeBand}`);
    console.log(`  G: ${(g.yieldPa*100).toFixed(2)}% yield, ${g.riskScore.toFixed(2)} risk | ${g.volumeBand}`);
    
    if (identicalCG) {
      console.log(`  ⚠️ IDENTICAL C=G (${c.volumeBand} band)`);
    }
    if (g.yieldPa < b.yieldPa) {
      console.log(`  ⚠️ Yield: G < B (${((b.yieldPa - g.yieldPa)*100).toFixed(2)} p.b.)`);
    }
    if (g.riskScore < b.riskScore) {
      console.log(`  ⚠️ Risk: G < B (${(b.riskScore - g.riskScore).toFixed(2)})`);
    }
    console.log('');
    
    inversions.push({
      scenario: `${lump}/${monthly}/${horizon}`,
      volume,
      band: g.volumeBand,
      type: identicalCG ? 'C=G' : (yieldInversion ? 'yield_inv' : 'risk_inv'),
    });
  }
});

console.log(`\n--- SUMMARY: ${inversions.length} problematic scenarios found ---`);
inversions.forEach(inv => {
  console.log(`${inv.scenario} (${(inv.volume/1000).toFixed(0)}k ${inv.band}): ${inv.type}`);
});
