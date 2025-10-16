import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, fireEvent, act, screen } from "@testing-library/react";
import App from "../src/LegacyApp";

const LS_KEY_V3 = "unotop:v3";

function readLS() {
  const raw = localStorage.getItem(LS_KEY_V3);
  return raw ? JSON.parse(raw) : null;
}

describe("persistence roundtrip v3", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists v3 shape with renamed labels/fields", async () => {
    render(<App />);
    const q = (re: RegExp) =>
      screen.getByRole("textbox", { name: re }) as HTMLInputElement;
    fireEvent.change(q(/Mesačný príjem/), { target: { value: "2500" } });
    fireEvent.change(q(/Fixné výdavky/), { target: { value: "900" } });
    fireEvent.change(q(/Variabilné výdavky/), { target: { value: "400" } });
    fireEvent.change(q(/Súčasná rezerva/), { target: { value: "1200" } });
    fireEvent.change(q(/Rezerva \(mesiace\)/), { target: { value: "8" } });
    fireEvent.change(q(/Jednorazová investícia/), {
      target: { value: "3500" },
    });
    fireEvent.change(q(/Mesačný vklad/), { target: { value: "300" } });
    fireEvent.change(q(/Horizont \(roky\)/), { target: { value: "9" } });
    fireEvent.change(q(/Cieľ majetku/), { target: { value: "75000" } });

    await act(async () => {
      vi.advanceTimersByTime(500); // debounce + baseline capture flush
    });

    const saved = readLS();
    expect(saved).toBeTruthy();
    expect(saved.version).toBe(3);
    expect(saved.monthlyIncome).toBe(2500);
    expect(saved.fixedExpenses).toBe(900);
    expect(saved.variableExpenses).toBe(400);
    expect(saved.current_reserve).toBe(1200);
    expect(saved.emergency_months).toBe(8);
    expect(saved.lumpSum).toBe(3500);
    expect(saved.monthlyContrib).toBe(300);
    expect(saved.horizon).toBe(9);
    expect(saved.goal_asset).toBe(75000);
    // legacy removed
    expect(saved.target).toBeUndefined();
    expect(saved.goal).toBeUndefined();
  });
});
