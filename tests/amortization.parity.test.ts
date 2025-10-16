import { describe, it, expect } from "vitest";
import { buildAmortSchedule } from "../src/domain/amortization";

describe("amortization parity", () => {
  it("pays down to near zero on simple case", () => {
    const res = buildAmortSchedule({
      principal: 1000,
      ratePa: 0.12,
      termMonths: 12,
      monthlyPayment: 88.85,
    });
    const last = res.months.at(-1);
    expect(last).toBeTruthy();
    expect(Math.abs((last?.balance || 0))).toBeLessThan(5);
  });
});
