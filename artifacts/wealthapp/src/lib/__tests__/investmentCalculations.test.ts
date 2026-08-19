import { describe, expect, it } from "vitest";
import { calcMarketDropRecoveryMonths } from "../investmentCalculations";

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
