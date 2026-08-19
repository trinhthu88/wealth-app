import { describe, expect, it } from "vitest";
import {
  calcMarketDropRecoveryMonths, calcPlanGainLoss, calcCAGR, calcPeriodReturn, calcTotalFees,
  calcHoldingCurrentValue, calcHoldingGainLoss, projectMonthlyGrowth, runScenario,
} from "../investmentCalculations";

describe("calcMarketDropRecoveryMonths", () => {
  it("computes recovery time to double, not to grow by the drop amount, for a 50% drop", () => {
    const annualReturn = 7; // ~7%/year, matching the brief's example
    const recoveryMonths = calcMarketDropRecoveryMonths(50, annualReturn);

    const monthlyRate = annualReturn / 100 / 12;
    const monthsToDouble = Math.ceil(Math.log(2) / Math.log(1 + monthlyRate));
    const monthsToGrow50Pct = Math.ceil(Math.log(1.5) / Math.log(1 + monthlyRate));

    // A 50% drop needs a 100% gain (doubling) to recover, not a 50% gain.
    expect(recoveryMonths).toBe(monthsToDouble);
    expect(recoveryMonths).not.toBe(monthsToGrow50Pct);
    expect(recoveryMonths).toBeGreaterThan(monthsToGrow50Pct);
  });

  it("returns 0 recovery months when there is no expected return", () => {
    expect(calcMarketDropRecoveryMonths(50, 0)).toBe(0);
  });
});

describe("calcPlanGainLoss", () => {
  it("computes gain/loss and pct against net contribution", () => {
    expect(calcPlanGainLoss(1200, 1000)).toEqual({ gainLoss: 200, gainLossPct: 20 });
  });

  it("returns 0% (not NaN/Infinity) when net contribution is 0", () => {
    const { gainLossPct } = calcPlanGainLoss(500, 0);
    expect(gainLossPct).toBe(0);
  });
});

describe("calcCAGR", () => {
  it("returns 0 for non-positive contribution or current value", () => {
    expect(calcCAGR(1000, 0, "2020-01-01")).toBe(0);
    expect(calcCAGR(0, 1000, "2020-01-01")).toBe(0);
  });

  it("returns 0 for a very recent effective date (< ~1 month) to avoid an exploding annualized rate", () => {
    const today = new Date().toISOString();
    expect(calcCAGR(1100, 1000, today)).toBe(0);
  });

  it("computes a positive annualized rate for a multi-year gain", () => {
    const fiveYearsAgo = new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000).toISOString();
    const cagr = calcCAGR(2000, 1000, fiveYearsAgo); // doubled over 5 years
    expect(cagr).toBeGreaterThan(10);
    expect(cagr).toBeLessThan(20);
  });
});

describe("calcPeriodReturn", () => {
  it("returns 0 when opening value is not positive", () => {
    expect(calcPeriodReturn(100, 0)).toBe(0);
    expect(calcPeriodReturn(100, -50)).toBe(0);
  });

  it("computes percent return against the opening value", () => {
    expect(calcPeriodReturn(50, 1000)).toBe(5);
  });
});

describe("calcTotalFees", () => {
  it("sums absolute values of all fee components", () => {
    const total = calcTotalFees({
      policy_fee: 10, asset_management_fee: -5, admin_charges: 2, advisory_services_fee: 3, bid_offer_spread: -1,
    });
    expect(total).toBe(21);
  });
});

describe("calcHoldingCurrentValue / calcHoldingGainLoss", () => {
  it("computes current value as units × price", () => {
    expect(calcHoldingCurrentValue(10, 25)).toBe(250);
  });

  it("computes gain/loss and pct against cost basis, 0% when cost basis is 0", () => {
    expect(calcHoldingGainLoss(10, 20, 25)).toEqual({
      costBasis: 200, currentValue: 250, gainLoss: 50, gainLossPct: 25,
    });
    expect(calcHoldingGainLoss(10, 0, 25).gainLossPct).toBe(0);
  });
});

