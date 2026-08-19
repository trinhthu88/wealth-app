import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db, healthScoresTable, budgetEntriesTable, financialGoalsTable,
  pathwayProgressTable, assetsTable, liabilitiesTable, profilesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { calculateProjection } from "@workspace/goal-math";

const router: IRouter = Router();

// ── Scoring tier helpers ────────────────────────────────────────────────────

/** Component 1: Effective Savings Rate → 25 pts max */
function scoreEffectiveSavingsRate(pct: number): number {
  if (pct >= 25) return 25;
  if (pct >= 20) return 22;
  if (pct >= 15) return 18;
  if (pct >= 10) return 12;
  if (pct >= 5)  return 6;
  return 0;
}

/** Component 2: Goal projection → 25 pts max */
function scoreGoalProjection(projected: number, target: number, hasGoal: boolean): number {
  if (!hasGoal) return 0;
  if (projected >= target) return 25;
  const gap = (target - projected) / target * 100;
  if (gap <= 20) return 15;
  return 5;
}

/** Component 3: Net worth → 20 pts max */
function scoreNetWorth(netWorth: number, hasData: boolean): number {
  if (!hasData) return 0;
  if (netWorth > 100_000) return 20;
  if (netWorth > 0) return 14;
  if (netWorth === 0) return 7;
  return 2;
}

/** Component 4: Wealth growth rate (annual growth / net worth) → 20 pts max */
function scoreWealthGrowthRate(pct: number): number {
  if (pct >= 10) return 20;
  if (pct >= 7)  return 16;
  if (pct >= 4)  return 10;
  if (pct >= 1)  return 5;
  return 0;
}

// ── Routes ──────────────────────────────────────────────────────────────────

router.get("/health-score", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [score] = await db.select().from(healthScoresTable)
    .where(eq(healthScoresTable.userId, userId))
    .orderBy(desc(healthScoresTable.createdAt))
    .limit(1);
  if (!score) { res.status(404).json({ error: "No health score yet" }); return; }
  res.json(score);
});

router.get("/health-score/history", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const scores = await db.select().from(healthScoresTable)
    .where(eq(healthScoresTable.userId, userId))
    .orderBy(desc(healthScoresTable.scoreDate))
    .limit(12);
  res.json(scores);
});

