import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import AppClean from "../src/App.clean";

// Guard that TopHoldings render as badges (not white buttons), max 3

describe("TopHoldings badges", () => {
  it("renders <= 3 chips with secondary badge styles", async () => {
    render(<AppClean />);
    const chips = await screen.findAllByTestId("top-holding-chip");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length).toBeLessThanOrEqual(3);
    for (const chip of chips) {
      expect(chip.className).toContain("bg-slate-600/20");
      expect(chip.className).toContain("text-[11px]");
      expect(chip.getAttribute("role")).toBe("button");
      expect(chip.getAttribute("tabindex")).toBe("0");
    }
  });
});
