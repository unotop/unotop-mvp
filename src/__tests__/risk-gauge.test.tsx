import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskGauge } from "../components/RiskGauge";

// Helper to count svg children by predicate
function count(el: HTMLElement | null, selector: string) {
  if (!el) return 0;
  return el.querySelectorAll(selector).length;
}

describe("RiskGauge", () => {
  it("renders meter role with correct aria-valuenow", () => {
    render(<RiskGauge value={6.42} />);
    const meter = screen.getByRole("meter", { name: /Riziko portfólia/i });
    expect(meter).toHaveAttribute("aria-valuenow", "6.42");
  });

  it("has track + 6 segment paths (ignoring clipPath helper path)", () => {
    render(<RiskGauge value={3} />);
    const svg = screen.getByRole("meter").querySelector("svg");
    expect(svg).toBeTruthy();
    // Filter visible painted paths (stroke not white used for clip)
    const visible = Array.from(svg!.querySelectorAll("path")).filter(
      (p) => p.getAttribute("stroke") !== "white"
    );
    // 1 track + 6 segments = 7 visible
    expect(visible.length).toBe(7);
  });

  it("threshold tick/dot respect show props and value > threshold logic", () => {
    const { rerender } = render(
      <RiskGauge
        value={7.49}
        threshold={7.5}
        showThresholdTick
        showThresholdDot
      />
    );
    let tickGroup = screen.getByTestId("risk-threshold");
    expect(tickGroup.querySelector("line")).toBeTruthy();
    expect(screen.queryByTestId("risk-threshold-dot")).toBeNull();
    rerender(
      <RiskGauge
        value={7.5}
        threshold={7.5}
        showThresholdTick
        showThresholdDot
      />
    );
    expect(screen.queryByTestId("risk-threshold-dot")).toBeNull();
    rerender(
      <RiskGauge
        value={7.51}
        threshold={7.5}
        showThresholdTick
        showThresholdDot
      />
    );
    expect(screen.getByTestId("risk-threshold-dot")).toBeInTheDocument();
    // Disable tick entirely
    rerender(<RiskGauge value={8} threshold={7.5} showThresholdTick={false} />);
    expect(screen.queryByTestId("risk-threshold")).toBeNull();
  });

  it("needle rotates (has transform style) and single polygon", () => {
    render(<RiskGauge value={5.3} />);
    const needle = screen.getByTestId("risk-needle");
    const poly = needle.querySelector("polygon");
    expect(poly).toBeTruthy();
    expect(needle.getAttribute("style")).toMatch(/rotate/);
  });

  it("aria-live only triggers on >0.1 delta", () => {
    const { rerender } = render(<RiskGauge value={4.0} />);
    const detail = screen.getByText(/Riziko:/i);
    // First render may or may not have aria-live; we only assert behavior on rerenders
    rerender(<RiskGauge value={4.05} />);
    expect(detail.getAttribute("aria-live")).toBeNull();
    rerender(<RiskGauge value={4.2} />);
    // The element is re-created; re-query
    const detail2 = screen.getByText(/Riziko:\s*4\.20/);
    expect(detail2.getAttribute("aria-live")).toBe("polite");
  });
});
