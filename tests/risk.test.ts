/**
 * Unit tests - Adaptive Risk Cap
 * 
 * Overuje správne škálovanie rizikového cap podľa stage:
 * - STARTER: baseline + 0.5
 * - CORE: baseline (bez zmeny)
 * - LATE: baseline - 0.5
 */

import { describe, it, expect } from "vitest";
import { getAdaptiveRiskCap } from "../src/features/policy/risk";
import { RISK_CAPS } from "../src/features/mix/assetModel";

describe("Policy - Adaptive Risk Cap", () => {
  describe("Baseline caps (CORE stage)", () => {
    it("returns baseline for konzervativny in CORE", () => {
      const cap = getAdaptiveRiskCap("konzervativny", "CORE");
      expect(cap).toBe(RISK_CAPS.konzervativny); // 4.0
      expect(cap).toBe(4.0);
    });

    it("returns baseline for vyvazeny in CORE", () => {
      const cap = getAdaptiveRiskCap("vyvazeny", "CORE");
      expect(cap).toBe(RISK_CAPS.vyvazeny); // 6.0
      expect(cap).toBe(6.0);
    });

    it("returns baseline for rastovy in CORE", () => {
      const cap = getAdaptiveRiskCap("rastovy", "CORE");
      expect(cap).toBe(RISK_CAPS.rastovy); // 7.5
      expect(cap).toBe(7.5);
    });
  });

  describe("STARTER stage (baseline + 0.5)", () => {
    it("adds 0.5 to konzervativny cap in STARTER", () => {
      const cap = getAdaptiveRiskCap("konzervativny", "STARTER");
      expect(cap).toBe(4.5); // 4.0 + 0.5
    });

    it("adds 0.5 to vyvazeny cap in STARTER", () => {
      const cap = getAdaptiveRiskCap("vyvazeny", "STARTER");
      expect(cap).toBe(6.5); // 6.0 + 0.5
    });

    it("adds 0.5 to rastovy cap in STARTER", () => {
      const cap = getAdaptiveRiskCap("rastovy", "STARTER");
      expect(cap).toBe(8.0); // 7.5 + 0.5
    });
  });

  describe("LATE stage (baseline - 0.5)", () => {
    it("subtracts 0.5 from konzervativny cap in LATE", () => {
      const cap = getAdaptiveRiskCap("konzervativny", "LATE");
      expect(cap).toBe(3.5); // 4.0 - 0.5
    });

    it("subtracts 0.5 from vyvazeny cap in LATE", () => {
      const cap = getAdaptiveRiskCap("vyvazeny", "LATE");
      expect(cap).toBe(5.5); // 6.0 - 0.5
    });

    it("subtracts 0.5 from rastovy cap in LATE", () => {
      const cap = getAdaptiveRiskCap("rastovy", "LATE");
      expect(cap).toBe(7.0); // 7.5 - 0.5
    });
  });

  describe("Practical scenarios", () => {
    it("STARTER rastovy allows risk up to 8.0 (resolves 7.7/7.5 issue)", () => {
      const cap = getAdaptiveRiskCap("rastovy", "STARTER");
      expect(cap).toBe(8.0);
      
      // Risk 7.7 by mal byť OK v STARTER
      const riskScore = 7.7;
      expect(riskScore).toBeLessThan(cap);
    });

    it("LATE konzervativny is stricter (3.5 instead of 4.0)", () => {
      const cap = getAdaptiveRiskCap("konzervativny", "LATE");
      expect(cap).toBe(3.5);
      
      // Risk 3.8 by mal byť nad limitom v LATE
      const riskScore = 3.8;
      expect(riskScore).toBeGreaterThan(cap);
    });

    it("CORE keeps baseline behavior intact", () => {
      // Overenie že CORE nezmění pôvodné správanie
      expect(getAdaptiveRiskCap("konzervativny", "CORE")).toBe(4.0);
      expect(getAdaptiveRiskCap("vyvazeny", "CORE")).toBe(6.0);
      expect(getAdaptiveRiskCap("rastovy", "CORE")).toBe(7.5);
    });
  });
});
