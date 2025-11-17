/**
 * PR-10 Task G: DebtSummaryCard component tests
 *
 * Validuje správne zobrazenie súhrnu dlhov v UI.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DebtSummaryCard } from "../src/features/debt/DebtSummaryCard";
import type { Debt } from "../src/persist/v3";

describe("PR-10 Task G: DebtSummaryCard", () => {
  it("should render nothing when no debts", () => {
    const { container } = render(<DebtSummaryCard debts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("should show correct PMT for single debt (100k@4%/30y)", () => {
    const debt: Debt = {
      id: "1",
      name: "Hypotéka",
      principal: 100000,
      ratePa: 4.0,
      monthly: 477.42,
      monthsLeft: 360,
    };

    render(<DebtSummaryCard debts={[debt]} />);

    // PMT by mal byť ~477.42 € (annuityPayment calculation)
    expect(screen.getByText(/mesačná splátka/i)).toBeInTheDocument();
    expect(screen.getByText(/477\.4[0-9] €/)).toBeInTheDocument();
  });

  it("should show total interest for single debt", () => {
    const debt: Debt = {
      id: "1",
      name: "Hypotéka",
      principal: 100000,
      ratePa: 4.0,
      monthly: 477.42,
      monthsLeft: 360,
    };

    render(<DebtSummaryCard debts={[debt]} />);

    // Total interest by mal byť v rozmedzí 70k-75k (z acceptance kritérií)
    expect(screen.getByText(/úrok celkom/i)).toBeInTheDocument();
    const interestText = screen.getByText(/\d{2},?\d{3}\.\d{2} €/);

    // Extract number (handle both formats: "71,869.12" and "71869.12")
    const match = interestText.textContent?.match(/[\d,]+\.\d{2}/);
    expect(match).toBeTruthy();

    const interestValue = parseFloat(match![0].replace(/,/g, ""));
    expect(interestValue).toBeGreaterThanOrEqual(70000);
    expect(interestValue).toBeLessThanOrEqual(75000);
  });

  it("should show payoff date ~30 years from now", () => {
    const debt: Debt = {
      id: "1",
      name: "Hypotéka",
      principal: 100000,
      ratePa: 4.0,
      monthly: 477.42,
      monthsLeft: 360,
    };

    render(<DebtSummaryCard debts={[debt]} />);

    // Payoff date by mal byť ~30 rokov od teraz
    const now = new Date();
    const expectedYear = now.getFullYear() + 30;

    expect(screen.getByText(/vyplatenie/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${expectedYear}`))).toBeInTheDocument();
  });

  it("should show extra payment savings when extraMonthly > 0", () => {
    const debt: Debt = {
      id: "1",
      name: "Hypotéka",
      principal: 100000,
      ratePa: 4.0,
      monthly: 477.42,
      monthsLeft: 360,
      extraMonthly: 100, // +100€ extra
    };

    render(<DebtSummaryCard debts={[debt]} />);

    // Should show "S mimoriadkou" with earlier payoff
    expect(screen.getByText(/s mimoriadkou/i)).toBeInTheDocument();
    expect(screen.getByText(/ušetrené.*mesiacov/i)).toBeInTheDocument();

    // Verify months saved is visible (should be ~120 months from Task A tests)
    const savedText = screen.getByText(/ušetrené.*mesiacov/i);
    expect(savedText.textContent).toMatch(/\d{2,3} mesiacov/);
  });

  it("should aggregate multiple debts correctly", () => {
    const debts: Debt[] = [
      {
        id: "1",
        name: "Hypotéka",
        principal: 100000,
        ratePa: 4.0,
        monthly: 477.42,
        monthsLeft: 360,
      },
      {
        id: "2",
        name: "Auto",
        principal: 20000,
        ratePa: 6.0,
        monthly: 386.66,
        monthsLeft: 60,
      },
    ];

    render(<DebtSummaryCard debts={debts} />);

    // Total PMT by mal byť ~477.42 + 386.66 = ~864 €
    expect(screen.getByText(/mesačná splátka/i)).toBeInTheDocument();

    const pmtText = screen.getByText(/8\d{2}\.\d{2} €/);
    const pmtMatch = pmtText.textContent?.match(/([\d,]+\.\d{2})/);
    expect(pmtMatch).toBeTruthy();

    const pmtValue = parseFloat(pmtMatch![0].replace(/,/g, ""));
    expect(pmtValue).toBeGreaterThanOrEqual(860);
    expect(pmtValue).toBeLessThanOrEqual(870);
  });

  it("should handle invalid debt data gracefully", () => {
    const debts: Debt[] = [
      {
        id: "1",
        name: "Invalid",
        principal: 0, // Invalid: zero principal
        ratePa: 4.0,
        monthly: 0,
        monthsLeft: 0,
      },
      {
        id: "2",
        name: "Valid",
        principal: 50000,
        ratePa: 5.0,
        monthly: 377.42,
        monthsLeft: 180,
      },
    ];

    const { container } = render(<DebtSummaryCard debts={debts} />);

    // Should only process valid debt (skip invalid one)
    expect(screen.getByText(/mesačná splátka/i)).toBeInTheDocument();

    // PMT by mal byť len z validného dlhu (~377 €)
    const pmtText = screen.getByText(/3\d{2}\.\d{2} €/);
    expect(pmtText).toBeInTheDocument();
  });
});
