import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import AppClean from "../src/App.clean";

// Smoke-test that the KPI/Insights container includes the gradient class
// Keep it resilient: look for the KPI pill label first, then traverse up

describe("metrics card gradient", () => {
  it("applies gradient class around KPI pills", async () => {
    render(<AppClean />);
    const kpi = await screen.findByLabelText("KPI pás");
    const container = kpi.closest(".metrics-card-gradient");
    expect(container).toBeTruthy();
  });
});
