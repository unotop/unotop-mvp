/**
 * Test asset status pre 45800/200/30 - debug assetAvailability
 */

import { execSync } from 'child_process';

// Spusti npm test s inline testom
const testCode = `
import { describe, it, expect } from "vitest";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";

describe("Asset Status Debug 45800/200/30", () => {
  const scenarios = [
    { lump: 45800, monthly: 200, horizon: 30, profile: "konzervativny" },
    { lump: 45800, monthly: 200, horizon: 30, profile: "vyvazeny" },
    { lump: 45800, monthly: 200, horizon: 30, profile: "rastovy" },
  ];

  scenarios.forEach(({ lump, monthly, horizon, profile }) => {
    it(\`\${profile} mix pre \${lump}/\${monthly}/\${horizon}\`, () => {
      const effectivePlanVolume = lump + monthly * 12 * horizon;
      
      const dummyCashflow = {
        monthlyIncome: 3000,
        fixedExpenses: 1500,
        variableExpenses: 500,
        reserveEur: 5000,
        reserveMonths: 6,
      };

      const profileData = {
        lumpSumEur: lump,
        monthlyEur: monthly,
        horizonYears: horizon,
        goalAssetsEur: 100000,
        riskPref: profile,
        ...dummyCashflow,
      };

      const preset = PORTFOLIO_PRESETS.find((p) => p.id === profile);
      const baseMix = preset ? preset.mix.map((item) => ({ ...item })) : [];

      const result = getAdjustedMix(baseMix, profileData);
      const mix = result.mix;

      // Zoraď mix
      const sorted = [...mix].sort((a, b) => b.pct - a.pct);
      
      console.log(\`\\n🔹 \${profile.toUpperCase()} (volume \${effectivePlanVolume}€):\`);
      for (const item of sorted) {
        if (item.pct > 0.01) {
          console.log(\`   \${item.key.padEnd(10)} \${item.pct.toFixed(1)}%\`);
        }
      }

      // Crypto check
      const crypto = mix.find((m) => m.key === "crypto");
      const cryptoPct = crypto ? crypto.pct : 0;
      
      if (cryptoPct > 0) {
        console.log(\`✅ Crypto \${cryptoPct.toFixed(1)}% (should be ACTIVE/green)\`);
      } else {
        console.log(\`❌ Crypto 0% (locked/unavailable)\`);
      }

      expect(mix.length).toBeGreaterThan(0);
    });
  });
});
`;

// Zapíš test do dočasného súboru
import fs from 'fs';
fs.writeFileSync('tests/temp-asset-status-debug.test.tsx', testCode);

console.log('🧪 Running asset status debug test...\n');

try {
  execSync('npm test -- tests/temp-asset-status-debug.test.tsx --reporter=verbose', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
} catch (err) {
  console.error('Test failed:', err.message);
} finally {
  // Cleanup
  fs.unlinkSync('tests/temp-asset-status-debug.test.tsx');
}
