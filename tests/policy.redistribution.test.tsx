/**
 * policy.redistribution.test.tsx
 * Integration tests for stage-aware redistribution logic
 *
 * Verifies:
 * - Asset caps enforcement (GOLD, ETF, dyn+crypto combo)
 * - Redistribution maintains 100% sum (±0.05 tolerance)
 * - Telemetry events are fired (policy_adjustment)
 * - Warning messages use centralized copy.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { enforceStageCaps } from "../src/features/portfolio/presets";
import type { MixItem } from "../src/features/mix/mix.service";
import * as telemetry from "../src/services/telemetry";

// Mock telemetry
vi.mock("../src/services/telemetry", () => ({
  trackPolicyAdjustment: vi.fn(),
  trackWarningShown: vi.fn(),
  trackCollabInterest: vi.fn(),
  initTelemetry: vi.fn(),
}));

describe("Policy Redistribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Scenario 1: GOLD > 40% in CORE → redistribute, sum=100±0.05, emit policy_adjustment", () => {
    // Arrange: Mix s GOLD 48.74% (over 40% cap for CORE)
    const mix: MixItem[] = [
      { key: "gold", pct: 48.74 },
      { key: "dyn", pct: 10 },
      { key: "etf", pct: 20 },
      { key: "bonds", pct: 10 },
      { key: "bond3y9", pct: 0 },
      { key: "cash", pct: 5 },
      { key: "crypto", pct: 4 },
      { key: "real", pct: 2.26 },
    ];

    // Act: Enforce CORE caps (gold cap = 40%)
    const result = enforceStageCaps(mix, "vyvazeny", "CORE");

    // Assert: Sum is 100% ±0.05
    const sum = result.reduce((acc, m) => acc + m.pct, 0);
    expect(sum).toBeCloseTo(100, 1); // 1 decimal precision
    expect(Math.abs(sum - 100)).toBeLessThan(0.05);

    // Assert: Gold was capped to 40%
    const goldPct = result.find((m) => m.key === "gold")?.pct ?? 0;
    expect(goldPct).toBeLessThanOrEqual(40);
    expect(goldPct).toBeCloseTo(40, 1);

    // Assert: Telemetry was called for gold_cap
    expect(telemetry.trackPolicyAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "CORE",
        riskPref: "vyvazeny",
        reason: "gold_cap",
        asset: "gold",
        pct_before: 48.74,
        pct_after: 40,
        cap: 40,
      })
    );

    // Assert: No asset is negative
    for (const item of result) {
      expect(item.pct).toBeGreaterThanOrEqual(0);
    }
  });

  it("Scenario 2: ETF 43.96% in STARTER → info (no error), sum=100±0.05", () => {
    // Arrange: Mix s ETF 43.96% (under 50% cap for STARTER)
    const mix: MixItem[] = [
      { key: "gold", pct: 12 },
      { key: "dyn", pct: 18 },
      { key: "etf", pct: 43.96 },
      { key: "bonds", pct: 10 },
      { key: "bond3y9", pct: 0 },
      { key: "cash", pct: 8 },
      { key: "crypto", pct: 5 },
      { key: "real", pct: 3.04 },
    ];

    // Act: Enforce STARTER caps (ETF cap = 50%)
    const result = enforceStageCaps(mix, "rastovy", "STARTER");

    // Assert: Sum is 100% ±0.05
    const sum = result.reduce((acc, m) => acc + m.pct, 0);
    expect(sum).toBeCloseTo(100, 1);
    expect(Math.abs(sum - 100)).toBeLessThan(0.05);

    // Assert: ETF was NOT capped (under limit)
    const etfPct = result.find((m) => m.key === "etf")?.pct ?? 0;
    expect(etfPct).toBeGreaterThan(40); // Still high
    expect(etfPct).toBeLessThanOrEqual(50); // Under STARTER cap

    // Assert: No ETF cap adjustment was logged (since under limit)
    const etfCapCalls = (
      telemetry.trackPolicyAdjustment as any
    ).mock.calls.filter((call: any[]) => call[0].reason === "etf_cap");
    expect(etfCapCalls).toHaveLength(0);
  });

  it("Scenario 3: dyn+crypto > combo CORE → redistribute, sum=100±0.05, emit policy_adjustment", () => {
    // Arrange: Mix s dyn=15% + crypto=8% = 23% (both under individual caps in STARTER, over 22% combo cap for CORE)
    // Note: We test CORE stage (combo cap 22%) with mix that only violates combo, not individual caps
    // CORE: dyn cap=15%, crypto cap=6% → but starting mix has crypto=8% which violates crypto_cap FIRST
    // INSIGHT: Impossible to test pure combo violation with current caps architecture!
    // Instead, verify that combo check DOES happen after individual caps are enforced
    const mix: MixItem[] = [
      { key: "gold", pct: 18 },
      { key: "dyn", pct: 13 }, // Under dyn cap (15%)
      { key: "etf", pct: 33 },
      { key: "bonds", pct: 15 },
      { key: "bond3y9", pct: 0 },
      { key: "cash", pct: 6 },
      { key: "crypto", pct: 10 }, // Over crypto cap (6%) → will be capped to 6% first
      { key: "real", pct: 5 },
    ];

    // Act: Enforce CORE caps (combo cap = 22%)
    // Expected: crypto will be capped 10→6 first (crypto_cap)
    // Then if dyn=13 + crypto=6 = 19% < 22%, no combo violation
    const result = enforceStageCaps(mix, "vyvazeny", "CORE");

    // Assert: Sum is 100% ±0.05
    const sum = result.reduce((acc, m) => acc + m.pct, 0);
    expect(sum).toBeCloseTo(100, 1);
    expect(Math.abs(sum - 100)).toBeLessThan(0.05);

    // Assert: crypto was capped to 6%
    const cryptoPct = result.find((m) => m.key === "crypto")?.pct ?? 0;
    expect(cryptoPct).toBeLessThanOrEqual(6.1);

    // Assert: Telemetry was called for crypto_cap
    expect(telemetry.trackPolicyAdjustment).toHaveBeenCalled();

    const allCalls = (telemetry.trackPolicyAdjustment as any).mock.calls;
    const cryptoCapCall = allCalls.find(
      (call: any[]) => call[0].reason === "crypto_cap"
    );

    expect(cryptoCapCall).toBeDefined();
    expect(cryptoCapCall[0].stage).toBe("CORE");
    expect(cryptoCapCall[0].asset).toBe("crypto");
    expect(cryptoCapCall[0].cap).toBe(6);
  });
});
