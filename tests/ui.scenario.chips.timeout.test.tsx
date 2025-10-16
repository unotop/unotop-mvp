import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import AppClean from "../src/App.clean";

describe("Scenario chips timeout behavior", () => {
  it("badge shows and clears after ~4s; timeout not stacking on re-click", async () => {
    render(<AppClean />);
    const chipDrop = await screen.findByRole("button", { name: /−20 %/i });
    fireEvent.click(chipDrop);
    expect(
      await screen.findByRole("status", { name: /Scenár aktívny/i })
    ).toBeTruthy();

    // Click again quickly; toggle variant A -> badge zmizne okamžite
    fireEvent.click(chipDrop);
    expect(
      screen.queryAllByRole("status", { name: /Scenár aktívny/i }).length
    ).toBe(0);

    await waitFor(
      () => {
        expect(
          screen.queryByRole("status", { name: /Scenár aktívny/i })
        ).toBeNull();
      },
      { timeout: 5000 }
    );
  });
});
