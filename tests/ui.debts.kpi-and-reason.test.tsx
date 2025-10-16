import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../src/LegacyApp";

describe("Debts – KPI and reason line", () => {
  it("shows KPI chip with formatted euro sum", async () => {
    render(<App />);
    const add = await screen.findByRole("button", { name: /Pridať dlh/i });
    fireEvent.click(add);
    const pay = screen.getByRole("spinbutton", { name: /Mesačná splátka/i });
    fireEvent.change(pay, { target: { value: "1234" } });
    await waitFor(() => {
      expect(screen.getByText(/Mesačné splátky spolu:/i)).toBeTruthy();
      // Should include formatted euro with thousands e.g., 1 234,00 € or 1 234 € depending on digits
      const chip = screen.getByText(/Mesačné splátky spolu:/i)
        .parentElement as HTMLElement;
      expect(chip.textContent || "").toMatch(/€|EUR/);
    });
  });

  it("shows reason line under verdict", async () => {
    render(<App />);
    const add = await screen.findByRole("button", { name: /Pridať dlh/i });
    fireEvent.click(add);
    fireEvent.change(screen.getByRole("spinbutton", { name: /Istina/i }), {
      target: { value: "50000" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /Úrok p\.a\./i }), {
      target: { value: "5" },
    });
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /Mesačná splátka/i }),
      { target: { value: "300" } }
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /Zostáva \(mesiace\)/i }),
      { target: { value: "240" } }
    );
    // Reason line should render regardless of extraMonthly
    await waitFor(() => {
      const reason = screen.getByText(
        /Dôvod: úrok .* vs\. oč\. výnos − 2 p\.b\./i
      );
      expect(reason).toBeTruthy();
    });
  });
});
