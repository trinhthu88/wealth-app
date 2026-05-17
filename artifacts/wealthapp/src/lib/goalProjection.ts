export interface ProjectionInput {
  currentAmount: number;
  targetAmount: number;
  targetDate: string;
  monthlyCashSaved: number;
  savingsBalance: number;
  savingsRatePercent: number;
  investmentValue: number;
  investmentRatePercent: number;
}

export interface ProjectionResult {
  status: "on_track" | "almost" | "off_track";
  onTrack: boolean;
  monthsRemaining: number;
  requiredMonthlySaving: number;
  projectedAmount: number;
  monthlyShortfall: number;
  amountStillNeeded: number;
  projectedShortfall: number;
  gapPercent: number;
  monthlyGrowthFromReturns: number;
}

export function calculateProjection(input: ProjectionInput): ProjectionResult {
  const {
    currentAmount, targetAmount, targetDate,
    monthlyCashSaved, savingsBalance, savingsRatePercent,
    investmentValue, investmentRatePercent,
  } = input;

  const today = new Date();
  const target = new Date(targetDate);
  const monthsRemaining = Math.max(
    0,
    (target.getFullYear() - today.getFullYear()) * 12 +
      (target.getMonth() - today.getMonth()),
  );

  const amountStillNeeded = Math.max(0, targetAmount - currentAmount);
  const requiredMonthlySaving =
    monthsRemaining > 0 ? amountStillNeeded / monthsRemaining : amountStillNeeded;

  const savingsMonthlyRate = savingsRatePercent / 100 / 12;
  const investMonthlyRate = investmentRatePercent / 100 / 12;

  const projectedInterest =
    savingsBalance * (Math.pow(1 + savingsMonthlyRate, monthsRemaining) - 1);
  const projectedInvestmentGrowth =
    investmentValue * (Math.pow(1 + investMonthlyRate, monthsRemaining) - 1);
  const projectedCashSavings = monthlyCashSaved * monthsRemaining;

  const projectedAmount =
    currentAmount +
    projectedCashSavings +
    projectedInterest +
    projectedInvestmentGrowth;

  const projectedShortfall = Math.max(0, targetAmount - projectedAmount);
  const gapPercent =
    targetAmount > 0 ? (projectedShortfall / targetAmount) * 100 : 0;
  const monthlyShortfall = Math.max(0, requiredMonthlySaving - monthlyCashSaved);
  const monthlyGrowthFromReturns =
    savingsBalance * savingsMonthlyRate + investmentValue * investMonthlyRate;

  const onTrack = projectedAmount >= targetAmount;
  const status: ProjectionResult["status"] = onTrack
    ? "on_track"
    : gapPercent <= 20
      ? "almost"
      : "off_track";

  return {
    status,
    onTrack,
    monthsRemaining,
    requiredMonthlySaving,
    projectedAmount,
    monthlyShortfall,
    amountStillNeeded,
    projectedShortfall,
    gapPercent,
    monthlyGrowthFromReturns,
  };
}

export function applyMonthlyGrowth(
  currentAmount: number,
  monthlyCashSaved: number,
  savingsBalance: number,
  savingsRatePercent: number,
  investmentValue: number,
  investmentRatePercent: number,
): number {
  const monthlyInterest = savingsBalance * (savingsRatePercent / 100 / 12);
  const monthlyInvestGain = investmentValue * (investmentRatePercent / 100 / 12);
  return currentAmount + monthlyCashSaved + monthlyInterest + monthlyInvestGain;
}
