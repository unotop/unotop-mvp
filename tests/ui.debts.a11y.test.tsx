import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../src/LegacyApp";

describe("A11y – Debts UI", () => {
  it("section is a region with labelledby; table has role=table with label", () => {
    render(<App />);
    const sec = screen.getByRole("region", { name: /Dlhy .* hypotéky/i });
    expect(sec).toBeTruthy();

    // Pridaj dlh aby sa zobrazila tabuľka
    const addBtn = screen.getByRole("button", { name: /Pridať.*dlh/i });
    fireEvent.click(addBtn);

    const table = screen.getByRole("table", { name: /Tabuľka dlhov/i });
    expect(table).toBeTruthy();
    // Header cells should have scope="col"
    const headers = table.querySelectorAll("thead th");
    expect(headers.length).toBeGreaterThan(0);
    headers.forEach((h) => expect(h.getAttribute("scope")).toBe("col"));
  });

  it("add/remove debt rows are accessible", async () => {
    render(<App />);

    // Počkaj na debt section (musí byť expanded)
    const sec = await screen.findByRole("region", { name: /Dlhy.*hypotéky/i });
    expect(sec).toBeTruthy();

    // Teraz nájdi button v section
    const add = await screen.findByRole(
      "button",
      { name: /Pridať.*dlh/i },
      { timeout: 3000 }
    );
    fireEvent.click(add);

    // Použi getAllByRole lebo môže byť viac delete buttonov
    const deleteBtns = await screen.findAllByRole("button", {
      name: /Zmazať/i,
    });
    expect(deleteBtns[0]).toBeTruthy();
  });
});
