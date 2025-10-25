/**
 * Unit Tests: applyMinimums.ts
 * 
 * PR-12: Test redistribution logic for unavailable assets
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyMinimums } from "../src/features/policy/applyMinimums";
import { WarningCenter } from "../src/features/ui/warnings/WarningCenter";

describe("Apply Asset Minimums - Redistribution Logic", () => {
  beforeEach(() => {
    WarningCenter.clear();
  });

  afterEach(() => {
    WarningCenter.clear();
  });

  describe("Konzervatívny profil @ 50 EUR/mes (príklad z PR-12)", () => {
    it("presunie bonds, dyn → ETF 51.8%, Cash 22.2%, Gold 20%, Real 6% (dostupné)", () => {
      // Pôvodný konzervativny mix
      const baseMix = [
        { key: "gold" as const, pct: 20 },
        { key: "etf" as const, pct: 20 },
        { key: "bonds" as const, pct: 17 },
        { key: "bond3y9" as const, pct: 17 },
        { key: "dyn" as const, pct: 8 },
        { key: "cash" as const, pct: 12 },
        { key: "crypto" as const, pct: 0 },
        { key: "real" as const, pct: 6 },
      ];

      const profile = {
        lumpSumEur: 0,
        monthlyEur: 50,
        monthlyIncome: 4000, // Príjem 4000 ≥ 3500 → reality dostupná
      };

      const { mix } = applyMinimums(baseMix, profile);

      // Očakávaný výsledok:
      // - Bonds 17% → ETF +11.9 (70%), Cash +5.1 (30%)
      // - Bond3y9 17% → ETF +11.9, Cash +5.1
      // - Dyn 8% → ETF +8.0 (100%)
      // - Real 6% → OSTÁVA (príjem 4000 ≥ 3500 threshold)
      // - Gold 20% → ostáva (dostupné pri 50 EUR/mes)
      // - ETF 20 + 11.9 + 11.9 + 8.0 = 51.8%
      // - Cash 12 + 5.1 + 5.1 = 22.2%
      // - Gold 20% (bez zmeny)

      const etf = mix.find((m) => m.key === "etf");
      const cash = mix.find((m) => m.key === "cash");
      const gold = mix.find((m) => m.key === "gold");
      const bonds = mix.find((m) => m.key === "bonds");
      const bond3y9 = mix.find((m) => m.key === "bond3y9");
      const dyn = mix.find((m) => m.key === "dyn");
      const real = mix.find((m) => m.key === "real");

      expect(etf?.pct).toBeCloseTo(51.8, 1); // 20 + 11.9 + 11.9 + 8 = 51.8
      expect(cash?.pct).toBeCloseTo(22.2, 1); // 12 + 5.1 + 5.1 = 22.2
      expect(gold?.pct).toBeCloseTo(20, 1);
      expect(bonds?.pct).toBe(0);
      expect(bond3y9?.pct).toBe(0);
      expect(dyn?.pct).toBe(0);
      expect(real?.pct).toBeCloseTo(6, 1); // OSTÁVA (príjem threshold splnený)

      // Suma musí byť 100%
      const sum = mix.reduce((acc, m) => acc + m.pct, 0);
      expect(sum).toBeCloseTo(100, 0.05);
    });

    it("emitne warnings do WarningCenter", () => {
      const baseMix = [
        { key: "gold" as const, pct: 20 },
        { key: "bonds" as const, pct: 17 },
        { key: "bond3y9" as const, pct: 17 },
        { key: "dyn" as const, pct: 8 },
        { key: "real" as const, pct: 6 },
        { key: "etf" as const, pct: 20 },
        { key: "cash" as const, pct: 12 },
      ];

      const profile = {
        lumpSumEur: 0,
        monthlyEur: 50,
        monthlyIncome: 4000,
      };

      applyMinimums(baseMix, profile);

      const warnings = WarningCenter.getAll();
      expect(warnings.length).toBeGreaterThan(0);

      // Očakávame warnings pre bonds, bond3y9, dyn (real nedostupná kvôli lump < 300k)
      const bondWarning = warnings.find((w) => w.message.includes("Dlhopisy"));
      const dynWarning = warnings.find((w) => w.message.includes("Dynamické riadenie"));

      expect(bondWarning).toBeDefined();
      expect(dynWarning).toBeDefined();

      // Scope by mal byť 'minimums'
      expect(bondWarning?.scope).toBe("minimums");
    });
  });

  describe("Veľký investor (lump 5000 EUR)", () => {
    it("všetko dostupné okrem reality → žiadne presuny", () => {
      const baseMix = [
        { key: "gold" as const, pct: 20 },
        { key: "etf" as const, pct: 30 },
        { key: "bonds" as const, pct: 15 },
        { key: "dyn" as const, pct: 20 },
        { key: "cash" as const, pct: 10 },
        { key: "crypto" as const, pct: 5 },
        { key: "real" as const, pct: 0 }, // Už nie je v mixe
      ];

      const profile = {
        lumpSumEur: 5000,
        monthlyEur: 200,
        monthlyIncome: 2500, // Pod 3500, nemá reality
      };

      const { mix } = applyMinimums(baseMix, profile);

      // Žiadne zmeny (všetko okrem reality je dostupné)
      expect(mix.find((m) => m.key === "gold")?.pct).toBeCloseTo(20, 0.1);
      expect(mix.find((m) => m.key === "etf")?.pct).toBeCloseTo(30, 0.1);
      expect(mix.find((m) => m.key === "bonds")?.pct).toBeCloseTo(15, 0.1);
      expect(mix.find((m) => m.key === "dyn")?.pct).toBeCloseTo(20, 0.1);
      expect(mix.find((m) => m.key === "crypto")?.pct).toBeCloseTo(5, 0.1);
    });
  });

  describe("Malý vklad (20 EUR/mes) → len ETF dostupné", () => {
    it("presunie gold do ETF/cash podľa FALLBACKS", () => {
      const baseMix = [
        { key: "gold" as const, pct: 30 },
        { key: "etf" as const, pct: 50 },
        { key: "cash" as const, pct: 20 },
      ];

      const profile = {
        lumpSumEur: 0,
        monthlyEur: 20, // Gold potrebuje 50, nedostupné
      };

      const { mix } = applyMinimums(baseMix, profile);

      // Gold 30% → ETF +18 (60%), Cash +12 (40%)
      const etf = mix.find((m) => m.key === "etf");
      const cash = mix.find((m) => m.key === "cash");
      const gold = mix.find((m) => m.key === "gold");

      expect(gold?.pct).toBe(0);
      expect(etf?.pct).toBeCloseTo(68, 1); // 50 + 18
      expect(cash?.pct).toBeCloseTo(32, 1); // 20 + 12

      const sum = mix.reduce((acc, m) => acc + m.pct, 0);
      expect(sum).toBeCloseTo(100, 0.05);
    });
  });

  describe("Edge case: žiadne dostupné aktíva okrem cash", () => {
    it("presunie všetko do cash", () => {
      const baseMix = [
        { key: "gold" as const, pct: 50 }, // Potrebuje 50 EUR/mes
        { key: "bonds" as const, pct: 30 }, // Potrebuje 2500 lump
        { key: "cash" as const, pct: 20 },
      ];

      const profile = {
        lumpSumEur: 0,
        monthlyEur: 10, // Nič iné nie je dostupné
      };

      const { mix } = applyMinimums(baseMix, profile);

      // Všetko by malo ísť do ETF/cash, ale ETF tiež nie je dostupné (potrebuje 20)
      // Gold 50% → ETF +30, Cash +20 (ale ETF nie je dostupný, tak ide do cash)
      // Bonds 30% → ETF +21, Cash +9
      // Výsledok: všetko v cash

      const cash = mix.find((m) => m.key === "cash");
      const gold = mix.find((m) => m.key === "gold");
      const bonds = mix.find((m) => m.key === "bonds");
      const etf = mix.find((m) => m.key === "etf");

      expect(gold?.pct).toBe(0);
      expect(bonds?.pct).toBe(0);
      
      // ETF dostane fallbacky, ale samo nie je dostupné → zostane 0
      // Cash dostane všetko
      const sum = mix.reduce((acc, m) => acc + m.pct, 0);
      expect(sum).toBeCloseTo(100, 0.05);
      
      // Cash by malo mať väčšinu (keďže ostatné sú nedostupné)
      expect(cash!.pct).toBeGreaterThan(50);
    });
  });

  describe("Crypto minimum", () => {
    it("nedostupné pri lump 99 EUR, monthly 49 EUR", () => {
      const baseMix = [
        { key: "crypto" as const, pct: 10 },
        { key: "etf" as const, pct: 70 },
        { key: "cash" as const, pct: 20 },
      ];

      const profile = {
        lumpSumEur: 99,
        monthlyEur: 49,
      };

      const { mix } = applyMinimums(baseMix, profile);

      const crypto = mix.find((m) => m.key === "crypto");
      const etf = mix.find((m) => m.key === "etf");

      expect(crypto?.pct).toBe(0);
      expect(etf?.pct).toBeCloseTo(80, 1); // 70 + 10 (crypto → ETF 100%)
    });

    it("dostupné pri lump 100 EUR", () => {
      const baseMix = [
        { key: "crypto" as const, pct: 10 },
        { key: "etf" as const, pct: 70 },
        { key: "cash" as const, pct: 20 },
      ];

      const profile = {
        lumpSumEur: 100,
        monthlyEur: 0,
      };

      const { mix } = applyMinimums(baseMix, profile);

      const crypto = mix.find((m) => m.key === "crypto");
      expect(crypto?.pct).toBeCloseTo(10, 0.1); // Bez zmeny
    });
  });
});
