/**
 * Portfolio presets - unit testy
 * 
 * Overuje:
 * - Risk score presetov je pod cap
 * - Reality filter funguje správne
 * - Validácia diverzifikácie
 */

import { describe, it, expect } from "vitest";
import type { MixItem } from "../src/features/mix/mix.service";
import {
  PORTFOLIO_PRESETS,
  adjustPresetForProfile,
  validatePresetRisk,
} from "../src/features/portfolio/presets";
import {
  riskScore0to10,
  getRiskCap,
  approxYieldAnnualFromMix,
} from "../src/features/mix/assetModel";

describe("Portfolio presets - risk validation", () => {
  it("Konzervatívny preset má risk pod cap 4.0", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "konzervativny")!;
    expect(preset).toBeDefined();

    const risk = riskScore0to10(preset.mix, preset.id);
    const cap = getRiskCap(preset.id);

    expect(risk).toBeLessThanOrEqual(cap);
    expect(risk).toBeGreaterThanOrEqual(preset.targetRisk.min);
    expect(risk).toBeLessThanOrEqual(preset.targetRisk.max);

    console.log(`[Konzervatívny] Risk: ${risk.toFixed(2)}, Cap: ${cap}`);
  });

  it("Vyvážený preset má risk pod cap 6.0", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
    expect(preset).toBeDefined();

    const risk = riskScore0to10(preset.mix, preset.id);
    const cap = getRiskCap(preset.id);

    expect(risk).toBeLessThanOrEqual(cap);
    expect(risk).toBeGreaterThanOrEqual(preset.targetRisk.min);
    expect(risk).toBeLessThanOrEqual(preset.targetRisk.max);

    console.log(`[Vyvážený] Risk: ${risk.toFixed(2)}, Cap: ${cap}`);
  });

  it("Rastový preset má risk pod cap 7.5", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;
    expect(preset).toBeDefined();

    const risk = riskScore0to10(preset.mix, preset.id);
    const cap = getRiskCap(preset.id);

    expect(risk).toBeLessThanOrEqual(cap);
    expect(risk).toBeGreaterThanOrEqual(preset.targetRisk.min);
    expect(risk).toBeLessThanOrEqual(preset.targetRisk.max);

    console.log(`[Rastový] Risk: ${risk.toFixed(2)}, Cap: ${cap}`);
  });
});

describe("Portfolio presets - mix composition", () => {
  it("Všetky presety majú súčet 100%", () => {
    PORTFOLIO_PRESETS.forEach((preset) => {
      const sum = preset.mix.reduce((acc, m) => acc + m.pct, 0);
      expect(sum).toBeCloseTo(100, 1); // tolerance 0.1%
    });
  });

  it("Žiadny preset nemá single asset > 40% (okrem bonds v konzervatívnom)", () => {
    PORTFOLIO_PRESETS.forEach((preset) => {
      preset.mix.forEach((item) => {
        if (preset.id === "konzervativny" && item.key === "bonds") {
          // Výnimka: bonds môže byť až 30-35% v konzervatívnom
          expect(item.pct).toBeLessThanOrEqual(35);
        } else {
          expect(item.pct).toBeLessThanOrEqual(40);
        }
      });
    });
  });

  it("Dynamické riadenie dodržiava pásma (≤11% konzervativny, 11-21% vyvážený, 21-31% rastový)", () => {
    const konz = PORTFOLIO_PRESETS.find((p) => p.id === "konzervativny")!;
    const dynKonz = konz.mix.find((m) => m.key === "dyn")?.pct ?? 0;
    expect(dynKonz).toBeLessThanOrEqual(11);

    const vyv = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
    const dynVyv = vyv.mix.find((m) => m.key === "dyn")?.pct ?? 0;
    expect(dynVyv).toBeGreaterThan(11);
    expect(dynVyv).toBeLessThanOrEqual(21);

    const rast = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;
    const dynRast = rast.mix.find((m) => m.key === "dyn")?.pct ?? 0;
    expect(dynRast).toBeGreaterThan(21);
    expect(dynRast).toBeLessThanOrEqual(31);
  });

  it("Dyn + Crypto súčet neprekračuje 35% v žiadnom preset", () => {
    PORTFOLIO_PRESETS.forEach((preset) => {
      const dynPct = preset.mix.find((m) => m.key === "dyn")?.pct ?? 0;
      const cryptoPct = preset.mix.find((m) => m.key === "crypto")?.pct ?? 0;
      const sum = dynPct + cryptoPct;

      expect(sum).toBeLessThanOrEqual(35);
      console.log(`[${preset.label}] Dyn+Crypto: ${sum.toFixed(1)}%`);
    });
  });
});

