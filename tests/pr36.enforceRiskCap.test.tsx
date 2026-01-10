/**
 * PR-36: enforceRiskCap Regression Tests
 *
 * TASK 6: Regression tests pre P0 fix (Remove DIRECT CUT MODE)
 *
 * Kritické testy:
 * 1. Growth scenario: sum=100%, caps hold, risk≤cap+1.0, ETF drop guard
 * 2. No-stuck guarantee: max 50 iterations, žiadne infinite loops
 * 3. Edge cases: small/large plans, crypto cap edge
 */

import { describe, it, expect } from "vitest";
import { enforceRiskCap } from "../src/features/portfolio/enforceRiskCap";
import type { MixItem } from "../src/features/mix/mix.service";

describe("PR-36: enforceRiskCap P0 fix (Remove DIRECT CUT)", () => {
  /**
   * TEST 1: Growth scenario (10k lump, 300 monthly, 20 years)
   *
   * Expectation:
   * - sum(mix) === 100% (±0.01)
   * - Dyn + Crypto <= 22% (hard cap)
   * - risk <= riskMax + 1.0 OR warning "risk-cap-unreachable"
   * - ETF drop guard: ak ETF_in >= 40%, potom ETF_out >= ETF_in - 15 p.b.
   */
  it("Growth scenario: enforceRiskCap nesmie zničiť ETF mix (no DIRECT CUT)", () => {
    // Simulovaný UP-TUNE output (Growth profile, ETF heavy)
    const inputMix: MixItem[] = [
      { key: "gold", pct: 9.5 },
      { key: "dyn", pct: 10.0 },
      { key: "etf", pct: 49.0 }, // High ETF (testuje ETF drop guard)
      { key: "bonds", pct: 5.0 },
      { key: "cash", pct: 2.0 },
      { key: "crypto", pct: 11.5 },
      { key: "real", pct: 10.0 },
      { key: "bond3y9", pct: 3.0 },
    ];

    const result = enforceRiskCap(inputMix, "rastovy", undefined, 50);

    console.log(
      `[TEST Growth] Initial risk: ${result.initialRisk.toFixed(2)}, Final risk: ${result.finalRisk.toFixed(2)}`
    );
    console.log(`[TEST Growth] Warning: ${result.warning ?? "none"}`);

    // Assert 1: Sum = 100% (±0.01)
    const sum = result.mix.reduce((acc, m) => acc + m.pct, 0);
    expect(sum).toBeCloseTo(100, 1); // 1 decimal = ±0.1% tolerance

    // Assert 2: Dyn + Crypto <= 22% (hard cap)
    const dynPct = result.mix.find((m) => m.key === "dyn")?.pct ?? 0;
    const cryptoPct = result.mix.find((m) => m.key === "crypto")?.pct ?? 0;
    expect(dynPct + cryptoPct).toBeLessThanOrEqual(22.5); // +0.5 buffer pre normalizáciu

    // Assert 3: Risk <= riskMax + 1.0 OR warning ak unreachable
    const riskMax = 7.5; // Growth cap
    if (result.finalRisk > riskMax + 1.0) {
      // Ak risk > cap+1.0, musí byť warning
      expect(result.warning).not.toBeNull();
      expect(result.warning).toContain("risk-cap-unreachable");
    } else {
      // Ak risk <= cap+1.0, warning nemusí byť (alebo môže byť iný typ)
      expect(result.finalRisk).toBeLessThanOrEqual(riskMax + 1.0);
    }

    // Assert 4: ETF drop guard (ak ETF_in >= 40%, drop <= 15 p.b.)
    const inputETF = inputMix.find((m) => m.key === "etf")?.pct ?? 0;
    const outputETF = result.mix.find((m) => m.key === "etf")?.pct ?? 0;

    if (inputETF >= 40) {
      const drop = inputETF - outputETF;
      expect(drop).toBeLessThanOrEqual(15); // Absolute drop <= 15 p.b.

      // Nie DIRECT CUT behavior (ETF by padlo o 50%+)
      expect(drop).toBeLessThan(inputETF * 0.3); // Drop < 30% relatívne
    }

    // Assert 5: Iterácie < 50 (no infinite loop)
    expect(result.iterations).toBeLessThan(50);

    console.log(
      `[TEST Growth] ETF: ${inputETF.toFixed(1)}% → ${outputETF.toFixed(1)}% (drop ${(inputETF - outputETF).toFixed(1)} p.b.)`
    );
    console.log(
      `[TEST Growth] Risk: ${result.initialRisk.toFixed(2)} → ${result.finalRisk.toFixed(2)} (${result.iterations} iter)`
    );
    console.log(
      `[TEST Growth] Dyn+Crypto: ${(dynPct + cryptoPct).toFixed(1)}% / 22%`
    );
  });

  /**
   * TEST 2: No-stuck guarantee (max iterations enforcement)
   *
   * Edge case: Extrémny risk (crypto 80%), hard caps full → musí sa zastaviť do 50 iterácií
   */
  it("No-stuck guarantee: enforceRiskCap sa ukončí do max 50 iterácií", () => {
    // Extrémny scenár: Crypto 80%, bonds 20% (risk cca 7.4)
    const extremeMix: MixItem[] = [
      { key: "gold", pct: 0 },
      { key: "dyn", pct: 0 },
      { key: "etf", pct: 0 },
      { key: "bonds", pct: 20 },
      { key: "cash", pct: 0 },
      { key: "crypto", pct: 80 }, // Extrémne vysoký risk
      { key: "real", pct: 0 },
      { key: "bond3y9", pct: 0 },
    ];

    const result = enforceRiskCap(extremeMix, "konzervativny", undefined, 50);

    // Assert 1: Iterácie <= 50 (musí sa zastaviť)
    expect(result.iterations).toBeLessThanOrEqual(50);

    // Assert 2: Sum = 100%
    const sum = result.mix.reduce((acc, m) => acc + m.pct, 0);
    expect(sum).toBeCloseTo(100, 1);

    // Assert 3: Mix je validný (žiadne NaN, žiadne <0)
    result.mix.forEach((m) => {
      expect(m.pct).toBeGreaterThanOrEqual(0);
      expect(m.pct).not.toBeNaN();
    });

    // Assert 4: Žiadny "DIRECT CUT" log (toto je vizuálne overenie v dev console)
    // V unit teste to nevieme overovať priamo, ale konzola by NEMALA obsahovať "DIRECT CUT MODE"

    console.log(
      `[TEST No-stuck] Risk: ${result.initialRisk.toFixed(2)} → ${result.finalRisk.toFixed(2)} (${result.iterations} iter)`
    );
    console.log(`[TEST No-stuck] Warning: ${result.warning ?? "none"}`);
  });

  /**
   * TEST 3: Edge case – malý plán (1000 EUR lump, 50 monthly)
   *
   * Expectation: enforceRiskCap nesmie zlyhať na malých číslach
   */
  it("Edge case: malý plán (small amounts) – enforceRiskCap stable", () => {
    const smallPlanMix: MixItem[] = [
      { key: "gold", pct: 10 },
      { key: "dyn", pct: 8 },
      { key: "etf", pct: 30 },
      { key: "bonds", pct: 20 },
      { key: "cash", pct: 5 },
      { key: "crypto", pct: 12 },
      { key: "real", pct: 10 },
      { key: "bond3y9", pct: 5 },
    ];

    const result = enforceRiskCap(smallPlanMix, "vyvazeny", undefined, 50);

    // Assert 1: Sum = 100%
    const sum = result.mix.reduce((acc, m) => acc + m.pct, 0);
    expect(sum).toBeCloseTo(100, 1);

    // Assert 2: Risk <= cap + 1.0 OR warning
    const riskMax = 6.0; // Balanced cap
    if (result.finalRisk > riskMax + 1.0) {
      expect(result.warning).not.toBeNull();
      expect(result.warning).toContain("risk-cap-unreachable");
    } else {
      expect(result.finalRisk).toBeLessThanOrEqual(riskMax + 1.0);
    }

    console.log(
      `[TEST Small] Risk: ${result.initialRisk.toFixed(2)} → ${result.finalRisk.toFixed(2)} (${result.iterations} iter)`
    );
  });

  /**
   * TEST 4: Crypto cap edge (Dyn + Crypto = 22%, risk HIGH)
   *
   * Expectation: enforceRiskCap škrtá dyn/crypto proporcionálne, neprekoná hard cap 22%
   */
  it("Edge case: Dyn+Crypto cap (22%) – enforceRiskCap dodržiava hard caps", () => {
    const cryptoCapMix: MixItem[] = [
      { key: "gold", pct: 8 },
      { key: "dyn", pct: 15 }, // Dyn+Crypto = 22% (na hard cap)
      { key: "etf", pct: 35 },
      { key: "bonds", pct: 10 },
      { key: "cash", pct: 2 },
      { key: "crypto", pct: 7 }, // Dyn+Crypto = 22%
      { key: "real", pct: 18 },
      { key: "bond3y9", pct: 5 },
    ];

    const result = enforceRiskCap(cryptoCapMix, "rastovy", undefined, 50);

    // Assert 1: Dyn + Crypto <= 22%
    const dynPct = result.mix.find((m) => m.key === "dyn")?.pct ?? 0;
    const cryptoPct = result.mix.find((m) => m.key === "crypto")?.pct ?? 0;
    expect(dynPct + cryptoPct).toBeLessThanOrEqual(22.5); // +0.5 buffer

    // Assert 2: Sum = 100%
    const sum = result.mix.reduce((acc, m) => acc + m.pct, 0);
    expect(sum).toBeCloseTo(100, 1);

    console.log(
      `[TEST CryptoCap] Dyn+Crypto: ${(dynPct + cryptoPct).toFixed(1)}% / 22%`
    );
    console.log(
      `[TEST CryptoCap] Risk: ${result.initialRisk.toFixed(2)} → ${result.finalRisk.toFixed(2)}`
    );
  });

  /**
   * TEST 5: Balanced profile – zlato cap 20% (enforceRiskCap sink limit)
   *
   * Expectation: Ak zlato dosiahne 20% (Balanced hard cap), sink je "full" a nesmie rásť
   */
  it("Balanced profile: zlato sink cap 20% – enforceRiskCap dodržiava maxPct", () => {
    const balancedMix: MixItem[] = [
      { key: "gold", pct: 18 }, // Blízko 20% cap
      { key: "dyn", pct: 12 },
      { key: "etf", pct: 35 },
      { key: "bonds", pct: 10 },
      { key: "cash", pct: 2 },
      { key: "crypto", pct: 8 },
      { key: "real", pct: 10 },
      { key: "bond3y9", pct: 5 },
    ];

    const result = enforceRiskCap(balancedMix, "vyvazeny", undefined, 50);

    // Assert 1: Zlato <= 20% (Balanced maxPct)
    const goldPct = result.mix.find((m) => m.key === "gold")?.pct ?? 0;
    expect(goldPct).toBeLessThanOrEqual(20.5); // +0.5 buffer pre normalizáciu

    // Assert 2: Sum = 100%
    const sum = result.mix.reduce((acc, m) => acc + m.pct, 0);
    expect(sum).toBeCloseTo(100, 1);

    console.log(
      `[TEST BalancedGold] Gold: ${goldPct.toFixed(1)}% / 20% (maxPct)`
    );
    console.log(
      `[TEST BalancedGold] Risk: ${result.initialRisk.toFixed(2)} → ${result.finalRisk.toFixed(2)}`
    );
  });
});
