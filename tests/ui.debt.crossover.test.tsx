import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/LegacyApp";

describe("Debt vs Invest crossover note", () => {
  it("shows note about crossover when it happens", async () => {
    localStorage.setItem(
      "unotop_v1",
      JSON.stringify({
        debts: [
          {
            id: "m1",
            type: "hypoteka",
            name: "H1",
            balance: 1000,
            rate_pa: 0.02,
            monthly_payment: 50,
            months_remaining: 24,
          },
        ],
      })
    );
    render(<App />);
    const note = await screen.findByRole("note");
    expect(note.textContent || "").toMatch(
      /dosiahne portfólio hodnotu zostatku/
    );
  });

  it("shows negative note when crossover does not happen", async () => {
    localStorage.setItem(
      "unotop_v1",
      JSON.stringify({
        debts: [
          {
            id: "m1",
            type: "hypoteka",
            name: "H1",
            balance: 100000,
            rate_pa: 0.08,
            monthly_payment: 100,
            months_remaining: 360,
          },
        ],
      })
    );
    render(<App />);
    const note = await screen.findByRole("note");
    expect(note.textContent || "").toMatch(/nedosiahne zostatok/);
  });
});
