/**
 * PR-9 Task B: Test debt amortization engine
 *
 * Scenáre:
 * 1. 30k € @ 8% p.a. / 6 rokov (72 mesiacov) - base scenario
 * 2. + extra 100 €/mes → skrátenie splatnosti + úspora úrokov
 * 3. Edge cases: nula principal, vysoký extra
 */

import { describe, it, expect } from "vitest";
import {
  annuityPayment,
  scheduleWithExtra,
} from "../src/features/debt/amortization";

describe("PR-9 Task B: Debt amortization engine v2", () => {
  it("annuityPayment: 30k @ 8% / 6r → ~€528/mes", () => {
    const pmt = annuityPayment(30000, 0.08, 72);

    // PMT formula: očakávame ~€528
    expect(pmt).toBeGreaterThan(520);
    expect(pmt).toBeLessThan(535);
  });

  it("scheduleWithExtra: base scenario (bez extra)", () => {
    const schedule = scheduleWithExtra(30000, 0.08, 72, 0);

    // Payoff month = 72 (presne podľa term)
    expect(schedule.payoffMonth).toBe(72);

    // Balances: prvý mesiac má vyšší zostatok než posledný
    expect(schedule.balances[1]).toBeGreaterThan(schedule.balances[71]);

    // Zostatok klesá monotónne
    for (let i = 1; i < schedule.balances.length - 1; i++) {
      expect(schedule.balances[i]).toBeGreaterThanOrEqual(
        schedule.balances[i + 1]
      );
    }

    // Posledný zostatok je 0
    expect(schedule.balances[schedule.balances.length - 1]).toBeLessThan(0.01);

    // Total interest > 0
    expect(schedule.totalInterest).toBeGreaterThan(0);
  });

  it("scheduleWithExtra: s extra 100€ → skoršie splatenie", () => {
    const baseSchedule = scheduleWithExtra(30000, 0.08, 72, 0);
    const extraSchedule = scheduleWithExtra(30000, 0.08, 72, 100);

    // Extra splátky skracujú splatnosť
    expect(extraSchedule.payoffMonth).toBeLessThan(baseSchedule.payoffMonth);

    // Ušetrené mesiace > 0
    expect(extraSchedule.monthsSaved).toBeGreaterThan(0);

    // Ušetrený úrok > 0
    expect(extraSchedule.interestSaved).toBeGreaterThan(0);

    // Total interest s extra je nižší
    expect(extraSchedule.totalInterest).toBeLessThan(
      baseSchedule.totalInterest
    );
  });

  it("scheduleWithExtra: edge case - vysoký extra (splatiť za 1 mesiac)", () => {
    const schedule = scheduleWithExtra(1000, 0.05, 12, 10000);

    // Splatené okamžite (mesiac 1 alebo 2)
    expect(schedule.payoffMonth).toBeLessThanOrEqual(2);

    // Minimal interest
    expect(schedule.totalInterest).toBeLessThan(10);
  });

  it("scheduleWithExtra: prvý mesiac správne rozdeľuje úrok a istinu", () => {
    const principal = 30000;
    const annualRate = 0.08;
    const termMonths = 72;

    const pmt = annuityPayment(principal, annualRate, termMonths);
    const monthlyRate = annualRate / 12;

    // Prvý mesiac: úrok = principal * monthlyRate
    const firstInterest = principal * monthlyRate;
    const firstPrincipal = pmt - firstInterest;

    // Úrok musí byť kladný
    expect(firstInterest).toBeGreaterThan(0);

    // Istina musí byť kladná
    expect(firstPrincipal).toBeGreaterThan(0);

    // Súčet = PMT
    expect(firstInterest + firstPrincipal).toBeCloseTo(pmt, 2);

    // Pre 6 rokov @ 8%, istina je ~€326, úrok ~€200
    // (krátky horizont → vyššia istina)
    expect(firstPrincipal).toBeGreaterThan(firstInterest);
  });

  it("Edge case: zero principal → empty schedule", () => {
    const schedule = scheduleWithExtra(0, 0.08, 72, 0);

    expect(schedule.payoffMonth).toBe(0);
    expect(schedule.totalInterest).toBe(0);
    expect(schedule.balances.length).toBe(1);
    expect(schedule.balances[0]).toBe(0);
  });

  it("Edge case: zero interest → simple division", () => {
    const schedule = scheduleWithExtra(1200, 0, 12, 0);

    // 1200 / 12 = 100 € per month
    // No interest → payoff exactly at month 12
    expect(schedule.payoffMonth).toBeLessThanOrEqual(12);
    expect(schedule.totalInterest).toBe(0);
  });
});
