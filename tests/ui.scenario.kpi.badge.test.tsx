import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import AppClean from "../src/App.clean";

describe("Scenario KPI badge (dock removed)", () => {
  it("badge sa nezobrazuje", async () => {
    render(<AppClean />);
    // Initially no badge
    expect(screen.queryByTestId("scenario-kpi-badge")).toBeNull();

    // Aktivácia scenáru už badge nepridá (dock je odstránený)
    const chipDrop = await screen.findByRole("button", { name: /−20 %/i });
    fireEvent.click(chipDrop);
    expect(screen.queryByTestId("scenario-kpi-badge")).toBeNull();
  });
});
