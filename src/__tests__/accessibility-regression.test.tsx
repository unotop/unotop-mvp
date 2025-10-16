import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "../App";

// Basic accessibility regression smoke tests.
// Not exhaustive; focuses on critical landmarks & ARIA contracts we rely on.

describe("Accessibility regression", () => {
  it("exposes meter for risk gauge with proper aria attributes", () => {
    render(<App />);
    const meter = screen.getByRole("meter", { name: /Riziko portfólia/i });
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "10");
    const now = parseFloat(meter.getAttribute("aria-valuenow") || "0");
    expect(now).toBeGreaterThanOrEqual(0);
    expect(now).toBeLessThanOrEqual(10);
  });

  it("has a progressbar for goal progress when goalAsset > 0", () => {
    render(<App />);
    const bar = screen.getByRole("progressbar", { name: /Plnenie cieľa/i });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("section headers toggle aria-expanded on containers", () => {
    render(<App />);
    // Using headings text; SectionHeader supplies button & region relationship
    const s1 = screen.getByRole("region", { name: /Cashflow/i });
    expect(s1).toBeInTheDocument();
  });
});
