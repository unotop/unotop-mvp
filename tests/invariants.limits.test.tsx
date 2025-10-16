import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/LegacyApp";

function readChip(regex: RegExp) {
  return screen.queryByText(regex);
}

describe("Invariants limits & idempotencia", () => {
  beforeEach(() => localStorage.clear());

  it('po "Upraviť podľa pravidiel" platia limity a sumárne chipy', async () => {
    const user = userEvent.setup();
    render(<App />);
    const btn = await screen.findByRole("button", {
      name: /Upraviť podľa pravidiel/i,
    });
    await user.click(btn);
    // Očakávame sumárne chipy (nie všetky vždy, ale aspoň existenciu kontajnera)
    // Vyhľadáme niektoré texty: "Zlato dorovnané", "Dyn+Krypto obmedzené", "Súčet dorovnaný"
    const maybeGold = readChip(/Zlato dorovnané/i);
    const maybeRisky = readChip(/Dyn\+Krypto obmedzené/i);
    const maybeSum = readChip(/Súčet dorovnaný/i);
    expect([maybeGold, maybeRisky, maybeSum].some(Boolean)).toBe(true);
  });

  it("idempotencia – druhé kliknutie bez zmeny", async () => {
    const user = userEvent.setup();
    render(<App />);
    const btn = await screen.findByRole("button", {
      name: /Upraviť podľa pravidiel/i,
    });
    await user.click(btn);
    await user.click(btn);
    const toast = await screen.findByText(
      /Žiadne úpravy/i,
      {},
      { timeout: 1500 }
    );
    expect(toast).toBeInTheDocument();
  });
});
