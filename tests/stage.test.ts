/**
 * Unit tests - Stage Detection
 * 
 * Overuje správnu detekciu investičnej fázy (STARTER/CORE/LATE)
 * podľa vstupných parametrov (lump sum, monthly, years, goal).
 */

import { describe, it, expect } from "vitest";
import { detectStage } from "../src/features/policy/stage";

describe("Policy - Stage Detection", () => {
  describe("STARTER scenarios", () => {
    it("detects STARTER: small capital + long horizon", () => {
      // lump < 20k, monthly < 400, years >= 10
      const stage = detectStage(10_000, 200, 20, 100_000);
      expect(stage).toBe("STARTER");
    });

    it("detects STARTER: low coverage (< 35%)", () => {
      // investable = 15k + 300*12*15 = 69k
      // coverage = 69k / 300k = 23% < 35%
      const stage = detectStage(15_000, 300, 15, 300_000);
      expect(stage).toBe("STARTER");
    });

    it("detects STARTER: minimal input + big goal", () => {
      // investable = 5k + 100*12*25 = 35k
      // coverage = 35k / 500k = 7% << 35%
      const stage = detectStage(5_000, 100, 25, 500_000);
      expect(stage).toBe("STARTER");
    });
  });

  describe("CORE scenarios", () => {
    it("detects CORE: medium capital + medium horizon", () => {
      // lump = 25k (> 20k), monthly = 600 (> 400) → nie je STARTER
      // lump < 50k, monthly < 1000, years > 7 → nie je LATE
      const stage = detectStage(25_000, 600, 12, 200_000);
      expect(stage).toBe("CORE");
    });

    it("detects CORE: coverage in middle range (35-80%)", () => {
      // investable = 30k + 500*12*10 = 90k
      // coverage = 90k / 150k = 60%
      const stage = detectStage(30_000, 500, 10, 150_000);
      expect(stage).toBe("CORE");
    });

    it("detects CORE: no goal provided", () => {
      // Bez cieľa, kritériá pre STARTER ani LATE nie sú splnené
      const stage = detectStage(30_000, 600, 10);
      expect(stage).toBe("CORE");
    });
  });

  describe("LATE scenarios", () => {
    it("detects LATE: large lump sum (>= 50k)", () => {
      const stage = detectStage(60_000, 500, 15, 200_000);
      expect(stage).toBe("LATE");
    });

    it("detects LATE: large monthly contribution (>= 1000)", () => {
      const stage = detectStage(20_000, 1_200, 10, 300_000);
      expect(stage).toBe("LATE");
    });

    it("detects LATE: short horizon (<= 7 years)", () => {
      const stage = detectStage(30_000, 600, 5, 100_000);
      expect(stage).toBe("LATE");
    });

    it("detects LATE: high coverage (>= 80%)", () => {
      // investable = 40k + 800*12*10 = 136k
      // coverage = 136k / 150k = 90.67% >= 80%
      const stage = detectStage(40_000, 800, 10, 150_000);
      expect(stage).toBe("LATE");
    });
  });

  describe("Edge cases", () => {
    it("handles zero values (years=0 triggers LATE due to short horizon)", () => {
      const stage = detectStage(0, 0, 0, 0);
      // years <= 7 → LATE (krátky horizont)
      expect(stage).toBe("LATE");
    });

    it("handles negative years (clamped to 0, triggers LATE)", () => {
      const stage = detectStage(10_000, 200, -5, 100_000);
      // years = -5 → clamped to 0 v investable výpočte
      // years <= 7 → LATE
      expect(stage).toBe("LATE");
    });

    it("prefers LATE over STARTER if both criteria match", () => {
      // lump < 20k AND monthly < 400 AND years >= 10 → STARTER criteria
      // BUT lump >= 50k → LATE criteria (silnejšie)
      const stage = detectStage(55_000, 300, 12, 1_000_000);
      expect(stage).toBe("LATE"); // LATE má prioritu
    });
  });
});
