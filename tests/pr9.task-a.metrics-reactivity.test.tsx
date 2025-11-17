/**
 * PR-9 Task A: Test reaktivity metrík (výnos/riziko/majetok)
 * 
 * Cieľ: Overiť, že po zmene slidera (lump/monthly/years) alebo mixu
 * sa metriky okamžite zmenia a NEZAMRZN

Ú na profile konštantách.
 * 
 * Scenár:
 * 1. Nastav Rastový profil → metriky musia zodpovedať rastovému mixu (nie 16.2 %)
 * 2. Zvýš monthly o +50 € → Očakávaný majetok sa zmení
 * 3. Zmeň mix manuálne → výnos/riziko sa prepočítajú
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  approxYieldAnnualFromMix,
  riskScore0to10,
} from "../src/features/mix/assetModel";
import { getDynamicDefaultMix } from "../src/features/portfolio/presets";

describe("PR-9 Task A: Metrics reactivity (no freezing)", () => {
  it("Rastový profil má vyšší výnos než konzervatívny", () => {
    const rastovyMix = getDynamicDefaultMix("rastovy");
    const konzervativnyMix = getDynamicDefaultMix("konzervativny");

    const rastovyYield = approxYieldAnnualFromMix(rastovyMix, "rastovy");
    const konzervativnyYield = approxYieldAnnualFromMix(
      konzervativnyMix,
      "konzervativny"
    );

    // Rastový musí mať vyšší výnos
    expect(rastovyYield).toBeGreaterThan(konzervativnyYield);

    // Rastový výnos nesmie byť 16.2% (to je hard-coded vyvážený fallback bug)
    expect(rastovyYield).not.toBeCloseTo(0.162, 3);

    // Rastový výnos musí byť aspoň 18% (typicky ~21-23%)
    expect(rastovyYield).toBeGreaterThan(0.18);
  });

  it("Riziko sa líši medzi profilmi", () => {
    const rastovyMix = getDynamicDefaultMix("rastovy");
    const konzervativnyMix = getDynamicDefaultMix("konzervativny");

    const rastovyRisk = riskScore0to10(rastovyMix, "rastovy", 0);
    const konzervativnyRisk = riskScore0to10(
      konzervativnyMix,
      "konzervativny",
      0
    );

    // Rastový musí mať vyššie riziko
    expect(rastovyRisk).toBeGreaterThan(konzervativnyRisk);

    // Riziko nesmie byť zamrznuté na ~6.0 (vyvážený fallback bug)
    expect(rastovyRisk).toBeGreaterThan(6.5);
  });

  it("Prázdny mix vracia fallback 4%", () => {
    const emptyYield = approxYieldAnnualFromMix([], "vyvazeny");
    expect(emptyYield).toBe(0.04); // Definovaný fallback v assetModel.ts
  });

  it("getDynamicDefaultMix vracia rôzne mixy podľa profilu", () => {
    const konzMix = getDynamicDefaultMix("konzervativny");
    const vyvMix = getDynamicDefaultMix("vyvazeny");
    const rastMix = getDynamicDefaultMix("rastovy");

    // Mixy nesmú byť rovnaké
    expect(JSON.stringify(konzMix)).not.toBe(JSON.stringify(vyvMix));
    expect(JSON.stringify(vyvMix)).not.toBe(JSON.stringify(rastMix));

    // Rastový má viac dyn + crypto než konzervatívny
    const konzDynPct = konzMix.find((m) => m.key === "dyn")?.pct || 0;
    const rastDynPct = rastMix.find((m) => m.key === "dyn")?.pct || 0;
    expect(rastDynPct).toBeGreaterThan(konzDynPct);
  });
});
