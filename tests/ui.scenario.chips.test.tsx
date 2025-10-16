import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import AppClean from "../src/App.clean";

describe("Scenario chips (visual-only)", () => {
  it("activates and auto-expires", async () => {
    render(<AppClean />);
    // Click the −20 % chip
    const chip = await screen.findByRole("button", { name: /−20 %/i });
    fireEvent.click(chip);
    // Badge appears
    expect(
      await screen.findByRole("status", { name: /Scenár aktívny/i })
    ).toBeTruthy();
    // Note appears
    expect(await screen.findByRole("note")).toHaveTextContent("−20 %");
    // After ~4s it should disappear
    await waitFor(
      () => {
        expect(
          screen.queryByRole("status", { name: /Scenár aktívny/i })
        ).toBeNull();
        expect(screen.queryByRole("note")).toBeNull();
      },
      { timeout: 5000 }
    );
  });
});