describe("projectMonthlyGrowth", () => {
  it("includes both endpoints and compounds contributions monthly", () => {
    const points = projectMonthlyGrowth(1000, 100, 12, 2);
    expect(points).toHaveLength(3); // month 0, 1, 2
    expect(points[0].value).toBe(1000);
    const monthlyRate = 12 / 100 / 12;
    expect(points[1].value).toBe(Math.round(1000 * (1 + monthlyRate) + 100));
  });
});

describe("runScenario", () => {
  it("market_drop: applies the drop immediately, recovers with 0% return during recovery, then resumes normal growth", () => {
    const result = runScenario({
      type: "market_drop",
      currentValue: 100_000,
      currentMonthly: 500,
      dropPct: 50,
      recoveryMonths: 6,
      annualReturnPct: 7,
      months: 24,
    });
    // First scenario point reflects the immediate drop.
    expect(result.dataPoints[0].scenario).toBe(50_000);
    expect(result.scenarioFinalValue).toBeLessThan(result.baselineFinalValue);
    expect(result.deltaValue).toBeLessThan(0);
    expect(result.dataPoints).toHaveLength(25); // months 0..24
  });

  it("add_lump_sum: with a nonzero delay, the lump sum only lands at the delay month, not immediately", () => {
    const noDelay = runScenario({
      type: "add_lump_sum",
      currentValue: 10_000, currentMonthly: 200, lumpSumAmount: 5_000, lumpSumDelayMonths: 0,
      annualReturnPct: 6, months: 12,
    });
    const delayed = runScenario({
      type: "add_lump_sum",
      currentValue: 10_000, currentMonthly: 200, lumpSumAmount: 5_000, lumpSumDelayMonths: 6,
      annualReturnPct: 6, months: 12,
    });

    // Immediately after creation, the no-delay scenario already includes the lump sum.
    expect(noDelay.dataPoints[0].scenario).toBe(15_000);
    // The delayed scenario does not include it yet at month 0, or anywhere through the
    // delay month itself (the lump sum is added *after* month 6 is reached).
    expect(delayed.dataPoints[0].scenario).toBe(10_000);
    expect(delayed.dataPoints[6].scenario).toBeLessThan(15_000);
    // The month right after the delay reflects the lump sum landing plus one month's growth.
    expect(delayed.dataPoints[7].scenario).toBeGreaterThanOrEqual(15_000);
    expect(delayed.lumpSumDelayMonths).toBe(6);

    // Getting the money in earlier (no delay) compounds for longer, so it ends up ahead.
    expect(noDelay.scenarioFinalValue).toBeGreaterThan(delayed.scenarioFinalValue);
  });

  it("retire_earlier: binary search converges to a required monthly contribution that hits the target within the shortened timeline", () => {
    const result = runScenario({
      type: "retire_earlier",
      currentValue: 50_000,
      currentMonthly: 1_000,
      targetAmount: 500_000,
      currentTargetMonths: 240, // 20 years
      newTargetMonths: 180,     // 15 years
      annualReturnPct: 7,
    });

    expect(result.requiredMonthly).toBeGreaterThan(0);
    expect(result.requiredMonthly).toBeGreaterThan(1_000); // must save more to retire earlier
    expect(result.extraMonthly).toBe(result.requiredMonthly! - 1_000);

    // Verify convergence: compounding at the required monthly rate for newTargetMonths
    // should land within a small tolerance of the target (binary search, not exact).
    const monthlyRate = 7 / 100 / 12;
    let v = 50_000;
    for (let m = 1; m <= 180; m++) v = v * (1 + monthlyRate) + result.requiredMonthly!;
    expect(Math.abs(v - 500_000) / 500_000).toBeLessThan(0.01);

    expect(result.monthsToGoalScenario).toBe(180);
  });
});
