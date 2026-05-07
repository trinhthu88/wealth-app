import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, healthScoresTable, budgetEntriesTable, financialGoalsTable, pathwayProgressTable } from "@workspace/db";
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

router.post("/health-score", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [lastBudget] = await db.select().from(budgetEntriesTable)
    .where(eq(budgetEntriesTable.userId, userId))
    .orderBy(desc(budgetEntriesTable.periodMonth)).limit(1);
  const goals = await db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId));
  const steps = await db.select().from(pathwayProgressTable).where(eq(pathwayProgressTable.userId, userId));

  const savingsRate = lastBudget?.savingsRatePercent ? parseFloat(lastBudget.savingsRatePercent) : 0;
  const budgetScore = Math.min(100, Math.round((savingsRate / 20) * 100));
  const completedSteps = steps.filter(s => s.status === "completed").length;
  const planScore = Math.round((completedSteps / 6) * 100);
  const goalsOnTrack = goals.filter(g => g.status === "on_track" || g.status === "achieved").length;
  const goalsScore = goals.length > 0 ? Math.round((goalsOnTrack / goals.length) * 100) : 0;
  const netWorthScore = 60;
  const overall = Math.round((budgetScore + planScore + goalsScore + netWorthScore) / 4);

  const today = new Date().toISOString().split("T")[0];
  const [score] = await db.insert(healthScoresTable).values({
    userId, scoreDate: today, overallScore: overall,
    budgetScore, goalsScore, netWorthScore, savingsScore: budgetScore,
    insights: { savingsRate, completedSteps, goalsOnTrack },
  }).returning();
  res.json(score);
});

export default router;
