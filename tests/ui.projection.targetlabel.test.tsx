import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import AppClean from "../src/App.clean";

describe("Projection target label", () => {
  it("renders 'Cieľ majetku' label in the DOM when goal > 0", async () => {
    render(<AppClean />);
    // The label is part of the chart overlay, ensure its text is present.
    // We look for the exact Slovak text used in the chart label.
    const label = await screen.findByText(/Cieľ majetku/i);
    expect(label).toBeTruthy();
  });
});
