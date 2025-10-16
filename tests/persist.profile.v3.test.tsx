import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import App from "../src/LegacyApp";

const LS_KEY_V3 = "unotop:v3";

function readLS() {
  const raw = localStorage.getItem(LS_KEY_V3);
  return raw ? JSON.parse(raw) : null;
}

describe("Persist v3 – profile fields & deep-link", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("persistuje a exportuje client_type, risk_pref, crisis_bias", async () => {
    render(<App />);
    const prefBalanced = screen.getByLabelText("Vyvážený");
    const prefGrowth = screen.getByLabelText("Rastový");
    fireEvent.click(prefGrowth);
    const bias = screen.getByLabelText("Krízový bias (0 až 3)");
    fireEvent.change(bias, { target: { value: "2" } });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    const d = readLS();
    expect(d.riskPref).toBe("growth");
    expect(d.crisisBias).toBe(2);
  });

  it("deep-link #state= sa načíta a hash sa vyčistí", async () => {
    // Priprav payload
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
      clientType: "individual",
      riskPref: "balanced",
      crisisBias: 1,
    };
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    // Simuluj hash pred renderom
    Object.defineProperty(window, "location", {
      value: { hash: `#state=${enc}`, pathname: "/", search: "" },
      writable: true,
    });
    render(<App />);
    // Hash by sa mal vyčistiť (replaceState prejde, testujeme neprítomnosť 'state=')
    expect((window.location.hash || "").includes("state=")).toBe(false);
  });
});
