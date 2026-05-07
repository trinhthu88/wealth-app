import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, financialPlansTable, planMilestonesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/plans", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const plans = await db.select().from(financialPlansTable)
    .where(or(eq(financialPlansTable.clientId, userId), eq(financialPlansTable.advisorId, userId)));
  res.json(plans);
});

router.get("/plans/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [plan] = await db.select().from(financialPlansTable).where(eq(financialPlansTable.id, rawId));
  if (!plan) { res.status(404).json({ error: "Not found" }); return; }
  res.json(plan);
});

router.put("/plans/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, status, planData, nextReviewDate } = req.body;
  const [updated] = await db.update(financialPlansTable).set({
    title, status, planData: planData ?? null, nextReviewDate: nextReviewDate ?? null, updatedAt: new Date(),
  }).where(eq(financialPlansTable.id, rawId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.get("/plans/:id/milestones", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  res.json(await db.select().from(planMilestonesTable).where(eq(planMilestonesTable.planId, rawId)));
});

router.post("/plans/:id/milestones", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, targetDate, status, notes } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const [m] = await db.insert(planMilestonesTable).values({
    planId: rawId as any, title, targetDate: targetDate ?? null, status: status ?? "upcoming", notes: notes ?? null,
  }).returning();
  res.status(201).json(m);
});

router.get("/advisor/clients/:id/plan", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [plan] = await db.select().from(financialPlansTable).where(eq(financialPlansTable.clientId, rawId));
  if (!plan) { res.status(404).json({ error: "No plan" }); return; }
  res.json(plan);
});

router.post("/advisor/clients/:id/plan", requireAuth, async (req, res): Promise<void> => {
  const advisorId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, status, planData, nextReviewDate } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const [plan] = await db.insert(financialPlansTable).values({
    clientId: rawId, advisorId, title, status: status ?? "draft",
    planData: planData ?? null, nextReviewDate: nextReviewDate ?? null,
  }).returning();
  res.status(201).json(plan);
});

export default router;
