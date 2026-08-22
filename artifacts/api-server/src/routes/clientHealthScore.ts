import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db, healthScoresTable, clientBudgetMonthsTable, clientHoldingsTable,
  advisedPlansTable, financialGoalsTable, assetsTable, liabilitiesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { computeGoalProgress } from "@workspace/goal-math";
import { scoreNetWorth } from "./healthscore";
import { resolveBlendedRate } from "../lib/blendedRate";
import { computeCurrentBreakdown } from "../lib/goalProgressSnapshot";

const router: IRouter = Router();

// Investment-client health score. Deliberately NOT the same formula as the
// free-tier POST /health-score (healthscore.ts): that route reads
// budget_entries (free tier's budget table) and the forward-compounding
// calculateProjection model, both wrong for this tier — see the tier note in
// @workspace/goal-math. This reads client_budget_months and scores goals via
// the elapsed-time computeGoalProgress model instead.
//
// Four components, each already 0-100 (not the free tier's 25/25/20/20/10
// point scale) so the frontend never has to know a max to display a percentage:
//   - Contribution consistency: this month's savings rate (income − expenses −
//     investment contributions, as a % of income), from the latest
//     client_budget_months row.
//   - Goal funding: pacing status (computeGoalProgress) across active goals
//     with a target amount + date, funded by goal_holding_links.
//   - Diversification: net worth score, reusing scoreNetWorth's existing
//     0-100 curve, unchanged from the free-tier formula — net worth magnitude
//     doesn't need a tier-specific model.
//   - Cash resilience: emergency-fund coverage in months of expenses (cash
//     holdings ÷ latest month's expenses) — a real metric, not a copy of
//     contribution consistency (see the budgetScore bug in healthscore.ts).

function scoreContributionConsistency(savingsRatePct: number): number {
  if (savingsRatePct >= 25) return 100;
  if (savingsRatePct >= 20) return 88;
  if (savingsRatePct >= 15) return 72;
  if (savingsRatePct >= 10) return 48;
  if (savingsRatePct >= 5) return 24;
  return 0;
}

function scoreCashResilience(monthsCoverage: number): number {
  if (monthsCoverage >= 6) return 100;
  if (monthsCoverage >= 3) return 72;
  if (monthsCoverage >= 1) return 40;
  if (monthsCoverage > 0) return 20;
  return 0;
}

router.get("/client/health-score", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;

  const today = new Date().toISOString().slice(0, 10);
  const [existingToday] = await db.select().from(healthScoresTable)
    .where(and(eq(healthScoresTable.userId, userId), eq(healthScoresTable.scoreDate, today)))
    .orderBy(desc(healthScoresTable.createdAt))
    .limit(1);
  if (existingToday) { res.json(existingToday); return; }

  const [budgetMonths, holdings, plans, goals, assets, liabilities] = await Promise.all([
    db.select().from(clientBudgetMonthsTable)
      .where(eq(clientBudgetMonthsTable.userId, userId))
      .orderBy(desc(clientBudgetMonthsTable.month)).limit(1),
    db.select().from(clientHoldingsTable)
      .where(and(eq(clientHoldingsTable.userId, userId), eq(clientHoldingsTable.isActive, true))),
    db.select().from(advisedPlansTable).where(eq(advisedPlansTable.userId, userId)),
    db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId)),
    db.select().from(assetsTable).where(eq(assetsTable.userId, userId)),
    db.select().from(liabilitiesTable).where(eq(liabilitiesTable.userId, userId)),
  ]);

  const activeGoals = goals.filter(g => g.status !== "completed" && g.status !== "cancelled");
  const hasAnyData = budgetMonths.length > 0 || activeGoals.length > 0 || holdings.length > 0 || plans.length > 0;
  if (!hasAnyData) { res.json(null); return; }

  const lastBudget = budgetMonths[0] ?? null;

  // ── Contribution consistency ────────────────────────────────────────────
  const savingsRatePct = lastBudget ? parseFloat(lastBudget.savingsRatePct ?? "0") || 0 : 0;
  const savingsScore = scoreContributionConsistency(savingsRatePct);

  // ── Goal funding — pacing status per goal, funded by goal_holding_links ──
  const scorableGoals = activeGoals.filter(g => g.targetAmount && parseFloat(g.targetAmount) > 0 && g.targetDate);
  let goalsScore = 0;
  if (scorableGoals.length > 0) {
    const statuses = await Promise.all(scorableGoals.map(async g => {
      const { computedCurrentAmount } = await computeCurrentBreakdown(userId, g.id);
      return computeGoalProgress({
        currentAmount: computedCurrentAmount,
        targetAmount: parseFloat(g.targetAmount!),
        targetDate: g.targetDate,
        createdAt: g.createdAt.toISOString(),
      }).status;
    }));
    if (statuses.some(s => s === "off_track")) goalsScore = 20;
    else if (statuses.some(s => s === "at_risk")) goalsScore = 60;
    else goalsScore = 100;
  }

  // ── Diversification (net worth) ─────────────────────────────────────────
  const { totalValue: portfolioValue } = await resolveBlendedRate(userId);
  const totalAssets = assets.reduce((s, a) => s + (parseFloat(a.valueUsd ?? "0") || 0), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + (parseFloat(l.balanceUsd ?? "0") || 0), 0);
  const netWorth = portfolioValue + totalAssets - totalLiabilities;
  const hasNetWorthData = portfolioValue > 0 || totalAssets > 0 || totalLiabilities > 0;
  const netWorthScoreRaw = scoreNetWorth(netWorth, hasNetWorthData); // 0-20 scale
  const netWorthScore = Math.round((netWorthScoreRaw / 20) * 100);

  // ── Cash resilience — emergency-fund coverage in months of expenses ─────
  const cashBalance = holdings
    .filter(h => h.holdingType === "cash")
    .reduce((s, h) => s + (parseFloat(h.currentBalance ?? "0") || 0), 0);
  const monthlyExpenses = lastBudget ? parseFloat(lastBudget.totalExpenses ?? "0") || 0 : 0;
  const monthsCoverage = monthlyExpenses > 0 ? cashBalance / monthlyExpenses : 0;
  const budgetScore = scoreCashResilience(monthsCoverage);

  const overallScore = Math.round((savingsScore + goalsScore + netWorthScore + budgetScore) / 4);

  const [score] = await db.insert(healthScoresTable).values({
    userId,
    scoreDate: today,
    overallScore,
    savingsScore,
    goalsScore,
    netWorthScore,
    budgetScore,
    insights: {
      savingsRatePct: Math.round(savingsRatePct * 10) / 10,
      monthsCashCoverage: Math.round(monthsCoverage * 10) / 10,
      netWorth: Math.round(netWorth),
      portfolioValue: Math.round(portfolioValue),
      goalsScored: scorableGoals.length,
    },
  }).returning();

  res.json(score);
});

router.get("/client/health-score/history", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const scores = await db.select().from(healthScoresTable)
    .where(eq(healthScoresTable.userId, userId))
    .orderBy(desc(healthScoresTable.scoreDate))
    .limit(12);
  res.json(scores);
});

export default router;
