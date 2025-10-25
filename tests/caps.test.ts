/**
 * Unit tests - Asset Caps
 * 
 * Overuje správne nastavenie asset capov a combo limitov podľa stage.
 */

import { describe, it, expect } from "vitest";
import { getAssetCaps, getDynCryptoComboCap } from "../src/features/policy/caps";

describe("Policy - Asset Caps", () => {
  describe("Baseline caps (CORE stage)", () => {
    it("returns baseline caps for CORE vyvazeny", () => {
      const caps = getAssetCaps("vyvazeny", "CORE");
      
      expect(caps.etf).toBe(40);
      expect(caps.dyn).toBe(15);
      expect(caps.crypto).toBe(6);
      expect(caps.gold).toBe(40);
      expect(caps.bonds).toBe(40);
      expect(caps.bond3y9).toBe(40);
      expect(caps.cash).toBe(40);
      expect(caps.real).toBe(20);
    });

    it("applies bonds exception for konzervativny (35% instead of 40%)", () => {
      const caps = getAssetCaps("konzervativny", "CORE");
      
      expect(caps.bonds).toBe(35); // Výnimka
      expect(caps.etf).toBe(40);   // Ostatné baseline
    });
  });

  describe("STARTER stage (higher caps for growth)", () => {
    it("increases ETF cap to 50% in STARTER", () => {
      const caps = getAssetCaps("vyvazeny", "STARTER");
      
      expect(caps.etf).toBe(50); // +10 p.b.
    });

    it("increases dyn cap by 3 p.b. (max 18%) in STARTER", () => {
      const capsVyv = getAssetCaps("vyvazeny", "STARTER");
      const capsRast = getAssetCaps("rastovy", "STARTER");
      
      expect(capsVyv.dyn).toBe(18); // 15 + 3
      expect(capsRast.dyn).toBe(18); // 15 + 3, capped at 18
    });

    it("keeps other caps at baseline in STARTER", () => {
      const caps = getAssetCaps("vyvazeny", "STARTER");
      
      expect(caps.gold).toBe(40);
      expect(caps.bonds).toBe(40);
      expect(caps.crypto).toBe(6);
      expect(caps.real).toBe(20);
    });
  });

  describe("LATE stage (lower caps for stability)", () => {
    it("decreases ETF cap to 35% in LATE", () => {
      const caps = getAssetCaps("vyvazeny", "LATE");
      
      expect(caps.etf).toBe(35); // -5 p.b.
    });

    it("decreases dyn cap by 5 p.b. (min 8%) in LATE", () => {
      const capsVyv = getAssetCaps("vyvazeny", "LATE");
      const capsKonz = getAssetCaps("konzervativny", "LATE");
      
      expect(capsVyv.dyn).toBe(10); // 15 - 5
      expect(capsKonz.dyn).toBe(10); // 15 - 5
    });

    it("keeps other caps at baseline in LATE", () => {
      const caps = getAssetCaps("vyvazeny", "LATE");
      
      expect(caps.gold).toBe(40);
      expect(caps.bonds).toBe(40);
      expect(caps.crypto).toBe(6);
      expect(caps.real).toBe(20);
    });
  });

  describe("Dyn+Crypto combo cap", () => {
    it("returns 25% for STARTER (more volatile assets allowed)", () => {
      const cap = getDynCryptoComboCap("STARTER");
      expect(cap).toBe(25);
    });

    it("returns 22% for CORE (baseline)", () => {
      const cap = getDynCryptoComboCap("CORE");
      expect(cap).toBe(22);
    });

    it("returns 18% for LATE (conservative, protect capital)", () => {
      const cap = getDynCryptoComboCap("LATE");
      expect(cap).toBe(18);
    });
  });

  describe("Practical scenarios", () => {
    it("STARTER allows ETF 43.96% without warning (resolves screenshot issue)", () => {
      const caps = getAssetCaps("vyvazeny", "STARTER");
      
      expect(caps.etf).toBe(50);
      expect(43.96).toBeLessThan(caps.etf ?? 0); // OK
    });

    it("LATE restricts ETF to 35% (GOLD 48.74% would trigger redistribution)", () => {
      const caps = getAssetCaps("konzervativny", "LATE");
      
      expect(caps.etf).toBe(35);
      expect(caps.gold).toBe(40);
      
      // GOLD 48.74% > 40% → needs redistribution
      expect(48.74).toBeGreaterThan(caps.gold ?? 0);
    });

    it("STARTER combo allows dyn 18% + crypto 6% = 24% (under 25% cap)", () => {
      const caps = getAssetCaps("vyvazeny", "STARTER");
      const comboCap = getDynCryptoComboCap("STARTER");
      
      const dynMax = caps.dyn ?? 0;
      const cryptoMax = caps.crypto ?? 0;
      const comboSum = dynMax + cryptoMax;
      
      expect(comboSum).toBe(24); // 18 + 6
      expect(comboSum).toBeLessThan(comboCap); // 24 < 25 ✓
    });

    it("LATE combo restricts dyn+crypto to 18% total", () => {
      const comboCap = getDynCryptoComboCap("LATE");
      
      expect(comboCap).toBe(18);
      
      // dyn 10% + crypto 6% = 16% < 18% ✓
      // dyn 15% + crypto 6% = 21% > 18% → needs reduction
    });
  });
});
