import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../src/LegacyApp";

describe("A11y – Debts UI", () => {
  it("section is a region with labelledby; table has role=table with label", () => {
    render(<App />);
    const sec = screen.getByRole("region", { name: /Dlhy .* hypotéky/i });
    expect(sec).toBeTruthy();
    const table = screen.getByRole("table", { name: /Tabuľka dlhov/i });
    expect(table).toBeTruthy();
    // Header cells should have scope="col"
    const headers = table.querySelectorAll("thead th");
    expect(headers.length).toBeGreaterThan(0);
    headers.forEach((h) => expect(h.getAttribute("scope")).toBe("col"));
  });

  it("add/remove debt rows are accessible", () => {
    render(<App />);
    const add = screen.getByRole("button", { name: /Pridať dlh/i });
    fireEvent.click(add);
    const deleteBtn = screen.getByRole("button", { name: /Zmazať/i });
    expect(deleteBtn).toBeTruthy();
  });
});
