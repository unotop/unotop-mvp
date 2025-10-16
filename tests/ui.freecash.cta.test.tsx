import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import App from "../src/LegacyApp";

// This test focuses on the DOM behavior, not exact amounts.

describe("FreeCashCard CTA behavior", () => {
  it("sets monthly contribution and focuses slider", async () => {
    render(<App />);
    // Find the CTA button by its aria-label prefix
    const btn = await screen.findByRole("button", {
      name: /Nastaviť mesačný vklad na/i,
    });
    fireEvent.click(btn);
    // After click, the monthly contribution slider should be focusable
    const slider = await screen.findByLabelText("Mesačný vklad – slider");
    expect(slider).toHaveFocus();
  });
});
