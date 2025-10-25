/**
 * warnings.integration.test.tsx
 * Integration tests for warning system in UI
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WarningCenter } from "../src/features/ui/warnings/WarningCenter";
import { WarningChips } from "../src/features/ui/warnings/WarningChips";
import { ToastStack } from "../src/features/ui/warnings/ToastStack";

describe("Warnings Integration", () => {
  beforeEach(() => {
    // Clear all warnings
    const all = WarningCenter.getAll();
    all.forEach((w) => WarningCenter.dismiss(w.id));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should display mix scope warning in WarningChips", async () => {
    render(<WarningChips />);

    // Push a mix warning
    WarningCenter.push({
      type: "warning",
      message: "Alokáciu gold sme znížili na 40% (max pre CORE fázu).",
      scope: "mix",
      dedupeKey: "gold-cap",
    });

    // Should appear in chips
    await waitFor(() => {
      expect(
        screen.getByText(/Alokáciu gold sme znížili/i)
      ).toBeInTheDocument();
    });
  });

  it("should display risk scope error in WarningChips", async () => {
    render(<WarningChips />);

    // Push a risk error
    WarningCenter.push({
      type: "error",
      message:
        "Riziko portfólia (7.8) presahuje adaptívny cap (7.5) pre LATE fázu.",
      scope: "risk",
      dedupeKey: "risk-cap",
    });

    // Should appear in chips with error styling
    await waitFor(() => {
      expect(
        screen.getByText(/Riziko portfólia.*presahuje/i)
      ).toBeInTheDocument();
    });
  });

  it("should display global scope info in ToastStack", async () => {
    render(<ToastStack />);

    // Push a global info
    WarningCenter.push({
      type: "info",
      message: "Pre správu dlhov prepnite do PRO režimu.",
      scope: "global",
      dedupeKey: "pro-mode-info",
    });

    // Should appear in toasts
    await waitFor(() => {
      expect(screen.getByText(/Pre správu dlhov/i)).toBeInTheDocument();
    });
  });

  it(
    "should auto-dismiss warnings after 6s",
    async () => {
      render(<WarningChips />);

      // Push a warning
      WarningCenter.push({
        type: "warning",
        message: "Test auto-dismiss",
        scope: "mix",
      });

      // Should appear
      await waitFor(() => {
        expect(screen.getByText("Test auto-dismiss")).toBeInTheDocument();
      });

      // Wait for auto-dismiss (6s + buffer)
      await waitFor(
        () => {
          expect(
            screen.queryByText("Test auto-dismiss")
          ).not.toBeInTheDocument();
        },
        { timeout: 7500 }
      );
    },
    { timeout: 10000 }
  );
});
