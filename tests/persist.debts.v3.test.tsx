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
    // Nový standalone debt section má button "Pridať prvý dlh"
    const addBtn = await screen.findByRole("button", {
      name: /Pridať prvý dlh/i,
    });
    fireEvent.click(addBtn);
    // fill first row
    const nameInput = screen.getByRole("textbox", { name: /Názov/i });
    fireEvent.change(nameInput, { target: { value: "Hypo-1" } });
    const bal = screen.getByRole("spinbutton", { name: /Zostatok/i });
    fireEvent.change(bal, { target: { value: "100000" } });
    const rate = screen.getByRole("spinbutton", { name: /Úrok p\.a\./i });
    fireEvent.change(rate, { target: { value: "5" } });
    // Presný aria-label (nie regex) aby sa odlíšil od Extra splátky
    const pay = screen.getByRole("spinbutton", { name: "Splátka dlhu 1" });
    fireEvent.change(pay, { target: { value: "400" } });
    // Nový label: "Zostáva rokov" (nie mesiacov)
    const rem = screen.getByRole("spinbutton", { name: /Zostáva rokov/i });
    fireEvent.change(rem, { target: { value: "20" } }); // 20 rokov = 240 mesiacov
    // Summary chips v novej implementácii (Počet dlhov, Celkové splátky)
    await waitFor(() => {
      expect(screen.getByText(/Počet dlhov:/)).toBeTruthy();
      expect(screen.getByText(/400 €\/mes\./)).toBeTruthy();
    });
    const d = readLS();
    expect(Array.isArray(d.debts)).toBe(true);
    expect(d.debts.length).toBe(1);
    expect(d.debts[0].name).toBe("Hypo-1");
  });
});
