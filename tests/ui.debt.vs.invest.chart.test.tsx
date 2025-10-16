import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/LegacyApp";

describe("Debt vs Invest chart", () => {
  it("renders when there is at least one hypotéka", async () => {
    // Seed one mortgage
    localStorage.setItem(
      "unotop_v1",
      JSON.stringify({
        debts: [
          {
            id: "m1",
            type: "hypoteka",
            name: "H1",
            balance: 10000,
            rate_pa: 0.04,
            monthly_payment: 180,
            months_remaining: 120,
          },
        ],
      })
    );
    render(<App />);
    // Legend labels should appear
    expect(await screen.findByText(/Zostatok hypotéky/i)).toBeTruthy();
    expect(await screen.findByText(/Hodnota portfólia/i)).toBeTruthy();
  });
});
