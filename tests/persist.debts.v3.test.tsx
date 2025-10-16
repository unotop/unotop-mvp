import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../src/LegacyApp";

const LS_KEY_V3 = "unotop:v3";

function readLS() {
  const raw = localStorage.getItem(LS_KEY_V3);
  return raw ? JSON.parse(raw) : null;
}

describe("Persist v3 – debts", () => {
  beforeEach(() => localStorage.clear());

  it("persists debts array with fields and appears in KPI chip", async () => {
    render(<App />);
    const addBtn = await screen.findByRole("button", { name: /Pridať dlh/i });
    fireEvent.click(addBtn);
    // fill first row
    const nameInput = screen.getByRole("textbox", { name: /Názov/i });
    fireEvent.change(nameInput, { target: { value: "Hypo-1" } });
    const bal = screen.getByRole("spinbutton", { name: /Zostatok/i });
    fireEvent.change(bal, { target: { value: "100000" } });
    const rate = screen.getByRole("spinbutton", { name: /Úrok p\.a\./i });
    fireEvent.change(rate, { target: { value: "5" } });
    const pay = screen.getByRole("spinbutton", { name: /Splátka/i });
    fireEvent.change(pay, { target: { value: "400" } });
    const rem = screen.getByRole("spinbutton", { name: /Zostáva mesiacov/i });
    fireEvent.change(rem, { target: { value: "240" } });
    // KPI chip should appear
    await waitFor(() => {
      expect(screen.getByText(/Dlhy: 1 \| Splátky: 400 €/)).toBeTruthy();
    });
    const d = readLS();
    expect(Array.isArray(d.debts)).toBe(true);
    expect(d.debts.length).toBe(1);
    expect(d.debts[0].name).toBe("Hypo-1");
  });
});
