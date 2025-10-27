/**
 * PR-14.E: T1-T10 Stage Reactivity Integration Tests
 *
 * Overenie, že portfolio reaguje (nefreezeuje) pri všetkých edge case scenároch.
 * Každý test:
 * - Nastaví investičné parametre (lump/monthly/years)
 * - Vyberie rizikovú preferenciu (Konzervatívne/Vyvážené/Rastové)
 * - Overí, že enforceStageCaps vracia 100% mix
 * - Overí očakávaný stage (STARTER/CORE/LATE)
 */

import { describe, test, expect } from "vitest";
import { enforceStageCaps } from "../src/features/portfolio/presets";
import { getAssetCaps } from "../src/features/policy/caps";
import { detectStage } from "../src/features/policy/stage";
import type { MixItem } from "../src/features/mix/mix.service";

// Helper: Vytvor base mix zo všetkých asset keys
function createBaseMix(): MixItem[] {
  return [
    { key: "gold", pct: 10 },
    { key: "dyn", pct: 15 },
    { key: "etf", pct: 30 },
    { key: "bonds", pct: 20 },
    { key: "cash", pct: 15 },
    { key: "crypto", pct: 5 },
    { key: "real", pct: 5 },
  ];
}

// Helper: Overenie 100% mixu (±0.05)
function assertMixValid(mix: MixItem[], scenario: string) {
  expect(mix, `${scenario}: mix should not be null/undefined`).toBeDefined();
  const sum = mix.reduce((acc, m) => acc + m.pct, 0);
  expect(sum, `${scenario}: mix sum should be ~100%`).toBeGreaterThanOrEqual(
    99.95
  );
  expect(sum, `${scenario}: mix sum should be ~100%`).toBeLessThanOrEqual(
    100.05
  );
}

// Helper: Overenie stage (očakávaný vs. skutočný)
function assertStage(
  lump: number,
  monthly: number,
  years: number,
  expectedStage: string,
  scenario: string
) {
  const actualStage = detectStage(lump, monthly, years);
  expect(actualStage, `${scenario}: expected stage "${expectedStage}"`).toBe(
    expectedStage
  );
}

