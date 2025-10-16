import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AppClean from "../src/App.clean";

describe("FVHighlightCard", () => {
  it("renders big FV and progress", async () => {
    render(<AppClean />);
    const card = await screen.findByTestId("fv-highlight-card");
    expect(card).toBeInTheDocument();
    const progress = screen.getByTestId("fv-progress");
    expect(progress).toHaveAttribute("role", "progressbar");
  });
});
