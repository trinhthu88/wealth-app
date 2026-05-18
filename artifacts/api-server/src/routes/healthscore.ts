import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db, healthScoresTable, budgetEntriesTable, financialGoalsTable,
  pathwayProgressTable, assetsTable, liabilitiesTable, profilesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/health-score", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [score] = await db.select().from(healthScoresTable)
    .where(eq(healthScoresTable.userId, userId))
    .orderBy(desc(healthScoresTable.scoreDate))
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

  const [lastBudget] = await db.select().from(budgetEntriesTable)
    .where(eq(budgetEntriesTable.userId, userId))
    .orderBy(desc(budgetEntriesTable.periodMonth)).limit(1);

  const goals = await db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId));
  const steps = await db.select().from(pathwayProgressTable).where(eq(pathwayProgressTable.userId, userId));
  const assets = await db.select().from(assetsTable).where(eq(assetsTable.userId, userId));
  const liabilities = await db.select().from(liabilitiesTable).where(eq(liabilitiesTable.userId, userId));
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));

  // ── Component 1: Savings rate (25 pts max) ──────────────────────────────────
  const income = lastBudget ? parseFloat(lastBudget.income ?? "0") : 0;
  const expenses = lastBudget
    ? ["housing", "food", "transport", "utilities", "entertainment", "other"]
        .reduce((s, k) => s + parseFloat((lastBudget as any)[k] ?? "0"), 0)
    : 0;
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
  const savingsScore = Math.min(25, Math.round((savingsRate / 20) * 25));

  // ── Component 2: Goal on-track status (25 pts max) ─────────────────────────
  let goalsScore = 0;
  if (goals.length > 0) {
    const topGoal = goals[0];
    if (topGoal.status === "on_track" || topGoal.status === "achieved") goalsScore = 25;
    else if (topGoal.status === "almost") goalsScore = 15;
    else goalsScore = 5;
  }
  goalsScore = Math.min(25, goalsScore);

  // ── Component 3: Net worth trend (20 pts max) ─────────────────────────────
  const totalAssetsVal = assets.reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const totalLiabVal = liabilities.reduce((s, l) => s + parseFloat(l.balanceUsd ?? "0"), 0);
  const netWorth = totalAssetsVal - totalLiabVal;
  let netWorthScore = 0;
  if (totalAssetsVal > 0 || totalLiabVal > 0) {
    if (netWorth > 0 && totalLiabVal === 0) netWorthScore = 20;
    else if (netWorth > 0) netWorthScore = 15;
    else if (netWorth === 0) netWorthScore = 8;
    else netWorthScore = 3;
  }
  netWorthScore = Math.min(20, netWorthScore);

  // ── Component 4: Wealth growth rate (20 pts max) ──────────────────────────
  const totalSavingsBal = parseFloat(profile?.totalSavings ?? "0");
  const totalInvestBal = parseFloat(profile?.totalInvestments ?? "0");
  const savRatePct = parseFloat(profile?.savingsRatePercent ?? "4.0");
  const invRatePct = parseFloat(profile?.investmentRatePercent ?? "7.0");
  const monthlyGrowth = totalSavingsBal * (savRatePct / 100 / 12) + totalInvestBal * (invRatePct / 100 / 12);
  let wealthGrowthScore = 0;
  if (totalSavingsBal > 0 || totalInvestBal > 0) {
    const growthPct = income > 0 ? (monthlyGrowth / income) * 100 : 0;
    wealthGrowthScore = Math.min(20, Math.round((growthPct / 3) * 20));
  }
  wealthGrowthScore = Math.min(20, wealthGrowthScore);

  // ── Component 5: Plan completion (10 pts max) ─────────────────────────────
  const completedSteps = steps.filter(s => s.status === "completed").length;
  const planScore = Math.min(10, Math.round((completedSteps / 6) * 10));

  // ── Overall (hard cap 100) ──────────────────────────────────────────────────
  const overall = Math.min(100,
    Math.min(25, savingsScore) +
    Math.min(25, goalsScore) +
    Math.min(20, netWorthScore) +
    Math.min(20, wealthGrowthScore) +
    Math.min(10, planScore),
  );

  const goalsOnTrack = goals.filter(g => g.status === "on_track" || g.status === "achieved").length;
  const today = new Date().toISOString().split("T")[0];
  const [score] = await db.insert(healthScoresTable).values({
    userId,
    scoreDate: today,
    overallScore: overall,
    budgetScore: savingsScore,
    goalsScore,
    netWorthScore,
    savingsScore,
    insights: { savingsRate, completedSteps, goalsOnTrack },
  }).returning();
  res.json(score);
});

export default router;
