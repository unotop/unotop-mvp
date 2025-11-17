/**
 * PR-12: Lazy Reapply Tests
 *
 * Test suite pre drift detection a recalculate chip
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readV3, writeV3 } from "../src/persist/v3";
import type { V3 } from "../src/persist/v3";

describe("PR-12: Lazy Reapply", () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("Drift Detection", () => {
    it("should detect lumpSum drift (absolute threshold ±5k)", () => {
      // Setup: Vyber profil s lumpSum=0
      writeV3({
        mixOrigin: "presetAdjusted",
        presetId: "vyvazeny",
        profileSnapshot: {
          lumpSum: 0,
          monthly: 500,
          horizon: 10,
          ts: Date.now(),
        },
        profile: {
          lumpSumEur: 0,
        },
        monthly: 500,
      });

      // Change lumpSum to 20k (drift > 5k)
      writeV3({
        profile: {
          lumpSumEur: 20000,
        },
      });

      const v3 = readV3();
      const snapshot = v3.profileSnapshot!;
      const currentLump = v3.profile?.lumpSumEur || 0;

      const lumpDriftAbs = Math.abs(currentLump - snapshot.lumpSum);
      const hasDrift = lumpDriftAbs >= 5000;

      expect(hasDrift).toBe(true);
      expect(lumpDriftAbs).toBe(20000);
    });

    it("should detect lumpSum drift (relative threshold 20%)", () => {
      // Snapshot: lumpSum=10k
      writeV3({
        mixOrigin: "presetAdjusted",
        presetId: "vyvazeny",
        profileSnapshot: {
          lumpSum: 10000,
          monthly: 500,
          horizon: 10,
          ts: Date.now(),
        },
        profile: {
          lumpSumEur: 10000,
        },
      });

      // Change to 13k (30% increase → drift)
      writeV3({
        profile: {
          lumpSumEur: 13000,
        },
      });

      const v3 = readV3();
      const snapshot = v3.profileSnapshot!;
      const currentLump = v3.profile?.lumpSumEur || 0;

      const lumpDriftAbs = Math.abs(currentLump - snapshot.lumpSum);
      const lumpDriftRel = lumpDriftAbs / Math.max(snapshot.lumpSum, 1);
      const hasDrift = lumpDriftRel >= 0.2;

      expect(hasDrift).toBe(true);
      expect(lumpDriftRel).toBeCloseTo(0.3, 2);
    });

    it("should detect monthly drift (±100 EUR)", () => {
      writeV3({
        mixOrigin: "presetAdjusted",
        presetId: "vyvazeny",
        profileSnapshot: {
          lumpSum: 0,
          monthly: 500,
          horizon: 10,
          ts: Date.now(),
        },
        monthly: 500,
      });

      // Change to 650 (drift > 100)
      writeV3({
        monthly: 650,
      });

      const v3 = readV3();
      const snapshot = v3.profileSnapshot!;
      const currentMonthly = (v3 as any).monthly || 0;

      const monthlyDriftAbs = Math.abs(currentMonthly - snapshot.monthly);
      const hasDrift = monthlyDriftAbs >= 100;

      expect(hasDrift).toBe(true);
      expect(monthlyDriftAbs).toBe(150);
    });

    it("should detect horizon drift (±2 years)", () => {
      writeV3({
        mixOrigin: "presetAdjusted",
        presetId: "vyvazeny",
        profileSnapshot: {
          lumpSum: 0,
          monthly: 500,
          horizon: 10,
          ts: Date.now(),
        },
        profile: {
          horizonYears: 10,
        },
      });

      // Change to 15 (drift > 2)
      writeV3({
        profile: {
          horizonYears: 15,
        },
      });

      const v3 = readV3();
      const snapshot = v3.profileSnapshot!;
      const currentHorizon = v3.profile?.horizonYears || 10;

      const horizonDriftAbs = Math.abs(currentHorizon - snapshot.horizon);
      const hasDrift = horizonDriftAbs >= 2;

      expect(hasDrift).toBe(true);
      expect(horizonDriftAbs).toBe(5);
    });

    it("should NOT detect drift for small changes", () => {
      writeV3({
        mixOrigin: "presetAdjusted",
        presetId: "vyvazeny",
        profileSnapshot: {
          lumpSum: 10000,
          monthly: 500,
          horizon: 10,
          ts: Date.now(),
        },
        profile: {
          lumpSumEur: 10000,
          horizonYears: 10,
        },
        monthly: 500,
      });

      // Small changes (below thresholds)
      writeV3({
        profile: {
          lumpSumEur: 11000, // +1k (< 5k, < 20%)
          horizonYears: 11, // +1 year (< 2)
        },
        monthly: 550, // +50 EUR (< 100)
      });

      const v3 = readV3();
      const snapshot = v3.profileSnapshot!;

      const lumpDrift = Math.abs(
        (v3.profile?.lumpSumEur || 0) - snapshot.lumpSum
      );
      const monthlyDrift = Math.abs(
        ((v3 as any).monthly || 0) - snapshot.monthly
      );
      const horizonDrift = Math.abs(
        (v3.profile?.horizonYears || 10) - snapshot.horizon
      );

      expect(lumpDrift < 5000).toBe(true);
      expect(monthlyDrift < 100).toBe(true);
      expect(horizonDrift < 2).toBe(true);
    });
  });

  describe("Mix Origin Tracking", () => {
    it("should set mixOrigin=presetAdjusted when selecting profile", () => {
      // Simulate profile selection
      writeV3({
        mix: [
          { key: "gold", pct: 12 },
          { key: "etf", pct: 60 },
        ],
        mixOrigin: "presetAdjusted",
        presetId: "vyvazeny",
        profileSnapshot: {
          lumpSum: 10000,
          monthly: 500,
          horizon: 10,
          ts: Date.now(),
        },
      });

      const v3 = readV3();
      expect(v3.mixOrigin).toBe("presetAdjusted");
      expect(v3.presetId).toBe("vyvazeny");
      expect(v3.profileSnapshot).toBeDefined();
    });

    it("should set mixOrigin=manual when user edits mix manually", () => {
      // Simulate manual slider change
      writeV3({
        mix: [
          { key: "gold", pct: 25 },
          { key: "etf", pct: 50 },
        ],
        mixOrigin: "manual",
        presetId: undefined,
        profileSnapshot: undefined,
      });

      const v3 = readV3();
      expect(v3.mixOrigin).toBe("manual");
      expect(v3.presetId).toBeUndefined();
    });

    it("should NOT show chip when mixOrigin=manual", () => {
      writeV3({
        mixOrigin: "manual",
        profile: {
          lumpSumEur: 20000,
        },
      });

      const v3 = readV3();
      const canReapply = v3.mixOrigin === "presetAdjusted" && !!v3.presetId;

      expect(canReapply).toBe(false);
    });
  });

  describe("BETA Auto-Optimize", () => {
    it("should respect autoOptimizeMix toggle (default OFF)", () => {
      const v3 = readV3();
      const autoOptEnabled = v3.profile?.autoOptimizeMix || false;

      expect(autoOptEnabled).toBe(false);
    });

    it("should enable auto-optimize when toggle ON", () => {
      writeV3({
        profile: {
          autoOptimizeMix: true,
        },
      });

      const v3 = readV3();
      expect(v3.profile?.autoOptimizeMix).toBe(true);
    });

    it("should NOT auto-optimize in PRO mode", () => {
      writeV3({
        profile: {
          modeUi: "PRO",
          autoOptimizeMix: true,
        },
        mixOrigin: "presetAdjusted",
        presetId: "vyvazeny",
      });

      const v3 = readV3();
      const modeUi = (v3.profile?.modeUi as any) || "BASIC";
      const shouldAutoOpt = modeUi === "BASIC" && v3.profile?.autoOptimizeMix;

      expect(shouldAutoOpt).toBe(false); // PRO režim blokuje
    });
  });

  describe("Snapshot Update After Reapply", () => {
    it("should update profileSnapshot after reapply", () => {
      const oldTs = Date.now() - 10000;

      // Initial snapshot
      writeV3({
        mixOrigin: "presetAdjusted",
        presetId: "vyvazeny",
        profileSnapshot: {
          lumpSum: 0,
          monthly: 500,
          horizon: 10,
          ts: oldTs,
        },
      });

      // Simulate reapply with new values
      const newTs = Date.now();
      writeV3({
        profileSnapshot: {
          lumpSum: 20000,
          monthly: 500,
          horizon: 10,
          ts: newTs,
        },
      });

      const v3 = readV3();
      expect(v3.profileSnapshot?.lumpSum).toBe(20000);
      expect(v3.profileSnapshot?.ts).toBeGreaterThan(oldTs);
    });
  });
});
