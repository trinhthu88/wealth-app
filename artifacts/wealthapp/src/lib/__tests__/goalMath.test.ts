import { describe, expect, it } from "vitest";
import { calculateProjection, applyMonthlyGrowth, computeGoalProgress } from "@workspace/goal-math";

describe("calculateProjection — free-tier / health-score compound model", () => {
  it("adds growth-only compounding on the balances, never the principal a second time", () => {
    // Callers (healthscore.ts, free/*.tsx) pre-fold the savings/investment principal into
    // `currentAmount` once. This guards that the projection then adds only *future growth*
    // on top (pow(rate, months) - 1) instead of accidentally re-adding the full balance
    // (pow(rate, months)), which would double-count the principal.
    const savingsBalance = 10000;
    const investmentValue = 5000;
    const savingsRatePercent = 4;
    const investmentRatePercent = 7;
    const currentAmount = savingsBalance + investmentValue; // principal already folded in once
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth() + 12, 1).toISOString();

    const result = calculateProjection({
      currentAmount,
      targetAmount: 1_000_000,
      targetDate,
      monthlyCashSaved: 0,
      savingsBalance,
      savingsRatePercent,
      investmentValue,
      investmentRatePercent,
    });

    const savingsMonthlyRate = savingsRatePercent / 100 / 12;
    const investMonthlyRate = investmentRatePercent / 100 / 12;
    const growthOnly =
      savingsBalance * (Math.pow(1 + savingsMonthlyRate, result.monthsRemaining) - 1) +
      investmentValue * (Math.pow(1 + investMonthlyRate, result.monthsRemaining) - 1);
    const doubleCounted =
      currentAmount +
      savingsBalance * Math.pow(1 + savingsMonthlyRate, result.monthsRemaining) +
      investmentValue * Math.pow(1 + investMonthlyRate, result.monthsRemaining);

    expect(result.projectedAmount).toBeCloseTo(currentAmount + growthOnly, 6);
    expect(result.projectedAmount).toBeLessThan(doubleCounted);
  });

  it("treats a target date in the past / this month as zero months remaining without dividing by zero", () => {
    const pastDate = new Date(2000, 0, 1).toISOString();
    const result = calculateProjection({
      currentAmount: 100,
      targetAmount: 1000,
      targetDate: pastDate,
      monthlyCashSaved: 50,
      savingsBalance: 0,
      savingsRatePercent: 0,
      investmentValue: 0,
      investmentRatePercent: 0,
    });
    expect(result.monthsRemaining).toBe(0);
    expect(Number.isFinite(result.requiredMonthlySaving)).toBe(true);
    expect(result.requiredMonthlySaving).toBe(900); // falls back to amountStillNeeded, not Infinity
    expect(Number.isNaN(result.projectedAmount)).toBe(false);
  });

  it("reports amountStillNeeded and status on_track when the goal is already met", () => {
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth() + 6, 1).toISOString();
    const result = calculateProjection({
      currentAmount: 5000,
      targetAmount: 1000,
      targetDate,
      monthlyCashSaved: 0,
      savingsBalance: 0,
      savingsRatePercent: 0,
      investmentValue: 0,
      investmentRatePercent: 0,
    });
    expect(result.amountStillNeeded).toBe(0);
    expect(result.onTrack).toBe(true);
    expect(result.status).toBe("on_track");
  });

  it("does not divide by zero when targetAmount is 0", () => {
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth() + 6, 1).toISOString();
    const result = calculateProjection({
      currentAmount: 0,
      targetAmount: 0,
      targetDate,
      monthlyCashSaved: 100,
      savingsBalance: 0,
      savingsRatePercent: 0,
      investmentValue: 0,
      investmentRatePercent: 0,
    });
    expect(Number.isNaN(result.gapPercent)).toBe(false);
    expect(Number.isFinite(result.gapPercent)).toBe(true);
  });
});

describe("applyMonthlyGrowth — free-tier stored current_amount accumulator", () => {
  it("adds cash saved plus interest/gains earned on balances, not the balances themselves", () => {
    // This is the mechanism that keeps the stored current_amount independent of the raw
    // savings/investment principal, so re-adding those balances at read time (see
    // healthscore.ts, free/*.tsx) doesn't double-count them.
    const next = applyMonthlyGrowth(1000, 200, 10000, 4, 5000, 7);
    const expectedInterest = 10000 * (4 / 100 / 12);
    const expectedGain = 5000 * (7 / 100 / 12);
    expect(next).toBeCloseTo(1000 + 200 + expectedInterest + expectedGain, 6);
    expect(next).toBeLessThan(1000 + 200 + 10000 + 5000); // never folds in the principal
  });
});

describe("computeGoalProgress — investment-client-tier elapsed-time pacing model", () => {
  it("never adds a separate savings/investment balance — currentAmount is the whole input", () => {
    // The function signature itself prevents the double-counting bug possible in the
    // free-tier model: there is no balance parameter to accidentally add on top.
    const result = computeGoalProgress({
      currentAmount: 12000, // e.g. value of linked holdings, already the full funding total
      targetAmount: 20000,
      targetDate: new Date(new Date().getFullYear() + 1, 0, 1).toISOString(),
      createdAt: new Date().toISOString(),
    });
    expect(result.progressPct).toBeCloseTo(60, 5);
  });

  it("returns status on_track with no expected-pct pacing when there's no target date", () => {
    const result = computeGoalProgress({
      currentAmount: 100,
      targetAmount: 1000,
      targetDate: null,
      createdAt: new Date(2020, 0, 1).toISOString(),
    });
    expect(result.status).toBe("on_track");
    expect(result.expectedPct).toBeNull();
    expect(result.monthsRemaining).toBeNull();
  });

  it("returns status completed and 100% progress once the target is met", () => {
    const result = computeGoalProgress({
      currentAmount: 1500,
      targetAmount: 1000,
      targetDate: new Date(2030, 0, 1).toISOString(),
      createdAt: new Date(2020, 0, 1).toISOString(),
    });
    expect(result.status).toBe("completed");
    expect(result.progressPct).toBe(100);
    expect(result.monthsRemaining).toBe(0);
  });

  it("returns status no_target and null progress when there's no target amount", () => {
    const result = computeGoalProgress({
      currentAmount: 500,
      targetAmount: null,
      targetDate: null,
      createdAt: new Date().toISOString(),
    });
    expect(result.status).toBe("no_target");
    expect(result.progressPct).toBeNull();
  });

  it("reports zero months remaining for a target date already reached", () => {
    const result = computeGoalProgress({
      currentAmount: 100,
      targetAmount: 1000,
      targetDate: new Date(2000, 0, 1).toISOString(),
      createdAt: new Date(1999, 0, 1).toISOString(),
    });
    expect(result.monthsRemaining).toBe(0);
    expect(result.status).toBe("off_track");
  });
});
