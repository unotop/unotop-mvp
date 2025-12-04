/**
 * Asset Status Debug: 45800/200/30 pre všetky 3 profily
 */

import { describe, it, expect } from "vitest";
import { getAdjustedMix } from "../src/features/portfolio/mixAdjustments";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";

describe("Asset Status Debug 45800/200/30", () => {
  const lump = 45800;
  const monthly = 200;
  const horizon = 30;
  const effectivePlanVolume = lump + monthly * 12 * horizon; // 117800

  const dummyCashflow = {
    monthlyIncome: 3000,
    fixedExpenses: 1500,
    variableExpenses: 500,
    reserveEur: 5000,
    reserveMonths: 6,
  };

  const profiles = ["konzervativny", "vyvazeny", "rastovy"] as const;

  profiles.forEach((profile) => {
    it(`${profile} mix crypto status`, () => {
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

      console.log(
        `\n🔹 ${profile.toUpperCase()} (volume ${effectivePlanVolume}€):`
      );
      for (const item of sorted) {
        if (item.pct > 0.01) {
          console.log(`   ${item.key.padEnd(10)} ${item.pct.toFixed(1)}%`);
        }
      }

      // Crypto check
      const crypto = mix.find((m) => m.key === "crypto");
      const cryptoPct = crypto ? crypto.pct : 0;

      if (cryptoPct > 0) {
        console.log(
          `   ✅ Crypto ${cryptoPct.toFixed(1)}% (should be ACTIVE/green)`
        );
      } else {
        console.log(`   ❌ Crypto 0% (locked/unavailable)`);
      }

      expect(mix.length).toBeGreaterThan(0);
    });
  });

  it("maxPct calculation across all profiles", () => {
    const mixesByProfile: Record<string, any[]> = {};

    profiles.forEach((profile) => {
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
      mixesByProfile[profile] = result.mix;
    });

    // Spočítaj maxPct pre crypto
    const cryptoWeights = profiles.map((p) => {
      const item = mixesByProfile[p].find((m: any) => m.key === "crypto");
      return item ? item.pct : 0;
    });

    const maxCrypto = Math.max(...cryptoWeights);

    console.log(`\n📊 CRYPTO MAX PCT ACROSS PROFILES:`);
    console.log(`   Konzervatívny: ${cryptoWeights[0].toFixed(1)}%`);
    console.log(`   Vyvážený:      ${cryptoWeights[1].toFixed(1)}%`);
    console.log(`   Rastový:       ${cryptoWeights[2].toFixed(1)}%`);
    console.log(`   → maxPct: ${maxCrypto.toFixed(1)}%`);

    if (maxCrypto > 0) {
      console.log(`\n✅ AssetPill status by mala byť "active" (zelená)`);
    } else {
      console.log(`\n❌ AssetPill status bude "available" (sivá) - BUG!`);
    }

    expect(maxCrypto).toBeGreaterThan(0); // Rastový by mal mať crypto > 0
  });
});
