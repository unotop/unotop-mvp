import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import AppClean from "../src/App.clean";

describe("Scenario chips styles and a11y", () => {
  it("chips have neutral badge styles; active is amber; others disabled", async () => {
    render(<AppClean />);
    const chipDrop = await screen.findByRole("button", { name: /−20 %/i });
    const chipBoost = await screen.findByRole("button", { name: /\+10 %/i });
    const chipInfl = await screen.findByRole("button", {
      name: /Inflácia 6 %/i,
    });

    // Neutral style
    for (const el of [chipDrop, chipBoost, chipInfl]) {
      expect(el.className).toContain("bg-slate-600/20");
      expect(el.className).toContain("border-slate-500/40");
      expect(el.getAttribute("aria-pressed")).toBe("false");
    }

    // Activate −20 %
    fireEvent.click(chipDrop);
    expect(chipDrop.className).toContain("bg-amber-600/20");
    expect(chipDrop.getAttribute("aria-pressed")).toBe("true");
    // Others disabled
    expect(chipBoost).toBeDisabled();
    expect(chipInfl).toBeDisabled();
  });
});
