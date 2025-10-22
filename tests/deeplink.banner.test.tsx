import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import App from "../src/LegacyApp";

function encState(payload: any) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

describe("Deep-link banner", () => {
  beforeEach(() => {
    localStorage.clear();
    // Fake timers removed: banner now renders synchronously on initial paint.
  });

  it("shows on #state= load, can be closed, and does not show on reload without hash", async () => {
    const payload = {
      version: 3,
      monthlyIncome: 2000,
      fixedExpenses: 800,
      variableExpenses: 300,
      current_reserve: 0,
      emergency_months: 6,
      lumpSum: 1000,
      monthlyContrib: 200,
      horizon: 5,
      goal_asset: 20000,
      mix: {
        "Zlato (fyzické)": 10,
        "Dynamické riadenie": 10,
        "Krypto (BTC/ETH)": 5,
        "Hotovosť/rezerva": 75,
      },
      uiMode: "basic",
      riskMode: "legacy",
    };
    const enc = encState(payload);

    // Simulate initial load with hash
    Object.defineProperty(window, "location", {
      value: { hash: `#state=${enc}`, pathname: "/", search: "" },
      writable: true,
    });
    render(<App />);
    // Banner visible (synchronous)
    expect(
      screen.getByText(/Konfigurácia načítaná zo zdieľaného linku\./i)
    ).toBeTruthy();
    // Close via X
    fireEvent.click(screen.getByRole("button", { name: /Zavrieť oznámenie/i }));
    expect(
      screen.queryByText(/Konfigurácia načítaná zo zdieľaného linku\./i)
    ).toBeNull();

    // Reload without hash
    Object.defineProperty(window, "location", {
      value: { hash: "", pathname: "/", search: "" },
      writable: true,
    });
    render(<App />);
    expect(
      screen.queryByText(/Konfigurácia načítaná zo zdieľaného linku\./i)
    ).toBeNull();
  });
});
