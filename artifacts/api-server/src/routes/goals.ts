import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, financialGoalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/goals", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const goals = await db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId));
  res.json(goals);
});

router.post("/goals", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { title, goalType, targetAmount, currentAmount, monthlyContribution, targetDate, currency, priority, status, notes } = req.body;
  if (!title || !goalType) {
    res.status(400).json({ error: "title and goalType required" });
    return;
  }
  const [goal] = await db.insert(financialGoalsTable).values({
    userId, title, goalType,
    targetAmount: targetAmount?.toString() ?? null,
    currentAmount: currentAmount?.toString() ?? "0",
    monthlyContribution: monthlyContribution?.toString() ?? "0",
    targetDate: targetDate ?? null, currency: currency ?? "USD",
    priority: priority ?? "medium", status: status ?? "on_track", notes: notes ?? null,
  }).returning();
  res.status(201).json(goal);
});

router.put("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, goalType, targetAmount, currentAmount, monthlyContribution, targetDate, currency, priority, status, notes } = req.body;
  const [updated] = await db.update(financialGoalsTable).set({
    title, goalType, targetAmount: targetAmount?.toString() ?? null,
    currentAmount: currentAmount?.toString() ?? "0",
    monthlyContribution: monthlyContribution?.toString() ?? "0",
    targetDate: targetDate ?? null, currency, priority, status, notes, updatedAt: new Date(),
  }).where(and(eq(financialGoalsTable.id, rawId), eq(financialGoalsTable.userId, userId))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(financialGoalsTable).where(and(eq(financialGoalsTable.id, rawId), eq(financialGoalsTable.userId, userId)));
  res.sendStatus(204);
});

router.get("/advisor/clients/:id/goals", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const goals = await db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, rawId));
  res.json(goals);
});

export default router;