router.post("/health-score", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;

  // Fetch all needed data in parallel
  const [
    [lastBudget],
    goals,
    steps,
    assets,
    liabilities,
    [profile],
  ] = await Promise.all([
    db.select().from(budgetEntriesTable)
      .where(eq(budgetEntriesTable.userId, userId))
      .orderBy(desc(budgetEntriesTable.periodMonth)).limit(1),
    db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId)),
    db.select().from(pathwayProgressTable).where(eq(pathwayProgressTable.userId, userId)),
    db.select().from(assetsTable).where(eq(assetsTable.userId, userId)),
    db.select().from(liabilitiesTable).where(eq(liabilitiesTable.userId, userId)),
    db.select().from(profilesTable).where(eq(profilesTable.id, userId)),
  ]);

  // ── Shared values ──────────────────────────────────────────────────────────
  // Income: only from latest budget entry — pathway formData is not used as a fallback
  const income = lastBudget ? parseFloat(lastBudget.income ?? "0") : 0;
  const expenseKeys = ["housing", "food", "transport", "utilities", "entertainment", "other"] as const;
  const totalExpenses = lastBudget
    ? expenseKeys.reduce((s, k) => s + parseFloat((lastBudget as any)[k] ?? "0"), 0)
    : 0;
  const monthlyCashSaved = Math.max(0, income - totalExpenses);

  const totalAssetsVal = assets.reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const totalLiabVal = liabilities.reduce((s, l) => s + parseFloat(l.balanceUsd ?? "0"), 0);

  const savingsBal = parseFloat(profile?.totalSavings ?? "0");
  const investBal = parseFloat(profile?.totalInvestments ?? "0");
  const savRatePct = parseFloat(profile?.savingsRatePercent ?? "4.0");
  const invRatePct = parseFloat(profile?.investmentRatePercent ?? "7.0");

  // Net worth: prefer categorised asset rows; fall back to profile totals
  // Cash + Savings categories both count toward the savings/emergency-fund balance
  const assetsSavingsVal = assets
    .filter(a => a.category === "savings" || a.category === "cash")
    .reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const assetsInvestVal = assets
    .filter(a => (a as any).category === "investment")
    .reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const effectiveSavingsBal = assetsSavingsVal > 0 ? assetsSavingsVal : savingsBal;
  const effectiveInvestBal = assetsInvestVal > 0 ? assetsInvestVal : investBal;
  const effectiveTotalAssets = totalAssetsVal > 0 ? totalAssetsVal : (effectiveSavingsBal + effectiveInvestBal);
  const netWorth = effectiveTotalAssets - totalLiabVal;
  const hasNetWorthData = effectiveTotalAssets > 0 || totalLiabVal > 0;

  // ── Component 1: Effective Savings Rate (25 pts) ──────────────────────────
  // effective_monthly_gain = cash_saved + savings_interest + investment_gain
  // Use effective balances (asset rows preferred, profile totals as fallback)
  const monthlyInterest = effectiveSavingsBal * (savRatePct / 100 / 12);
  const monthlyInvestGain = effectiveInvestBal * (invRatePct / 100 / 12);
  const effectiveMonthlyGain = monthlyCashSaved + monthlyInterest + monthlyInvestGain;
  const effectiveSavingsRate = income > 0 ? (effectiveMonthlyGain / income) * 100 : 0;
  const savingsScore = scoreEffectiveSavingsRate(effectiveSavingsRate);

  // ── Component 2: Goal on-track via dynamic projection (25 pts) ────────────
  let goalsScore = 0;
  if (goals.length > 0) {
    const topGoal = goals[0];
    // current_amount = goal progress + savings principal + investment principal (same as frontend
    // free-tier model — see the tier note in @workspace/goal-math for why this doesn't apply
    // to the investment-client tier's currentAmount semantics)
    const goalCurrentAmt = parseFloat(topGoal.currentAmount ?? "0");
    const effectiveCurrentAmt = goalCurrentAmt + effectiveSavingsBal + effectiveInvestBal;
    const targetAmt = parseFloat(topGoal.targetAmount ?? "0");

    if (topGoal.targetDate && targetAmt > 0) {
      const { projectedAmount } = calculateProjection({
        currentAmount: effectiveCurrentAmt,
        targetAmount: targetAmt,
        targetDate: topGoal.targetDate,
        monthlyCashSaved,
        savingsBalance: effectiveSavingsBal,
        savingsRatePercent: savRatePct,
        investmentValue: effectiveInvestBal,
        investmentRatePercent: invRatePct,
      });
      goalsScore = scoreGoalProjection(projectedAmount, targetAmt, true);
    } else {
      // No target date set — use stored status as fallback
      if (topGoal.status === "on_track" || topGoal.status === "achieved") goalsScore = 25;
      else if (topGoal.status === "almost") goalsScore = 15;
      else goalsScore = 5;
    }
  }

  // ── Component 3: Net worth trend (20 pts) ─────────────────────────────────
  const netWorthScore = scoreNetWorth(netWorth, hasNetWorthData);

  // ── Component 4: Wealth growth rate (20 pts) ──────────────────────────────
  // wealth_growth_rate = total_annual_wealth_growth / net_worth × 100
  const annualCashSavings = monthlyCashSaved * 12;
  const annualInterest = savingsBal * (savRatePct / 100);
  const annualInvestGain = investBal * (invRatePct / 100);
  const totalAnnualGrowth = annualCashSavings + annualInterest + annualInvestGain;
  const wealthGrowthRate = netWorth > 0 ? (totalAnnualGrowth / netWorth) * 100 : 0;
  const wealthGrowthScore = scoreWealthGrowthRate(wealthGrowthRate);

  // ── Component 5: Plan completion (10 pts) ─────────────────────────────────
  const completedSteps = steps.filter(s => s.status === "completed").length;
  const planScore = Math.min(10, Math.round((completedSteps / 6) * 10));

  // ── Clamp each component to its maximum ───────────────────────────────────
  const savingsScoreFinal  = Math.min(25, Math.max(0, savingsScore));
  const goalsScoreFinal    = Math.min(25, Math.max(0, goalsScore));
  const netWorthScoreFinal = Math.min(20, Math.max(0, netWorthScore));
  const wealthScoreFinal   = Math.min(20, Math.max(0, wealthGrowthScore));
  const planScoreFinal     = Math.min(10, Math.max(0, planScore));

  // ── Overall (hard cap 100) ─────────────────────────────────────────────────
  const overall = Math.min(100,
    savingsScoreFinal + goalsScoreFinal + netWorthScoreFinal + wealthScoreFinal + planScoreFinal,
  );

  const goalsOnTrack = goals.filter(g => g.status === "on_track" || g.status === "achieved").length;

  const today = new Date().toISOString().split("T")[0];
  const [score] = await db.insert(healthScoresTable).values({
    userId,
    scoreDate: today,
    overallScore: overall,
    savingsScore: savingsScoreFinal,
    budgetScore: savingsScoreFinal,
    goalsScore: goalsScoreFinal,
    netWorthScore: netWorthScoreFinal,
    insights: {
      effectiveSavingsRate: Math.round(effectiveSavingsRate * 10) / 10,
      wealthGrowthRate: Math.round(wealthGrowthRate * 10) / 10,
      wealthGrowthScore: wealthScoreFinal,
      completedSteps,
      netWorth: Math.round(netWorth),
      goalsOnTrack,
    },
  }).returning();
  res.json(score);
});

export default router;
