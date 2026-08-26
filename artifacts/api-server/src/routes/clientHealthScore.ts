import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db, healthScoresTable, clientBudgetMonthsTable, clientHoldingsTable,
  advisedPlansTable, financialGoalsTable, assetsTable, liabilitiesTable, profilesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveBlendedRate } from "../lib/blendedRate";
import { computeCurrentBreakdown } from "../lib/goalProgressSnapshot";

const router: IRouter = Router();

// Investment-client wealth score. Deliberately NOT the same formula as the
// free-tier POST /health-score (healthscore.ts): that route reads
// budget_entries (free tier's budget table); this reads client_budget_months,
// advised_plans, and client_holdings instead.
//
// Five weighted dimensions, each 0-100 before weighting:
//   - Savings Consistency (25%): % of the last 3 months with a budget entry
//     whose net_surplus > 0.
//   - Investment Growth (25%): (current value − net contribution) / net
//     contribution across advised plans + self-tracked holdings, capped 0-100.
//   - Goal Progress (20%): average current/target % across active goals with
//     a target amount, funded by goal_holding_links.
//   - Debt-to-Asset Ratio (20%): 100 − (liabilities / assets × 100).
//   - Budget Surplus (10%): average savings_rate_pct over the last 3 months.
const WEIGHTS = { savingsConsistency: 0.25, investmentGrowth: 0.25, goalProgress: 0.20, debtToAsset: 0.20, budgetSurplus: 0.10 };
const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

const TICKER_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "commodity", "bond"]);
function holdingCostBasis(h: typeof clientHoldingsTable.$inferSelect): number {
  if (TICKER_TYPES.has(h.holdingType) || h.holdingType === "crypto") {
    return (parseFloat(h.unitsHeld ?? "0") || 0) * (parseFloat(h.averageCostPrice ?? "0") || 0);
  }
  if (h.holdingType === "property") return parseFloat(h.purchasePrice ?? "0") || 0;
  if (h.holdingType === "cash") return parseFloat(h.currentBalance ?? "0") || 0;
  if (h.holdingType === "pension") return parseFloat(h.currentBalancePension ?? "0") || 0;
  return (parseFloat(h.totalInvestedOther ?? "0") || 0) || (parseFloat(h.currentValueOther ?? "0") || 0);
}

router.get("/client/health-score", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;

  const [profile] = await db.select({ createdAt: profilesTable.createdAt }).from(profilesTable).where(eq(profilesTable.id, userId));
  const monthsActive = profile
    ? (Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    : 0;
  if (monthsActive < 3) { res.json({ gated: true, monthsActive: Math.round(monthsActive * 10) / 10 }); return; }

  const today = new Date().toISOString().slice(0, 10);
  const [existingToday] = await db.select().from(healthScoresTable)
    .where(and(eq(healthScoresTable.userId, userId), eq(healthScoresTable.scoreDate, today)))
    .orderBy(desc(healthScoresTable.createdAt))
    .limit(1);
  if (existingToday?.details) { res.json({ ...existingToday, gated: false }); return; }

  const [budgetMonths, holdings, plans, goals, assets, liabilities] = await Promise.all([
    db.select().from(clientBudgetMonthsTable)
      .where(eq(clientBudgetMonthsTable.userId, userId))
      .orderBy(desc(clientBudgetMonthsTable.month)).limit(3),
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

  // ── Savings Consistency ───────────────────────────────────────────────
  const consistentMonths = budgetMonths.filter(m => (parseFloat(m.netSurplus ?? "0") || 0) > 0).length;
  const savingsConsistency = clamp((consistentMonths / 3) * 100);

  // ── Investment Growth ──────────────────────────────────────────────────
  const inforcePlans = plans.filter(p => p.status === "inforce");
  const { totalValue: currentValue } = await resolveBlendedRate(userId);
  const totalNetContribution = inforcePlans.reduce((s, p) => s + (parseFloat(p.latestNetContribution ?? "0") || 0), 0)
    + holdings.reduce((s, h) => s + holdingCostBasis(h), 0);
  const investmentGrowth = totalNetContribution > 0
    ? clamp(((currentValue - totalNetContribution) / totalNetContribution) * 100)
    : (currentValue > 0 ? 100 : 0);

  // ── Goal Progress ──────────────────────────────────────────────────────
  const scorableGoals = activeGoals.filter(g => g.targetAmount && parseFloat(g.targetAmount) > 0);
  let goalProgress = 0;
  if (scorableGoals.length > 0) {
    const pcts = await Promise.all(scorableGoals.map(async g => {
      const { computedCurrentAmount } = await computeCurrentBreakdown(userId, g.id);
      return clamp((computedCurrentAmount / parseFloat(g.targetAmount!)) * 100);
    }));
    goalProgress = pcts.reduce((s, p) => s + p, 0) / pcts.length;
  }

  // ── Debt-to-Asset Ratio ────────────────────────────────────────────────
  const totalAssets = currentValue + assets.reduce((s, a) => s + (parseFloat(a.valueUsd ?? "0") || 0), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + (parseFloat(l.balanceUsd ?? "0") || 0), 0);
  const debtToAsset = totalAssets > 0 ? clamp(100 - (totalLiabilities / totalAssets) * 100) : 100;

  // ── Budget Surplus ─────────────────────────────────────────────────────
  const budgetSurplus = budgetMonths.length > 0
    ? clamp(budgetMonths.reduce((s, m) => s + (parseFloat(m.savingsRatePct ?? "0") || 0), 0) / budgetMonths.length)
    : 0;

  const overallScore = Math.round(
    savingsConsistency * WEIGHTS.savingsConsistency
    + investmentGrowth * WEIGHTS.investmentGrowth
    + goalProgress * WEIGHTS.goalProgress
    + debtToAsset * WEIGHTS.debtToAsset
    + budgetSurplus * WEIGHTS.budgetSurplus,
  );

  const details = {
    weights: WEIGHTS,
    dimensions: {
      savingsConsistency: Math.round(savingsConsistency),
      investmentGrowth: Math.round(investmentGrowth),
      goalProgress: Math.round(goalProgress),
      debtToAsset: Math.round(debtToAsset),
      budgetSurplus: Math.round(budgetSurplus),
    },
  };

  const values = {
    userId,
    scoreDate: today,
    overallScore,
    savingsScore: Math.round(savingsConsistency),
    goalsScore: Math.round(goalProgress),
    netWorthScore: Math.round(investmentGrowth),
    budgetScore: Math.round(budgetSurplus),
    debtToAssetScore: Math.round(debtToAsset),
    details,
  };

  let score;
  if (existingToday) {
    [score] = await db.update(healthScoresTable).set(values).where(eq(healthScoresTable.id, existingToday.id)).returning();
  } else {
    [score] = await db.insert(healthScoresTable).values(values).returning();
  }

  res.json({ ...score, gated: false });
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
