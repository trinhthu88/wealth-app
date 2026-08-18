import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, financialGoalsTable, profilesTable, goalHoldingLinksTable } from "@workspace/db";
import { requireAuth, requireRole, requireAdvisorOwnsClient } from "../middlewares/requireAuth";

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

  // Enforce 1-goal limit for free users
  const [[profile], existing] = await Promise.all([
    db.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, userId)),
    db.select({ id: financialGoalsTable.id }).from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId)),
  ]);
  if (profile?.role === "free_user" && existing.length >= 1) {
    res.status(403).json({ error: "Free users can only have 1 goal. Upgrade to Investment Client to unlock unlimited goals." });
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

// Apply monthly savings + investment growth to the goal's currentAmount
router.post("/goals/auto-update", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { goalId, newCurrentAmount } = req.body;
  if (!goalId || newCurrentAmount === undefined) {
    res.status(400).json({ error: "goalId and newCurrentAmount required" });
    return;
  }
  const [updated] = await db.update(financialGoalsTable).set({
    currentAmount: String(newCurrentAmount),
    updatedAt: new Date(),
  }).where(and(eq(financialGoalsTable.id, goalId), eq(financialGoalsTable.userId, userId))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// Upsert the single pathway goal: update first existing goal, or create if none.
// Also de-duplicates: any extra goals beyond the first are deleted.
router.post("/goals/upsert-from-pathway", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { title, goalType, targetAmount, targetDate, currency } = req.body;
  if (!title || !goalType) { res.status(400).json({ error: "title and goalType required" }); return; }

  const existing = await db.select().from(financialGoalsTable)
    .where(eq(financialGoalsTable.userId, userId));

  if (existing.length > 0) {
    // Delete duplicates beyond the first
    for (const dup of existing.slice(1)) {
      await db.delete(financialGoalsTable).where(eq(financialGoalsTable.id, dup.id));
    }
    const [updated] = await db.update(financialGoalsTable).set({
      title, goalType,
      targetAmount: targetAmount?.toString() ?? null,
      targetDate: targetDate ?? null,
      currency: currency ?? "USD",
      updatedAt: new Date(),
    }).where(eq(financialGoalsTable.id, existing[0].id)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(financialGoalsTable).values({
      userId, title, goalType,
      targetAmount: targetAmount?.toString() ?? null,
      currentAmount: "0",
      monthlyContribution: "0",
      targetDate: targetDate ?? null,
      currency: currency ?? "USD",
      priority: "medium",
      status: "on_track",
    }).returning();
    res.status(201).json(created);
  }
});

router.get("/advisor/clients/:id/goals", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClient("id"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const goals = await db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, rawId));
  res.json(goals);
});

// ── Goal holding links ────────────────────────────────────────────────────────
router.get("/client/goals/:id/links", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const goalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const links = await db.select().from(goalHoldingLinksTable)
      .where(and(eq(goalHoldingLinksTable.goalId, goalId), eq(goalHoldingLinksTable.userId, userId)));
    res.json(links);
  } catch {
    res.json([]); // gracefully degrade if table doesn't exist yet
  }
});

router.post("/client/goals/:id/links", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const goalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { sourceType, sourceId, allocationPct } = req.body;
  if (!sourceType || !sourceId) { res.status(400).json({ error: "sourceType and sourceId required" }); return; }
  try {
    const [link] = await db.insert(goalHoldingLinksTable).values({
      goalId, userId, sourceType, sourceId, allocationPct: String(allocationPct ?? 100),
    }).returning();
    res.status(201).json(link);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "This investment is already linked to this goal." });
    } else if (err?.message?.includes("does not exist")) {
      res.status(503).json({ error: "Goal linking requires a database migration. Please run the SQL migration first." });
    } else {
      res.status(500).json({ error: "Failed to link holding" });
    }
  }
});

router.delete("/client/goals/links/:linkId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const linkId = Array.isArray(req.params.linkId) ? req.params.linkId[0] : req.params.linkId;
  try {
    await db.delete(goalHoldingLinksTable)
      .where(and(eq(goalHoldingLinksTable.id, linkId), eq(goalHoldingLinksTable.userId, userId)));
    res.sendStatus(204);
  } catch {
    res.sendStatus(204); // graceful degrade
  }
});

// Patch goal status (mark complete / pause / reopen)
router.patch("/goals/:id/status", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status } = req.body;
  const allowed = ["active", "completed", "paused", "cancelled"];
  if (!allowed.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
  const [updated] = await db.update(financialGoalsTable).set({ status, updatedAt: new Date() })
    .where(and(eq(financialGoalsTable.id, rawId), eq(financialGoalsTable.userId, userId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
