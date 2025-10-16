import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import AppClean from "../src/App.clean";

describe("Scenario chips cancel behavior", () => {
  it("clicking active chip cancels immediately and aria-pressed resets", async () => {
    render(<AppClean />);
    const chipDrop = await screen.findByRole("button", { name: /−20 %/i });
    fireEvent.click(chipDrop);
    // Now active
    expect(chipDrop.getAttribute("aria-pressed")).toBe("true");
    // Click again to toggle off
    fireEvent.click(chipDrop);
    expect(chipDrop.getAttribute("aria-pressed")).toBe("false");
    // Badge hidden
    expect(
      screen.queryByRole("status", { name: /Scenár aktívny/i })
    ).toBeNull();
  });
});
