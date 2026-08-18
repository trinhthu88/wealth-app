import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, financialPlansTable, planMilestonesTable } from "@workspace/db";
import { requireAuth, requireRole, requireAdvisorOwnsClient, isSuperAdmin } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/plans", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const plans = await db.select().from(financialPlansTable)
    .where(or(eq(financialPlansTable.clientId, userId), eq(financialPlansTable.advisorId, userId)));
  res.json(plans);
});

router.get("/plans/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [plan] = await db.select().from(financialPlansTable).where(eq(financialPlansTable.id, rawId));
  if (!plan) { res.status(404).json({ error: "Not found" }); return; }
  if (plan.clientId !== userId && plan.advisorId !== userId && !(await isSuperAdmin(userId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(plan);
});

router.put("/plans/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [existing] = await db.select().from(financialPlansTable).where(eq(financialPlansTable.id, rawId));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.advisorId !== userId && !(await isSuperAdmin(userId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { title, status, planData, nextReviewDate } = req.body;
  const [updated] = await db.update(financialPlansTable).set({
    title, status, planData: planData ?? null, nextReviewDate: nextReviewDate ?? null, updatedAt: new Date(),
  }).where(eq(financialPlansTable.id, rawId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.get("/plans/:id/milestones", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [plan] = await db.select().from(financialPlansTable).where(eq(financialPlansTable.id, rawId));
  if (!plan) { res.status(404).json({ error: "Not found" }); return; }
  if (plan.clientId !== userId && plan.advisorId !== userId && !(await isSuperAdmin(userId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(await db.select().from(planMilestonesTable).where(eq(planMilestonesTable.planId, rawId)));
});

router.post("/plans/:id/milestones", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [plan] = await db.select().from(financialPlansTable).where(eq(financialPlansTable.id, rawId));
  if (!plan) { res.status(404).json({ error: "Not found" }); return; }
  if (plan.advisorId !== userId && !(await isSuperAdmin(userId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { title, targetDate, status, notes } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const [m] = await db.insert(planMilestonesTable).values({
    planId: rawId as any, title, targetDate: targetDate ?? null, status: status ?? "upcoming", notes: notes ?? null,
  }).returning();
  res.status(201).json(m);
});

router.get("/advisor/clients/:id/plan", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClient("id"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [plan] = await db.select().from(financialPlansTable).where(eq(financialPlansTable.clientId, rawId));
  if (!plan) { res.status(404).json({ error: "No plan" }); return; }
  res.json(plan);
});

router.post("/advisor/clients/:id/plan", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClient("id"), async (req, res): Promise<void> => {
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
