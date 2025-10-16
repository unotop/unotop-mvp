import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AppClean from "../src/App.clean";

describe("Metrics header gradient", () => {
  it("has gradient class on metrics header", async () => {
    render(<AppClean />);
    const headerBtn = await screen.findByLabelText(
      /4\) Metriky & odporúčania/i
    );
    // The parent container should carry the gradient class via SectionHeader.className
    const headerEl = headerBtn.closest("div");
    expect(headerEl?.className || "").toMatch(/metrics-head-gradient/);
  });
});
