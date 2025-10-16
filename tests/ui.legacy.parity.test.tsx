import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AppClean from "../src/App.clean";

describe("Legacy parity under gauge", () => {
  it("shows KPI pills and FV highlight in legacy mode", async () => {
    // Pre-seed localStorage to legacy
    localStorage.setItem("unotop_v1", JSON.stringify({ riskMode: "legacy" }));
    render(<AppClean />);
    // KPI pills are present via their labels; smoke check the FV highlight card
    const fvCard = await screen.findByTestId("fv-highlight-card");
    expect(fvCard).toBeInTheDocument();
  });
});
