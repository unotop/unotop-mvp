import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../src/LegacyApp";

describe("Debts – KPI and reason line", () => {
  it("shows KPI chip with formatted euro sum", async () => {
    render(<App />);
    
    // Počkaj na debt section
    await screen.findByRole("region", { name: /Dlhy.*hypotéky/i });
    
    const add = await screen.findByRole("button", { name: /Pridať.*dlh/i }, { timeout: 3000 });
    fireEvent.click(add);
    
    // Použi getAllByRole a vyber prvý debt row
    const pays = screen.getAllByRole("spinbutton", { name: /Splátka dlhu/i });
    fireEvent.change(pays[0], { target: { value: "1234" } });
    
    await waitFor(() => {
      expect(screen.getByText(/Mesačné splátky spolu:|Celkové splátky:/i)).toBeTruthy();
      // Should include formatted euro with thousands e.g., 1 234,00 € or 1 234 € depending on digits
      const chip = screen.getByText(/Mesačné splátky spolu:|Celkové splátky:/i)
        .parentElement as HTMLElement;
      expect(chip.textContent || "").toMatch(/€|EUR/);
    });
  });

  it("shows reason line under verdict", async () => {
    render(<App />);
    
    // Počkaj na debt section
    await screen.findByRole("region", { name: /Dlhy.*hypotéky/i });
    
    const add = await screen.findByRole("button", { name: /Pridať.*dlh/i }, { timeout: 3000 });
    fireEvent.click(add);
    
    // Použi getAllByRole a vyber prvý debt row
    const principals = screen.getAllByRole("spinbutton", { name: /Zostatok dlhu/i });
    const rates = screen.getAllByRole("spinbutton", { name: /Úrok p\.a\. dlhu/i });
    const payments = screen.getAllByRole("spinbutton", { name: /Splátka dlhu/i });
    const years = screen.getAllByRole("spinbutton", { name: /Zostáva rokov dlhu/i });
    
    fireEvent.change(principals[0], { target: { value: "50000" } });
    fireEvent.change(rates[0], { target: { value: "5" } });
    fireEvent.change(payments[0], { target: { value: "300" } });
    fireEvent.change(years[0], { target: { value: "20" } });
    
    // Reason line should render regardless of extraMonthly
    await waitFor(() => {
      const reason = screen.getByText(
        /Dôvod: úrok .* vs\. oč\. výnos − 2 p\.b\./i
      );
      expect(reason).toBeTruthy();
    });
  });
});
