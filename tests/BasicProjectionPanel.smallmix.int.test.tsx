/**
 * Integration test: Celý pipeline mix → výnos → FV → UI zobrazenie
 * Overuje, že BasicProjectionPanel používa rovnaký výpočet ako engine
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BasicProjectionPanel } from "../src/features/overview/BasicProjectionPanel";
import { approxYieldAnnualFromMix } from "../src/features/mix/assetModel";
import { calculateFutureValue } from "../src/engine/calculations";
import {
  SMALL_MIX_VYVAZENY,
  SMALL_MIX_RISK_PREF,
  EXPECTED_VALUES,
} from "../src/test/fixtures/smallMix";

describe("BasicProjectionPanel - SMALL_MIX integračný test", () => {
  // Test parametre (zodpovedajú screenshotu)
  const testParams = {
    mix: SMALL_MIX_VYVAZENY,
    lumpSumEur: 10000,
    monthlyVklad: 500,
    horizonYears: 20,
    goalAssetsEur: 1000000,
    riskPref: SMALL_MIX_RISK_PREF,
  };

  beforeEach(() => {
    // Clear localStorage pred každým testom
    localStorage.clear();
  });

  it("zobrazuje očakávaný majetok konzistentný s engine výpočtom", () => {
    // Arrange: Vypočítaj očakávanú FV pomocou rovnakého pipeline
    const rate = approxYieldAnnualFromMix(testParams.mix, testParams.riskPref);
    const expectedFV = calculateFutureValue(
      testParams.lumpSumEur,
      testParams.monthlyVklad,
      testParams.horizonYears,
      rate
    );

    // Act: Render komponent
    render(<BasicProjectionPanel {...testParams} />);

    // Assert: Čítaj hodnotu z UI pomocou data-testid (prvý element ak je viacero)
    const valueElements = screen.getAllByTestId("expected-assets-value");
    const valueElement = valueElements[0];
    const displayedText = valueElement.textContent || "";

    // Parse číslo z formátovaného textu (napr. "567 000 €" → 567000)
    const cleanedText = displayedText
      .replace(/\s+/g, "") // odstráň medzery
      .replace(/€/g, "") // odstráň €
      .replace(/mld/g, "000000000") // mld → 9 núl
      .replace(/M/g, "000000"); // M → 6 núl

    const displayedValue = parseFloat(cleanedText);

    // Assert: Tolerancia ±0.30%
    const tolerance = expectedFV * EXPECTED_VALUES.fvTolerance;

    expect(displayedValue).toBeGreaterThan(expectedFV - tolerance);
    expect(displayedValue).toBeLessThan(expectedFV + tolerance);
  });

  it("používa rovnaký výnos ako assetModel", () => {
    // Arrange
    const expectedYield = approxYieldAnnualFromMix(
      testParams.mix,
      testParams.riskPref
    );

    // Act: Render panel
    render(<BasicProjectionPanel {...testParams} />);

    // Výpočet FV v komponente by mal používať ten istý rate
    // (nepriamy test - overujeme cez FV výsledok v predošlom teste)
    expect(expectedYield).toBeCloseTo(EXPECTED_VALUES.approxYield, 6);
  });

  it("konzistentne zobrazuje výsledok pri opakovanom renderingu", () => {
    // Render 1
    const { unmount } = render(<BasicProjectionPanel {...testParams} />);
    const elements1 = screen.getAllByTestId("expected-assets-value");
    const value1 = elements1[0].textContent;

    unmount();

    // Render 2
    render(<BasicProjectionPanel {...testParams} />);
    const elements2 = screen.getAllByTestId("expected-assets-value");
    const value2 = elements2[0].textContent;

    expect(value1).toBe(value2);
  });

  it("pri zmene mixu sa mení aj FV (reaktivita)", () => {
    // Mix 1: SMALL_MIX
    const { rerender } = render(<BasicProjectionPanel {...testParams} />);
    const elements1 = screen.getAllByTestId("expected-assets-value");
    const value1 = elements1[0].textContent;

    // Mix 2: Konzervativnejší (len bonds + cash)
    const conservativeMix = [
      { key: "bonds" as const, pct: 50 },
      { key: "cash" as const, pct: 50 },
    ];

    rerender(<BasicProjectionPanel {...testParams} mix={conservativeMix} />);
    const elements2 = screen.getAllByTestId("expected-assets-value");
    const value2 = elements2[0].textContent;

    // Hodnoty musia byť rôzne (konzervatívny mix má nižší výnos)
    expect(value1).not.toBe(value2);
  });

  it("zobrazuje správny formát čísla (nie NaN ani undefined)", () => {
    render(<BasicProjectionPanel {...testParams} />);

    const valueElements = screen.getAllByTestId("expected-assets-value");
    const valueElement = valueElements[0];
    const text = valueElement.textContent || "";

    // Nesmie obsahovať NaN, undefined, null
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");

    // Musí obsahovať € symbol
    expect(text).toContain("€");

    // Musí obsahovať aspoň 1 číslicu
    expect(text).toMatch(/\d/);
  });
});