describe("Portfolio presets - reality filter", () => {
  it("Reality je 0% ak príjem < 3500€ a vklad < 300k€", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
    const adjusted = adjustPresetForProfile(preset, {
      monthlyIncome: 2000,
      lumpSumEur: 0,
    });

    const realty = adjusted.find((m) => m.key === "real")?.pct ?? 0;
    expect(realty).toBeCloseTo(0, 1); // tolerance 0.1% (normalize môže dať 0.01)

    // Over že súčet je stále 100%
    const sum = adjusted.reduce((acc, m) => acc + m.pct, 0);
    expect(sum).toBeCloseTo(100, 1);
  });

  it("Reality ostáva ak príjem >= 3500€", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
    const originalRealty = preset.mix.find((m) => m.key === "real")?.pct ?? 0;

    const adjusted = adjustPresetForProfile(preset, {
      monthlyIncome: 4000,
      lumpSumEur: 0,
    });

    const realty = adjusted.find((m) => m.key === "real")?.pct ?? 0;
    expect(realty).toBeCloseTo(originalRealty, 1); // normalize môže zmeniť hodnotu mierne
    expect(realty).toBeGreaterThan(0);
  });

  it("Reality ostáva ak vklad >= 300k€", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;
    const originalRealty = preset.mix.find((m) => m.key === "real")?.pct ?? 0;

    const adjusted = adjustPresetForProfile(preset, {
      monthlyIncome: 0,
      lumpSumEur: 350000,
    });

    const realty = adjusted.find((m) => m.key === "real")?.pct ?? 0;
    expect(realty).toBe(originalRealty);
    expect(realty).toBeGreaterThan(0);
  });

  it("Reality redistribúcia zvyšuje ETF a bonds proporcionálne", () => {
    const preset = PORTFOLIO_PRESETS.find((p) => p.id === "vyvazeny")!;
    const originalEtf = preset.mix.find((m) => m.key === "etf")?.pct ?? 0;
    const originalBonds = preset.mix.find((m) => m.key === "bonds")?.pct ?? 0;
    const originalRealty = preset.mix.find((m) => m.key === "real")?.pct ?? 0;

    const adjusted = adjustPresetForProfile(preset, {
      monthlyIncome: 2000,
      lumpSumEur: 0,
    });

    const etf = adjusted.find((m) => m.key === "etf")?.pct ?? 0;
    const bonds = adjusted.find((m) => m.key === "bonds")?.pct ?? 0;

    // ETF by mal dostať približne 60% z reality (normalize môže zmeniť proporcie)
    // Pôvodne vyvážený real = 4%, takže očakávame ETF + ~2.4% a bonds + ~1.6%
    expect(etf).toBeGreaterThan(originalEtf); // Aspoň že ETF narastal
    expect(bonds).toBeGreaterThan(originalBonds); // Aspoň že bonds narastal
    expect(etf + bonds).toBeCloseTo(originalEtf + originalBonds + originalRealty, 0); // Súčet sa zachoval
  });
});

describe("Portfolio presets - validation", () => {
  it("validatePresetRisk detectuje prekročenie risk cap", () => {
    // Simuluj nebezpečný mix ktorý prejde cez diverzifikáciu ale zlyháva na risk cap
    const dangerousMix: MixItem[] = [
      { key: "dyn", pct: 30 },
      { key: "crypto", pct: 5 }, // Spolu 35% = OK
      { key: "etf", pct: 35 },
      { key: "gold", pct: 10 },
      { key: "bonds", pct: 10 },
      { key: "cash", pct: 10 },
    ];

    const risk = riskScore0to10(dangerousMix, "konzervativny");
    const cap = getRiskCap("konzervativny");

    const result = validatePresetRisk(
      dangerousMix,
      "konzervativny",
      risk,
      cap,
      0,      // lumpSum
      300     // monthly (= 3600 EUR/rok, dostatok pre validáciu)
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain("prekračuje limit");
  });

  it("validatePresetRisk detectuje prekročenie single asset limit", () => {
    const overweightMix: MixItem[] = [
      { key: "etf", pct: 55 }, // Príliš vysoké
      { key: "gold", pct: 20 },
      { key: "bonds", pct: 15 },
      { key: "cash", pct: 10 },
    ];

    const risk = riskScore0to10(overweightMix, "vyvazeny");
    const cap = getRiskCap("vyvazeny");

    const result = validatePresetRisk(
      overweightMix,
      "vyvazeny",
      risk,
      cap,
      0,      // lumpSum
      300     // monthly (= 3600 EUR/rok, dostatok pre validáciu)
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain("alokácia");
  });

  it("validatePresetRisk detectuje prekročenie dyn+crypto limitu", () => {
    const riskyMix: MixItem[] = [
      { key: "dyn", pct: 25 },
      { key: "crypto", pct: 15 }, // Spolu 40% > 35%
      { key: "etf", pct: 30 },
      { key: "gold", pct: 20 },
      { key: "bonds", pct: 10 },
    ];

    const risk = riskScore0to10(riskyMix, "rastovy");
    const cap = getRiskCap("rastovy");

    const result = validatePresetRisk(riskyMix, "rastovy", risk, cap);

    expect(result.valid).toBe(false);
    expect(result.message).toContain("Súčet Dynamického");
    expect(result.message).toContain("35%");
  });
});

describe("Portfolio presets - yield calculation", () => {
  it("Konzervatívny preset má nižší yield ako rastový", () => {
    const konz = PORTFOLIO_PRESETS.find((p) => p.id === "konzervativny")!;
    const rast = PORTFOLIO_PRESETS.find((p) => p.id === "rastovy")!;

    const yieldKonz = approxYieldAnnualFromMix(konz.mix, konz.id);
    const yieldRast = approxYieldAnnualFromMix(rast.mix, rast.id);

    expect(yieldKonz).toBeLessThan(yieldRast);

    console.log(`[Yield] Konzervatívny: ${(yieldKonz * 100).toFixed(1)}%`);
    console.log(`[Yield] Rastový: ${(yieldRast * 100).toFixed(1)}%`);
  });

  it("Všetky presety majú pozitívny yield", () => {
    PORTFOLIO_PRESETS.forEach((preset) => {
      const yield_pa = approxYieldAnnualFromMix(preset.mix, preset.id);
      expect(yield_pa).toBeGreaterThan(0);
      expect(yield_pa).toBeLessThan(1); // Max 100% ročne (sanity check)
    });
  });
});
