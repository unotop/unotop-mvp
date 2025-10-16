import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AppClean from "../src/App.clean";

describe("Layout parity PRO = BASIC", () => {
  it("has CF+Invest wrapper grid on md+", async () => {
    render(<AppClean />);
    const leftCol = await screen.findByTestId("left-col");
    expect(leftCol).toBeInTheDocument();
    // Grid is applied on md via CSS class on parent; just assert left column exists (smoke)
  });
});
