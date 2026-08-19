export type GoalStatus = "on_track" | "at_risk" | "off_track" | "no_target" | "completed";

export interface GoalProgressResult {
  progressPct: number | null;
  status: GoalStatus;
  expectedPct: number | null;
  monthsRemaining: number | null;
  projectedCompletionDate: string | null;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/**
 * Investment-client-tier canonical model: elapsed-time pacing against a target date.
 * `currentAmount` here is the goal's own funding total (linked-holdings value, or a
 * manually entered amount) — never the user's whole savings/investment balance. See the
 * tier note in index.ts for why this diverges from the free tier's compound projection.
 */
export function computeGoalProgress(goal: {
  currentAmount: number;
  targetAmount: number | null;
  targetDate: string | null;
  createdAt: string;
}): GoalProgressResult {
  const { currentAmount, targetAmount, targetDate, createdAt } = goal;
  const now = new Date();

  if (!targetAmount || targetAmount <= 0) {
    return {
      progressPct: null,
      status: "no_target",
      expectedPct: null,
      monthsRemaining: null,
      projectedCompletionDate: null,
    };
  }

  const progressPct = Math.min(100, (currentAmount / targetAmount) * 100);

  if (currentAmount >= targetAmount) {
    return {
      progressPct: 100,
      status: "completed",
      expectedPct: null,
      monthsRemaining: 0,
      projectedCompletionDate: null,
    };
  }

  if (!targetDate) {
    return {
      progressPct,
      status: "on_track",
      expectedPct: null,
      monthsRemaining: null,
      projectedCompletionDate: null,
    };
  }

  const targetDateObj = new Date(targetDate);
  const createdAtObj = new Date(createdAt);

  const monthsTotal = monthsBetween(createdAtObj, targetDateObj);
  const monthsElapsed = Math.max(0, monthsBetween(createdAtObj, now));
  const monthsRemaining = Math.max(0, monthsBetween(now, targetDateObj));

  const expectedPct = monthsTotal > 0 ? Math.min(100, (monthsElapsed / monthsTotal) * 100) : 0;
  const actualPct = progressPct;

  let status: GoalStatus;
  if (actualPct >= expectedPct * 0.9) {
    status = "on_track";
  } else if (actualPct >= expectedPct * 0.6) {
    status = "at_risk";
  } else {
    status = "off_track";
  }

  // Projected completion date
  let projectedCompletionDate: string | null = null;
  if (currentAmount > 0 && monthsElapsed > 0 && targetDate) {
    const monthlyProgress = currentAmount / monthsElapsed;
    const remaining = targetAmount - currentAmount;
    const monthsNeeded = remaining / monthlyProgress;
    const projected = new Date(now);
    projected.setMonth(projected.getMonth() + Math.round(monthsNeeded));
    const diffMonths = monthsBetween(targetDateObj, projected);
    if (Math.abs(diffMonths) > 3) {
      projectedCompletionDate = projected.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
  }

  return {
    progressPct,
    status,
    expectedPct,
    monthsRemaining,
    projectedCompletionDate,
  };
}
