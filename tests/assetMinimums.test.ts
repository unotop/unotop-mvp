/**
 * Unit Tests: assetMinimums.ts
 * 
 * PR-12: Test asset availability logic
 */

import { describe, it, expect } from "vitest";
import { isAssetAvailable, ASSET_MINIMUMS } from "../src/features/policy/assetMinimums";

describe("Asset Minimums - Availability Check", () => {
  describe("ETF", () => {
    it("dostupné pri monthly ≥ 20 EUR", () => {
      expect(isAssetAvailable("etf", { lumpSumEur: 0, monthlyEur: 20 })).toBe(true);
      expect(isAssetAvailable("etf", { lumpSumEur: 0, monthlyEur: 25 })).toBe(true);
    });

    it("nedostupné pri monthly < 20 EUR", () => {
      expect(isAssetAvailable("etf", { lumpSumEur: 0, monthlyEur: 19 })).toBe(false);
      expect(isAssetAvailable("etf", { lumpSumEur: 0, monthlyEur: 10 })).toBe(false);
    });

    it("dostupné aj pri lump = 0 (žiadny lump min)", () => {
      expect(isAssetAvailable("etf", { lumpSumEur: 0, monthlyEur: 20 })).toBe(true);
    });
  });

  describe("Gold", () => {
    it("dostupné pri monthly ≥ 50 EUR", () => {
      expect(isAssetAvailable("gold", { lumpSumEur: 0, monthlyEur: 50 })).toBe(true);
      expect(isAssetAvailable("gold", { lumpSumEur: 0, monthlyEur: 100 })).toBe(true);
    });

    it("nedostupné pri monthly < 50 EUR", () => {
      expect(isAssetAvailable("gold", { lumpSumEur: 0, monthlyEur: 49 })).toBe(false);
      expect(isAssetAvailable("gold", { lumpSumEur: 0, monthlyEur: 30 })).toBe(false);
    });
  });

  describe("Bonds & Bond3y9", () => {
    it("dostupné pri lump ≥ 2500 EUR", () => {
      expect(isAssetAvailable("bonds", { lumpSumEur: 2500, monthlyEur: 0 })).toBe(true);
      expect(isAssetAvailable("bond3y9", { lumpSumEur: 3000, monthlyEur: 0 })).toBe(true);
    });

    it("nedostupné pri lump < 2500 EUR (monthly nepostačuje)", () => {
      expect(isAssetAvailable("bonds", { lumpSumEur: 2499, monthlyEur: 300 })).toBe(false);
      expect(isAssetAvailable("bond3y9", { lumpSumEur: 0, monthlyEur: 300 })).toBe(false);
    });

    it("monthly vklad nepostačuje (monthlyMin = 0)", () => {
      expect(isAssetAvailable("bonds", { lumpSumEur: 0, monthlyEur: 500 })).toBe(false);
    });
  });

  describe("Dynamické riadenie (dyn)", () => {
    it("dostupné pri lump ≥ 1000 EUR", () => {
      expect(isAssetAvailable("dyn", { lumpSumEur: 1000, monthlyEur: 0 })).toBe(true);
      expect(isAssetAvailable("dyn", { lumpSumEur: 1500, monthlyEur: 0 })).toBe(true);
    });

    it("nedostupné pri lump < 1000 EUR", () => {
      expect(isAssetAvailable("dyn", { lumpSumEur: 999, monthlyEur: 0 })).toBe(false);
      expect(isAssetAvailable("dyn", { lumpSumEur: 500, monthlyEur: 100 })).toBe(false);
    });

    it("monthly vklad nepostačuje (monthlyMin = 0)", () => {
      expect(isAssetAvailable("dyn", { lumpSumEur: 0, monthlyEur: 200 })).toBe(false);
    });
  });

  describe("Cash", () => {
    it("vždy dostupné (žiadne minimum)", () => {
      expect(isAssetAvailable("cash", { lumpSumEur: 0, monthlyEur: 0 })).toBe(true);
      expect(isAssetAvailable("cash", { lumpSumEur: 10, monthlyEur: 5 })).toBe(true);
    });
  });

  describe("Crypto", () => {
    it("dostupné pri lump ≥ 100 EUR", () => {
      expect(isAssetAvailable("crypto", { lumpSumEur: 100, monthlyEur: 0 })).toBe(true);
      expect(isAssetAvailable("crypto", { lumpSumEur: 200, monthlyEur: 0 })).toBe(true);
    });

    it("dostupné pri monthly ≥ 50 EUR", () => {
      expect(isAssetAvailable("crypto", { lumpSumEur: 0, monthlyEur: 50 })).toBe(true);
      expect(isAssetAvailable("crypto", { lumpSumEur: 0, monthlyEur: 100 })).toBe(true);
    });

    it("nedostupné pod minimami", () => {
      expect(isAssetAvailable("crypto", { lumpSumEur: 99, monthlyEur: 49 })).toBe(false);
      expect(isAssetAvailable("crypto", { lumpSumEur: 0, monthlyEur: 20 })).toBe(false);
    });
  });

  describe("Reality", () => {
    it("dostupné pri lump ≥ 300 000 EUR", () => {
      expect(
        isAssetAvailable("real", {
          lumpSumEur: 300000,
          monthlyEur: 0,
          monthlyIncome: 0,
        })
      ).toBe(true);
    });

    it("dostupné pri príjem ≥ 3500 EUR/mes", () => {
      expect(
        isAssetAvailable("real", {
          lumpSumEur: 0,
          monthlyEur: 100,
          monthlyIncome: 3500,
        })
      ).toBe(true);
      expect(
        isAssetAvailable("real", {
          lumpSumEur: 0,
          monthlyEur: 100,
          monthlyIncome: 5000,
        })
      ).toBe(true);
    });

    it("nedostupné pod thresholdmi", () => {
      expect(
        isAssetAvailable("real", {
          lumpSumEur: 299999,
          monthlyEur: 100,
          monthlyIncome: 3499,
        })
      ).toBe(false);
      expect(
        isAssetAvailable("real", {
          lumpSumEur: 0,
          monthlyEur: 100,
          monthlyIncome: 3000,
        })
      ).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("nulové vstupy → len cash a ETF dostupné", () => {
      const profile = { lumpSumEur: 0, monthlyEur: 0 };
      
      expect(isAssetAvailable("cash", profile)).toBe(true);
      expect(isAssetAvailable("etf", profile)).toBe(false); // monthly < 20
      expect(isAssetAvailable("gold", profile)).toBe(false);
      expect(isAssetAvailable("bonds", profile)).toBe(false);
      expect(isAssetAvailable("dyn", profile)).toBe(false);
      expect(isAssetAvailable("crypto", profile)).toBe(false);
    });

    it("malý vklad (50 EUR/mes) → len ETF, gold, crypto, cash", () => {
      const profile = { lumpSumEur: 0, monthlyEur: 50 };
      
      expect(isAssetAvailable("cash", profile)).toBe(true);
      expect(isAssetAvailable("etf", profile)).toBe(true);
      expect(isAssetAvailable("gold", profile)).toBe(true);
      expect(isAssetAvailable("crypto", profile)).toBe(true);
      expect(isAssetAvailable("bonds", profile)).toBe(false);
      expect(isAssetAvailable("dyn", profile)).toBe(false);
      expect(isAssetAvailable("real", profile)).toBe(false);
    });

    it("stredný vklad (lump 2500) → všetko okrem reality (dyn dostupný)", () => {
      const profile = { lumpSumEur: 2500, monthlyEur: 100, monthlyIncome: 2000 };
      
      expect(isAssetAvailable("cash", profile)).toBe(true);
      expect(isAssetAvailable("etf", profile)).toBe(true);
      expect(isAssetAvailable("gold", profile)).toBe(true);
      expect(isAssetAvailable("crypto", profile)).toBe(true);
      expect(isAssetAvailable("bonds", profile)).toBe(true);
      expect(isAssetAvailable("bond3y9", profile)).toBe(true);
      expect(isAssetAvailable("dyn", profile)).toBe(true); // 2500 >= 1000, dostupné
      expect(isAssetAvailable("real", profile)).toBe(false); // potrebuje 300k alebo 3500+ príjem
    });
  });
});