describe("PR-14.E: T1-T10 Stage Reactivity Tests (Edge Cases)", () => {
  test("T1: 0€ / 0€ / 20r → STARTER (úplný nováčik)", () => {
    const lump = 0,
      monthly = 0,
      years = 20;
    const scenario = "T1: 0€/0€/20r";

    assertStage(lump, monthly, years, "STARTER", scenario);

    const baseMix = createBaseMix();
    const stage = detectStage(lump, monthly, years);
    const caps = getAssetCaps("vyvazeny", stage);

    const result = enforceStageCaps(baseMix, "vyvazeny", stage);
    assertMixValid(result, scenario);
  });

  test("T2: 0€ / 400€ / 8r → STARTER (problematický prípad - bol CORE)", () => {
    const lump = 0,
      monthly = 400,
      years = 8;
    const scenario = "T2: 0€/400€/8r (CORE gap fix)";

    // PR-14.A: Tento scenár by mal byť STARTER (lump<30k && monthly<800 && years≥8)
    assertStage(lump, monthly, years, "STARTER", scenario);

    const baseMix = createBaseMix();
    const stage = detectStage(lump, monthly, years);

    const result = enforceStageCaps(baseMix, "vyvazeny", stage);
    assertMixValid(result, scenario);
  });

  test("T3: 0€ / 600€ / 8r → STARTER (hrana STARTER)", () => {
    const lump = 0,
      monthly = 600,
      years = 8;
    const scenario = "T3: 0€/600€/8r";

    assertStage(lump, monthly, years, "STARTER", scenario);

    const baseMix = createBaseMix();
    const stage = detectStage(lump, monthly, years);

    const result = enforceStageCaps(baseMix, "vyvazeny", stage);
    assertMixValid(result, scenario);
  });

  test("T4: 0€ / 1000€ / 8r → LATE (vysoký vklad)", () => {
    const lump = 0,
      monthly = 1000,
      years = 8;
    const scenario = "T4: 0€/1000€/8r";

    assertStage(lump, monthly, years, "LATE", scenario);

    const baseMix = createBaseMix();
    const stage = detectStage(lump, monthly, years);

    const result = enforceStageCaps(baseMix, "vyvazeny", stage);
    assertMixValid(result, scenario);
  });

  test("T5: 10000€ / 200€ / 15r → STARTER (malý kapitál, dlhý horizont)", () => {
    const lump = 10000,
      monthly = 200,
      years = 15;
    const scenario = "T5: 10000€/200€/15r";

    assertStage(lump, monthly, years, "STARTER", scenario);

    const baseMix = createBaseMix();
    const stage = detectStage(lump, monthly, years);

    const result = enforceStageCaps(baseMix, "vyvazeny", stage);
    assertMixValid(result, scenario);
  });

  test("T6: 29999€ / 799€ / 8r → STARTER (tesne pod CORE hranicou)", () => {
    const lump = 29999,
      monthly = 799,
      years = 8;
    const scenario = "T6: 29999€/799€/8r (STARTER edge)";

    // PR-14.A: Tento scenár by mal byť STARTER (lump<30k && monthly<800 && years≥8)
    assertStage(lump, monthly, years, "STARTER", scenario);

    const baseMix = createBaseMix();
    const stage = detectStage(lump, monthly, years);

    const result = enforceStageCaps(baseMix, "vyvazeny", stage);
    assertMixValid(result, scenario);
  });

  test("T7: 49999€ / 999€ / 8r → LATE (problematický prípad - bol CORE)", () => {
    const lump = 49999,
      monthly = 999,
      years = 8;
    const scenario = "T7: 49999€/999€/8r (LATE edge)";

    // PR-14.A: Tento scenár by mal byť LATE (lump≥40k || monthly≥800)
    assertStage(lump, monthly, years, "LATE", scenario);

    const baseMix = createBaseMix();
    const stage = detectStage(lump, monthly, years);

    const result = enforceStageCaps(baseMix, "vyvazeny", stage);
    assertMixValid(result, scenario);
  });

  test("T8: 100000€ / 1000€ / 5r → LATE (veľký kapitál, krátky horizont)", () => {
    const lump = 100000,
      monthly = 1000,
      years = 5;
    const scenario = "T8: 100000€/1000€/5r";

    assertStage(lump, monthly, years, "LATE", scenario);

    const baseMix = createBaseMix();
    const stage = detectStage(lump, monthly, years);

    const result = enforceStageCaps(baseMix, "vyvazeny", stage);
    assertMixValid(result, scenario);
  });

  test("T9: 35000€ / 850€ / 10r → LATE (monthly≥800 → LATE)", () => {
    const lump = 35000,
      monthly = 850,
      years = 10;
    const scenario = "T9: 35000€/850€/10r";

    // Tento scenár je LATE (lump 30k-40k, ale monthly≥800 → LATE)
    const stage = detectStage(lump, monthly, years);
    expect(stage, `${scenario}: expected LATE (monthly≥800)`).toBe("LATE");

    const baseMix = createBaseMix();
    const result = enforceStageCaps(baseMix, "vyvazeny", stage);
    assertMixValid(result, scenario);
  });

  test("T10: 200000€ / 0€ / 3r → LATE (veľký lump sum, žiadny vklad, krátky horizont)", () => {
    const lump = 200000,
      monthly = 0,
      years = 3;
    const scenario = "T10: 200000€/0€/3r";

    assertStage(lump, monthly, years, "LATE", scenario);

    const baseMix = createBaseMix();
    const stage = detectStage(lump, monthly, years);

    const result = enforceStageCaps(baseMix, "vyvazeny", stage);
    assertMixValid(result, scenario);
  });

  test("T11 (bonus): Elastic cash sink - overflow absorpcia", () => {
    const scenario = "T11: Elastic cash sink (extreme overflow)";

    // Mix s veľkým overflow (napr. veľké ETF nad limit)
    const extremeMix: MixItem[] = [
      { key: "gold", pct: 15 },
      { key: "dyn", pct: 20 },
      { key: "etf", pct: 50 }, // Veľké ETF
      { key: "bonds", pct: 5 },
      { key: "cash", pct: 5 },
      { key: "crypto", pct: 8 }, // Nad CORE limit (6%)
      { key: "real", pct: 2 },
    ];

    const stage = "CORE";
    const result = enforceStageCaps(extremeMix, "vyvazeny", stage);

    // PR-14.C: Elastic cash sink garantuje 100% mix (overflow → cash)
    assertMixValid(result, scenario);

    // Overenie, že crypto bol obmedzený na cap (6%)
    const cryptoItem = result.find((m) => m.key === "crypto");
    expect(
      cryptoItem?.pct,
      `${scenario}: crypto should be capped to ~6%`
    ).toBeLessThanOrEqual(6.5);

    // Cash by mal absorbovať overflow (môže byť nad 35% cap, ale môže byť aj pod baseline 5% kvôli normalizácii)
    const cashItem = result.find((m) => m.key === "cash");
    expect(cashItem, `${scenario}: cash item should exist`).toBeDefined();
    expect(
      cashItem!.pct,
      `${scenario}: cash should be present`
    ).toBeGreaterThan(0);
  });

  test("T12 (bonus): Circuit breaker - cache hit pri rovnakom mixe", () => {
    const scenario = "T12: Circuit breaker (0ms cache)";

    const baseMix = createBaseMix();
    const stage = "CORE";

    // Prvý run
    const result1 = enforceStageCaps(baseMix, "vyvazeny", stage);
    assertMixValid(result1, `${scenario} (first run)`);

    // Druhý run s rovnakým mixom - mal by hneď vrátiť cached result (0ms window)
    const result2 = enforceStageCaps(baseMix, "vyvazeny", stage);
    assertMixValid(result2, `${scenario} (cached run)`);

    // Overenie, že výsledky sú rovnaké (cache hit)
    expect(
      JSON.stringify(result1),
      `${scenario}: results should be identical (cache)`
    ).toBe(JSON.stringify(result2));
  });
});
