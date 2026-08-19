import { describe, expect, it } from "vitest";
import { calculateProjection, applyMonthlyGrowth } from "../goalProjection";

// See goalMath.test.ts for the double-counting regression coverage and the
// no-target-date / already-met / months-remaining=0 / targetAmount=0 edge cases.
// This file covers the classification boundaries and rate edge cases specifically
// called out for lib/goalProjection.ts.

function monthsFromNow(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

describe("calculateProjection — status classification boundaries", () => {
  it("classifies on_track when the projection meets or exceeds the target", () => {
    const result = calculateProjection({
      currentAmount: 1000, targetAmount: 1000, targetDate: monthsFromNow(12),
      monthlyCashSaved: 0, savingsBalance: 0, savingsRatePercent: 0,
      investmentValue: 0, investmentRatePercent: 0,
    });
    expect(result.status).toBe("on_track");
    expect(result.onTrack).toBe(true);
  });

  it("classifies almost at exactly a 20% gap", () => {
    // projectedAmount = 800, target = 1000 → gapPercent = 20 exactly
    const result = calculateProjection({
      currentAmount: 800, targetAmount: 1000, targetDate: monthsFromNow(12),
      monthlyCashSaved: 0, savingsBalance: 0, savingsRatePercent: 0,
      investmentValue: 0, investmentRatePercent: 0,
    });
    expect(result.gapPercent).toBeCloseTo(20, 6);
    expect(result.status).toBe("almost");
  });

  it("classifies off_track just past the 20% gap boundary", () => {
    const result = calculateProjection({
      currentAmount: 799, targetAmount: 1000, targetDate: monthsFromNow(12),
      monthlyCashSaved: 0, savingsBalance: 0, savingsRatePercent: 0,
      investmentValue: 0, investmentRatePercent: 0,
    });
    expect(result.gapPercent).toBeGreaterThan(20);
    expect(result.status).toBe("off_track");
  });
});

describe("calculateProjection — rate and horizon edge cases", () => {
  it("produces zero growth-from-returns with zero savings/investment rates (no compounding)", () => {
    const result = calculateProjection({
      currentAmount: 1000, targetAmount: 5000, targetDate: monthsFromNow(24),
      monthlyCashSaved: 100, savingsBalance: 10000, savingsRatePercent: 0,
      investmentValue: 5000, investmentRatePercent: 0,
    });
    expect(result.monthlyGrowthFromReturns).toBe(0);
    // With no compounding, the projection is exactly linear cash accumulation.
    expect(result.projectedAmount).toBeCloseTo(1000 + 100 * 24, 6);
  });

  it("treats a target date this month as zero months remaining without NaN", () => {
    const result = calculateProjection({
      currentAmount: 500, targetAmount: 1000, targetDate: new Date().toISOString(),
      monthlyCashSaved: 50, savingsBalance: 0, savingsRatePercent: 0,
      investmentValue: 0, investmentRatePercent: 0,
    });
    expect(result.monthsRemaining).toBe(0);
    expect(Number.isNaN(result.projectedAmount)).toBe(false);
    expect(Number.isNaN(result.requiredMonthlySaving)).toBe(false);
  });
});

describe("applyMonthlyGrowth", () => {
  it("returns just currentAmount + cash saved when there's no balance to grow", () => {
    expect(applyMonthlyGrowth(1000, 200, 0, 5, 0, 7)).toBe(1200);
  });

  it("compounds interest and investment gains proportionally to their rates", () => {
    const next = applyMonthlyGrowth(0, 0, 12000, 6, 6000, 12);
    expect(next).toBeCloseTo(12000 * (6 / 100 / 12) + 6000 * (12 / 100 / 12), 6);
  });
});
