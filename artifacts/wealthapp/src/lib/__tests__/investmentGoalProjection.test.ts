import { describe, expect, it } from "vitest";
import { scenarioMarketDrop, type PackageInput } from "../investmentGoalProjection";

describe("scenarioMarketDrop recovery time", () => {
  it("computes recovery time to double, not to grow by the drop amount, for a 50% drop", () => {
    const annualReturn = 7; // ~7%/year, matching the brief's example
    const packages: PackageInput[] = [
      { currentValueUsd: 100_000, monthlyContribution: 0, expectedAnnualReturn: annualReturn, type: "lump_sum" },
    ];
    // Far-out target date so the base projection doesn't clip recovery math.
    const targetDate = "2060-01-01";

    const { recoveryMonths } = scenarioMarketDrop(packages, 50, 200_000, targetDate);

    const monthlyRate = annualReturn / 100 / 12;
    const monthsToDouble = Math.ceil(Math.log(2) / Math.log(1 + monthlyRate));
    const monthsToGrow50Pct = Math.ceil(Math.log(1.5) / Math.log(1 + monthlyRate));

    // A 50% drop needs a 100% gain (doubling) to recover, not a 50% gain.
    expect(recoveryMonths).toBe(monthsToDouble);
    expect(recoveryMonths).not.toBe(monthsToGrow50Pct);
    expect(recoveryMonths).toBeGreaterThan(monthsToGrow50Pct);
  });

  it("returns 0 recovery months when there is no expected return", () => {
    const packages: PackageInput[] = [
      { currentValueUsd: 100_000, monthlyContribution: 0, expectedAnnualReturn: 0, type: "lump_sum" },
    ];
    const { recoveryMonths } = scenarioMarketDrop(packages, 50, 200_000, "2060-01-01");
    expect(recoveryMonths).toBe(0);
  });
});
