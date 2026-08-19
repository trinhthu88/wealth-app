// calculateInvestmentGoalProjection is used by the "bring under management" comparison
// (BringUnderManagementCompare) to project a single self-tracked holding forward under
// two different assumed returns. The scenario-planner UI (ClientScenarios) does NOT use
// this file — it uses lib/investmentCalculations.ts's chart-trajectory engine instead,
// including the corrected market-drop recovery formula (calcMarketDropRecoveryMonths).

export interface PackageInput {
  currentValueUsd: number;
  monthlyContribution: number;
  expectedAnnualReturn: number;
  type: "rsp" | "lump_sum" | "combination";
}

export interface InvestmentGoalProjectionResult {
  status: "on_track" | "almost" | "off_track";
  onTrack: boolean;
  monthsRemaining: number;
  totalCurrentValue: number;
  totalProjectedValue: number;
  totalMonthlyContribution: number;
  projectedShortfall: number;
  gapPercent: number;
  amountStillNeeded: number;
  monthlyShortfall: number;
  additionalMonthlyNeeded: number;
  lumpSumNeededToday: number;
}

export function calculateInvestmentGoalProjection(
  targetAmount: number,
  targetDate: string,
  packages: PackageInput[],
): InvestmentGoalProjectionResult {
  const today = new Date();
  const target = new Date(targetDate);
  const monthsRemaining = Math.max(
    0,
    (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth()),
  );

  let totalCurrentValue = 0;
  let totalProjectedValue = 0;
  let totalMonthlyContribution = 0;

  for (const pkg of packages) {
    totalCurrentValue += pkg.currentValueUsd;
    totalMonthlyContribution += pkg.monthlyContribution;
    const monthlyRate = pkg.expectedAnnualReturn / 100 / 12;
    const fvBalance = pkg.currentValueUsd * Math.pow(1 + monthlyRate, monthsRemaining);
    const fvContributions =
      pkg.monthlyContribution > 0 && monthlyRate > 0
        ? pkg.monthlyContribution * ((Math.pow(1 + monthlyRate, monthsRemaining) - 1) / monthlyRate)
        : pkg.monthlyContribution * monthsRemaining;
    totalProjectedValue += fvBalance + fvContributions;
  }

  const projectedShortfall = Math.max(0, targetAmount - totalProjectedValue);
  const gapPercent = targetAmount > 0 ? (projectedShortfall / targetAmount) * 100 : 0;
  const amountStillNeeded = Math.max(0, targetAmount - totalCurrentValue);
  const requiredMonthly = monthsRemaining > 0 ? amountStillNeeded / monthsRemaining : 0;
  const monthlyShortfall = Math.max(0, requiredMonthly - totalMonthlyContribution);

  const avgAnnualReturn =
    packages.length > 0
      ? packages.reduce((sum, p) => sum + p.expectedAnnualReturn, 0) / packages.length
      : 7.0;
  const avgMonthlyRate = avgAnnualReturn / 100 / 12;

  const additionalMonthlyNeeded =
    projectedShortfall > 0 && monthsRemaining > 0 && avgMonthlyRate > 0
      ? (projectedShortfall * avgMonthlyRate) / (Math.pow(1 + avgMonthlyRate, monthsRemaining) - 1)
      : projectedShortfall / Math.max(monthsRemaining, 1);

  const lumpSumNeededToday =
    projectedShortfall > 0 && monthsRemaining > 0
      ? projectedShortfall / Math.pow(1 + avgMonthlyRate, monthsRemaining)
      : projectedShortfall;

  const onTrack = totalProjectedValue >= targetAmount;
  const status = onTrack ? "on_track" : gapPercent <= 15 ? "almost" : "off_track";

  return {
    status,
    onTrack,
    monthsRemaining,
    totalCurrentValue,
    totalProjectedValue,
    totalMonthlyContribution,
    projectedShortfall,
    gapPercent,
    amountStillNeeded,
    monthlyShortfall,
    additionalMonthlyNeeded,
    lumpSumNeededToday,
  };
}

