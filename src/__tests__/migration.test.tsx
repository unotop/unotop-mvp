import { screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { renderAppWithLocalStorage, numericValue } from "../test/testUtils";

// POZOR: Skeleton – očakávania budú doplnené po stabilizácii labelov / textu.

describe("Migrácia storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migruje target -> goal_asset", async () => {
    const targetValue = 123456;
    renderAppWithLocalStorage({
      v2: {
        target: targetValue,
        mix: {
          "Zlato (fyzické)": 10,
          "Dynamické riadenie": 10,
          "Krypto (BTC/ETH)": 5,
        },
      },
    });
    const goalField = await screen.findByLabelText(/Cieľ majetku/i);
    expect(goalField).toBeInTheDocument();
    expect(numericValue(goalField)).toBe(targetValue);
  });

  it("preferuje goal_asset pred target", async () => {
    renderAppWithLocalStorage({ v2: { goal_asset: 90000, target: 50000 } });
    const goalField = await screen.findByLabelText(/Cieľ majetku/i);
    expect(goalField).toBeInTheDocument();
    expect(numericValue(goalField)).toBe(90000);
  });

  it("skryje plnenie pri goal = 0", async () => {
    renderAppWithLocalStorage({ v2: { goal_asset: 0 } });
    await screen.findByLabelText(/Cieľ majetku/i);
    expect(screen.queryByText(/Plnenie/i)).toBeNull();
  });
});
