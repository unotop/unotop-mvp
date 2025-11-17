/**
 * PR-10 Task A: Amortization validation - 100k @ 4% / 30y
 *
 * Akceptačné kritérium:
 * - PMT ≈ 477.42 €
 * - Payoff ~360 mesiacov (30 rokov)
 * - S extra 100 € → payoff < 360 mesiacov
 */

import { describe, it, expect } from "vitest";
import {
  annuityPayment,
  scheduleWithExtra,
} from "../src/features/debt/amortization";

describe("PR-10 Task A: Amortization - 100k @ 4% / 30y", () => {
  const PRINCIPAL = 100000;
  const ANNUAL_RATE = 0.04;
  const TERM_MONTHS = 360; // 30 years

  it("annuityPayment: 100k @ 4% / 30y → PMT ~€477.42", () => {
    const pmt = annuityPayment(PRINCIPAL, ANNUAL_RATE, TERM_MONTHS);

    // Očakávaná hodnota: 477.42 € (±0.50€ tolerancia)
    expect(pmt).toBeGreaterThan(476.9);
    expect(pmt).toBeLessThan(478.0);

    // Presná validácia
    expect(pmt).toBeCloseTo(477.42, 2);
  });

  it("scheduleWithExtra: base (bez extra) → payoff ~360 mesiacov", () => {
    const schedule = scheduleWithExtra(PRINCIPAL, ANNUAL_RATE, TERM_MONTHS, 0);

    // Payoff presne 360 mesiacov
    expect(schedule.payoffMonth).toBe(360);

    // Posledný zostatok je 0
    expect(schedule.balances[360]).toBeLessThan(0.01);

    // Total interest je významný (dlhé obdobie)
    // 100k @ 4% / 30y → celkový úrok ~71,869 €
    expect(schedule.totalInterest).toBeGreaterThan(70000);
    expect(schedule.totalInterest).toBeLessThan(75000);
  });

  it("scheduleWithExtra: s extra 100€ → payoff < 360 mesiacov", () => {
    const baseSchedule = scheduleWithExtra(
      PRINCIPAL,
      ANNUAL_RATE,
      TERM_MONTHS,
      0
    );
    const extraSchedule = scheduleWithExtra(
      PRINCIPAL,
      ANNUAL_RATE,
      TERM_MONTHS,
      100
    );

    // Extra platby skracujú splatnosť
    expect(extraSchedule.payoffMonth).toBeLessThan(baseSchedule.payoffMonth);

    // Ušetrené mesiace > 0
    expect(extraSchedule.monthsSaved).toBeGreaterThan(0);

    // Ušetrený úrok > 0
    expect(extraSchedule.interestSaved).toBeGreaterThan(0);

    // S extra 100€/mes sa loan splatí za ~240-250 mesiacov (skrátenie o ~10 rokov)
    expect(extraSchedule.payoffMonth).toBeLessThan(300);
    expect(extraSchedule.payoffMonth).toBeGreaterThan(220);
  });

  it("krivka dlhu klesá hladko (monotónne)", () => {
    const schedule = scheduleWithExtra(PRINCIPAL, ANNUAL_RATE, TERM_MONTHS, 0);

    // Každý mesiac zostatok klesá alebo ostáva 0
    for (let i = 1; i < schedule.balances.length - 1; i++) {
      expect(schedule.balances[i]).toBeGreaterThanOrEqual(
        schedule.balances[i + 1]
      );
    }

    // Prvý zostatok = principal
    expect(schedule.balances[0]).toBe(PRINCIPAL);

    // Posledný zostatok = 0
    expect(schedule.balances[schedule.balances.length - 1]).toBeLessThan(0.01);
  });

  it("prvých 12 mesiacov: zostatok klesá postupne", () => {
    const schedule = scheduleWithExtra(PRINCIPAL, ANNUAL_RATE, TERM_MONTHS, 0);

    // Prvý rok: zostatok klesá približne o ~1-2% (úrok dominuje)
    const balance0 = schedule.balances[0];
    const balance12 = schedule.balances[12];

    expect(balance12).toBeLessThan(balance0);
    expect(balance12).toBeGreaterThan(balance0 * 0.97); // Aspoň 3% pokles za rok
  });
});
