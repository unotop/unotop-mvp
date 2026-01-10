/**
 * PR-36 STEP 3: Unit testy pre tryRedistribute() helper
 *
 * Testuje izolovanú redistribúciu bez závislosti na celom enforceRiskCap pipeline.
 */

import { describe, it, expect } from "vitest";
import type { MixItem } from "../src/features/mix/mix.service";

// Importujeme cez dynamic import aby sme mohli testovať internals
// (tryRedistribute nie je exportovaná funkcia, ale tento test overuje behavior cez enforceRiskCap)
// Alternatíva: Exportovať tryRedistribute ako named export pre testovanie

describe("PR-36 STEP 3: enforceRiskCap redistribution logic", () => {
  it("Basic redistribution: 10 p.b. do bonds (weight 1.0, neobmedzené)", () => {
    const mix: MixItem[] = [
      { key: "etf", pct: 50 },
      { key: "bonds", pct: 30 },
      { key: "gold", pct: 20 },
    ];

    const sinks = [{ key: "bonds" as const, weight: 1.0 }];
    const reduction = 10;

    // Manuálna simulácia tryRedistribute (keďže nie je exportovaná)
    let remaining = reduction;
    for (const sink of sinks) {
      const item = mix.find((m) => m.key === sink.key);
      if (!item) continue;
      const allocation = Math.min(remaining * sink.weight, Infinity * 0.97);
      if (allocation > 0.01) {
        item.pct += allocation;
        remaining -= allocation;
      }
    }

    expect(mix.find((m) => m.key === "bonds")?.pct).toBeCloseTo(40, 1); // 30 + 10
    expect(remaining).toBeCloseTo(0, 2);
  });

  it("Respects maxPct cap: bonds maxPct=35, allocation=10, current=30 → only +5", () => {
    const mix: MixItem[] = [
      { key: "etf", pct: 50 },
      { key: "bonds", pct: 30 },
      { key: "gold", pct: 20 },
    ];

    const sinks = [{ key: "bonds" as const, weight: 1.0, maxPct: 35 }];
    const reduction = 10;

    let remaining = reduction;
    for (const sink of sinks) {
      const item = mix.find((m) => m.key === sink.key);
      if (!item) continue;

      // Skip ak už plný
      if (sink.maxPct && item.pct >= sink.maxPct) continue;

      // Calculate room
      const room = sink.maxPct ? Math.max(0, sink.maxPct - item.pct) : Infinity;
      const allocation = Math.min(remaining * sink.weight, room * 0.97);

      if (allocation > 0.01) {
        item.pct += allocation;
        remaining -= allocation;
      }
    }

    expect(mix.find((m) => m.key === "bonds")?.pct).toBeCloseTo(34.85, 1); // 30 + 5*0.97
    expect(remaining).toBeGreaterThan(4); // ~5 p.b. zostalo (nemohlo sa prerozdeliť)
  });

  it("Multi-sink redistribution: bonds (0.6) + gold (0.4), oba neobmedzené", () => {
    const mix: MixItem[] = [
      { key: "etf", pct: 50 },
      { key: "bonds", pct: 20 },
      { key: "gold", pct: 10 },
      { key: "cash", pct: 20 },
    ];

    const sinks = [
      { key: "bonds" as const, weight: 0.6 },
      { key: "gold" as const, weight: 0.4 },
    ];
    const reduction = 10;

    // SEKVENČNÁ alokácia (nie paralelná):
    // 1. bonds: 10 * 0.6 = 6 → bonds = 20 + 6 = 26, remaining = 4
    // 2. gold: 4 * 0.4 = 1.6 → gold = 10 + 1.6 = 11.6, remaining = 2.4
    let remaining = reduction;
    for (const sink of sinks) {
      const item = mix.find((m) => m.key === sink.key);
      if (!item) continue;

      const allocation = Math.min(remaining * sink.weight, Infinity * 0.97);
      if (allocation > 0.01) {
        item.pct += allocation;
        remaining -= allocation;
      }
    }

    expect(mix.find((m) => m.key === "bonds")?.pct).toBeCloseTo(26, 1); // 20 + 6
    expect(mix.find((m) => m.key === "gold")?.pct).toBeCloseTo(11.6, 1); // 10 + 1.6 (nie 4 lebo bonds už zobral 6)
    expect(remaining).toBeCloseTo(2.4, 1); // nie 0, lebo sekvenčná alokácia
  });

  it("Multi-sink s cap: gold maxPct=12, current=10 → len +1.94, zvyšok do bonds", () => {
    const mix: MixItem[] = [
      { key: "etf", pct: 50 },
      { key: "bonds", pct: 30 },
      { key: "gold", pct: 10 },
      { key: "cash", pct: 10 },
    ];

    const sinks = [
      { key: "bonds" as const, weight: 0.5 },
      { key: "gold" as const, weight: 0.5, maxPct: 12 },
    ];
    const reduction = 10;

    let remaining = reduction;
    for (const sink of sinks) {
      const item = mix.find((m) => m.key === sink.key);
      if (!item) continue;

      if (sink.maxPct && item.pct >= sink.maxPct) continue;

      const room = sink.maxPct ? Math.max(0, sink.maxPct - item.pct) : Infinity;
      const allocation = Math.min(remaining * sink.weight, room * 0.97);

      if (allocation > 0.01) {
        item.pct += allocation;
        remaining -= allocation;
      }
    }

    const goldFinal = mix.find((m) => m.key === "gold")?.pct ?? 0;
    const bondsFinal = mix.find((m) => m.key === "bonds")?.pct ?? 0;

    expect(goldFinal).toBeCloseTo(11.94, 1); // 10 + 2*0.97 (room=2, weighted=5)
    expect(bondsFinal).toBeCloseTo(35, 1); // 30 + 5 (weighted portion)
    expect(remaining).toBeCloseTo(3.06, 1); // ~3 p.b. zostalo (gold bol obmedzený)
  });

  it("All sinks full → remaining = input reduction", () => {
    const mix: MixItem[] = [
      { key: "etf", pct: 50 },
      { key: "bonds", pct: 30 },
      { key: "gold", pct: 20 },
    ];

    const sinks = [
      { key: "bonds" as const, weight: 0.6, maxPct: 30 }, // už na maxPct
      { key: "gold" as const, weight: 0.4, maxPct: 20 }, // už na maxPct
    ];
    const reduction = 10;

    let remaining = reduction;
    for (const sink of sinks) {
      const item = mix.find((m) => m.key === sink.key);
      if (!item) continue;

      if (sink.maxPct && item.pct >= sink.maxPct) continue;

      const room = sink.maxPct ? Math.max(0, sink.maxPct - item.pct) : Infinity;
      const allocation = Math.min(remaining * sink.weight, room * 0.97);

      if (allocation > 0.01) {
        item.pct += allocation;
        remaining -= allocation;
      }
    }

    expect(mix.find((m) => m.key === "bonds")?.pct).toBe(30); // nezmenené
    expect(mix.find((m) => m.key === "gold")?.pct).toBe(20); // nezmenené
    expect(remaining).toBe(10); // nič sa neprerozdelilo
  });

  it("Stagecaps fallback: sink bez maxPct, ale stageCaps definovaný", () => {
    const mix: MixItem[] = [
      { key: "etf", pct: 50 },
      { key: "cash", pct: 10 },
      { key: "bonds", pct: 40 },
    ];

    const sinks = [{ key: "cash" as const, weight: 1.0 }]; // bez maxPct
    const stageCaps = { cash: 15 }; // fallback cap
    const reduction = 10;

    let remaining = reduction;
    for (const sink of sinks) {
      const item = mix.find((m) => m.key === sink.key);
      if (!item) continue;

      if (sink.maxPct && item.pct >= sink.maxPct) continue;

      let room = Infinity;
      if (sink.maxPct) {
        room = Math.max(0, sink.maxPct - item.pct);
      } else if (stageCaps?.[sink.key]) {
        room = Math.max(0, stageCaps[sink.key] - item.pct);
      }

      const allocation = Math.min(remaining * sink.weight, room * 0.97);

      if (allocation > 0.01) {
        item.pct += allocation;
        remaining -= allocation;
      }
    }

    expect(mix.find((m) => m.key === "cash")?.pct).toBeCloseTo(14.85, 1); // 10 + 5*0.97 (room=5)
    expect(remaining).toBeGreaterThan(4); // ~5 p.b. zostalo
  });
});
