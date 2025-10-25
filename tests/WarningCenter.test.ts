/**
 * WarningCenter.test.ts
 * Unit tests for WarningCenter singleton
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { WarningCenter } from "../src/features/ui/warnings/WarningCenter";

describe("WarningCenter", () => {
  beforeEach(() => {
    // Clear all warnings before each test
    const all = WarningCenter.getAll();
    all.forEach((w) => WarningCenter.dismiss(w.id));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should dedupe warnings with same dedupeKey within 5s window", () => {
    vi.useFakeTimers();

    // Push first warning
    WarningCenter.push({
      type: "warning",
      message: "Rate limit triggered",
      scope: "global",
      dedupeKey: "rate-limit",
    });

    let all = WarningCenter.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].message).toBe("Rate limit triggered");

    // Push duplicate within 5s → should be ignored
    WarningCenter.push({
      type: "warning",
      message: "Rate limit triggered again",
      scope: "global",
      dedupeKey: "rate-limit",
    });

    all = WarningCenter.getAll();
    expect(all).toHaveLength(1); // Still only 1 warning
    expect(all[0].message).toBe("Rate limit triggered"); // Original message

    // Fast-forward 6 seconds (past dedupe window)
    vi.advanceTimersByTime(6000);

    // Push again → should create new warning (dedupe expired)
    WarningCenter.push({
      type: "warning",
      message: "Rate limit triggered third time",
      scope: "global",
      dedupeKey: "rate-limit",
    });

    all = WarningCenter.getAll();
    expect(all).toHaveLength(1); // First auto-dismissed, second created
    expect(all[0].message).toBe("Rate limit triggered third time");

    vi.useRealTimers();
  });

  it("should auto-dismiss warnings after 6s", () => {
    vi.useFakeTimers();

    // Push warning
    WarningCenter.push({
      type: "info",
      message: "Test warning",
      scope: "mix",
    });

    let all = WarningCenter.getAll();
    expect(all).toHaveLength(1);

    // Fast-forward 5s → warning still present
    vi.advanceTimersByTime(5000);
    all = WarningCenter.getAll();
    expect(all).toHaveLength(1);

    // Fast-forward another 2s (total 7s) → warning auto-dismissed
    vi.advanceTimersByTime(2000);
    all = WarningCenter.getAll();
    expect(all).toHaveLength(0);

    vi.useRealTimers();
  });
});
