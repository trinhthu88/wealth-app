import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, asc, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, financialGoalsTable, profilesTable, goalHoldingLinksTable } from "@workspace/db";
import { requireAuth, requireRole, requireAdvisorOwnsClient, requireAdvisorOwnsLead, checkAllowanceFor } from "../middlewares/requireAuth";
import { getRemainingPct } from "../lib/goalAllocation";
import { computeGoalFundingSummary, getProgressMovement } from "../lib/goalProgressSnapshot";
import { ensureOffTrackTask } from "../lib/offTrackTasks";
import { runCheckpointHook } from "../lib/checkpointEngine";

const router: IRouter = Router();

const clientGoalStatusSchema = z.enum(["active", "completed", "cancelled"]);
const amountInputSchema = z.union([
  z.number().finite().nonnegative(),
  z.string().trim().min(1).refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, "Must be a non-negative amount"),
  z.null(),
]).optional();
const targetDateInputSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  })
  .nullable()
  .optional();
const createGoalBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  goalType: z.string().trim().min(1).max(80),
  targetAmount: amountInputSchema,
  currentAmount: amountInputSchema,
  monthlyContribution: amountInputSchema,
  targetDate: targetDateInputSchema,
  currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  status: z.literal("active").optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict();

function goalInsertValues(
  userId: string,
  goal: z.infer<typeof createGoalBodySchema>,
  status: "active" | "draft",
) {
  return {
    userId,
    title: goal.title,
    goalType: goal.goalType,
    targetAmount: goal.targetAmount == null ? null : String(goal.targetAmount),
    currentAmount: goal.currentAmount == null ? "0" : String(goal.currentAmount),
    monthlyContribution: goal.monthlyContribution == null ? "0" : String(goal.monthlyContribution),
    targetDate: goal.targetDate ?? null,
    currency: goal.currency ?? "USD",
    priority: goal.priority ?? "medium",
    status,
    notes: goal.notes ?? null,
  };
}

// A finished goal does not use a slot, so turning one back to active has to pass the
// same cap as creating one; otherwise completing and reopening would bypass it.
async function reactivationAllowed(req: Request, res: Response, goalId: string, userId: string, nextStatus: unknown): Promise<boolean> {
  if (nextStatus !== "active") return true;
  const [current] = await db.select({ status: financialGoalsTable.status }).from(financialGoalsTable)
    .where(and(eq(financialGoalsTable.id, goalId), eq(financialGoalsTable.userId, userId)));
  if (!current || current.status === "active") return true;
  return checkAllowanceFor(req, res, "goals");
}

// Shared by the client's own route, the advisor-owns-client route, and the
// advisor-owns-lead route below — goals exist on a userId regardless of the
// account's current role, so all three read the exact same rows.
async function getGoalsForUser(userId: string) {
  const goals = await db.select().from(financialGoalsTable)
    .where(eq(financialGoalsTable.userId, userId))
    .orderBy(asc(financialGoalsTable.createdAt));
  return Promise.all(goals
    .filter(goal => goal.status !== "draft")
    .map(goal => computeGoalFundingSummary(userId, goal)));
}

router.get("/goals", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  res.json(await getGoalsForUser(userId));
});

router.get("/goals/drafts", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const drafts = await db.select({
    id: financialGoalsTable.id,
    title: financialGoalsTable.title,
    goalType: financialGoalsTable.goalType,
    targetAmount: financialGoalsTable.targetAmount,
    targetDate: financialGoalsTable.targetDate,
    currency: financialGoalsTable.currency,
    priority: financialGoalsTable.priority,
    createdAt: financialGoalsTable.createdAt,
  }).from(financialGoalsTable)
    .where(and(eq(financialGoalsTable.userId, userId), eq(financialGoalsTable.status, "draft")))
    .orderBy(desc(financialGoalsTable.createdAt));
  res.json(drafts);
});

router.post("/goals", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const parsed = createGoalBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid goal payload", details: parsed.error.issues });
    return;
  }

  const allowed = await checkAllowanceFor(req, res, "goals", {
    onDenied: async () => {
      const [draft] = await db.insert(financialGoalsTable)
        .values(goalInsertValues(userId, parsed.data, "draft"))
        .returning({ id: financialGoalsTable.id });
      return { draftSaved: true, draftGoalId: draft.id };
    },
  });
  if (!allowed) return;

  const [goal] = await db.insert(financialGoalsTable)
    .values(goalInsertValues(userId, parsed.data, "active"))
    .returning();
  await runCheckpointHook(userId);
  res.status(201).json(goal);
});

router.put("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, goalType, targetAmount, currentAmount, monthlyContribution, targetDate, currency, priority, status, notes } = req.body;
  const parsedStatus = status === undefined ? undefined : clientGoalStatusSchema.safeParse(status);
  if (parsedStatus && !parsedStatus.success) { res.status(400).json({ error: "Invalid goal lifecycle status" }); return; }
  if (!(await reactivationAllowed(req, res, rawId, userId, status))) return;
  const hasField = (field: string) => Object.prototype.hasOwnProperty.call(req.body, field);
  const updates: Partial<typeof financialGoalsTable.$inferInsert> = { updatedAt: new Date() };
  if (hasField("title")) updates.title = title;
  if (hasField("goalType")) updates.goalType = goalType;
  if (hasField("targetAmount")) updates.targetAmount = targetAmount == null ? null : String(targetAmount);
  if (hasField("currentAmount")) updates.currentAmount = String(currentAmount ?? 0);
  if (hasField("monthlyContribution")) updates.monthlyContribution = String(monthlyContribution ?? 0);
  if (hasField("targetDate")) updates.targetDate = targetDate ?? null;
  if (hasField("currency")) updates.currency = currency ?? "USD";
  if (hasField("priority")) updates.priority = priority;
  if (hasField("status") && parsedStatus?.success) updates.status = parsedStatus.data;
  if (hasField("notes")) updates.notes = notes ?? null;

  if (hasField("currentAmount")) {
    const [linked] = await db.select({ id: goalHoldingLinksTable.id }).from(goalHoldingLinksTable)
      .where(and(
        eq(goalHoldingLinksTable.goalId, rawId),
        eq(goalHoldingLinksTable.userId, userId),
      )).limit(1);
    if (linked) {
      res.status(409).json({ error: "Linked goal funding is calculated from its investments." });
      return;
    }
  }

  const [updated] = await db.update(financialGoalsTable).set(updates)
    .where(and(eq(financialGoalsTable.id, rawId), eq(financialGoalsTable.userId, userId))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  await runCheckpointHook(userId);
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
  const [[profile], [goal]] = await Promise.all([
    db.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, userId)),
    db.select({ id: financialGoalsTable.id }).from(financialGoalsTable)
      .where(and(eq(financialGoalsTable.id, goalId), eq(financialGoalsTable.userId, userId))),
  ]);
  if (!goal) { res.status(404).json({ error: "Not found" }); return; }
  if (profile?.role === "investment_client") {
    res.status(409).json({ error: "Investment-client goal funding is server-managed." });
    return;
  }
  const [linked] = await db.select({ id: goalHoldingLinksTable.id }).from(goalHoldingLinksTable)
    .where(and(
      eq(goalHoldingLinksTable.goalId, goalId),
      eq(goalHoldingLinksTable.userId, userId),
    )).limit(1);
  if (linked) {
    res.status(409).json({ error: "Linked goal funding is calculated from its investments." });
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

  const [[profile], existing, linkedGoals] = await Promise.all([
    db.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, userId)),
    db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId)),
    db.select({ goalId: goalHoldingLinksTable.goalId }).from(goalHoldingLinksTable)
      .where(eq(goalHoldingLinksTable.userId, userId)),
  ]);
  if (profile?.role === "investment_client") {
    res.status(409).json({ error: "Investment-client goals cannot be overwritten by pathway setup." });
    return;
  }
  const linkedGoalIds = new Set(linkedGoals.map(link => link.goalId));
  if (existing.some(goal => linkedGoalIds.has(goal.id))) {
    res.status(409).json({ error: "Linked goal funding cannot be overwritten by pathway setup." });
    return;
  }

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
      status: "active",
    }).returning();
    res.status(201).json(created);
  }
});

router.get("/advisor/clients/:id/goals", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClient("id"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  res.json(await getGoalsForUser(rawId));
});

// Same data, for a lead who's assigned to this advisor but not yet promoted —
// the goal already exists on their userId regardless of role.
router.get("/advisor/leads/:id/goals", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsLead("id"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  res.json(await getGoalsForUser(rawId));
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
  const requestedPct = Number(allocationPct ?? 100);
  try {
    const remainingPct = await getRemainingPct(userId, sourceType, sourceId, goalId);
    if (requestedPct > remainingPct) {
      res.status(409).json({
        error: remainingPct > 0
          ? `Only ${remainingPct}% of this investment is unallocated — the rest is already linked to your other goals.`
          : "This investment is already fully allocated to your other goals.",
        remainingPct,
      });
      return;
    }

    const [link] = await db.insert(goalHoldingLinksTable).values({
      goalId, userId, sourceType, sourceId, allocationPct: String(requestedPct),
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

// Sol observation data — a deterministic breakdown of why a goal's funded amount
// moved since the last time it was observed (market movement / new or removed link /
// reallocation). Records today's snapshot as a side effect if one doesn't exist yet.
// Pure data: no phrasing happens here, see src/lib/sol (frontend) for that.
router.get("/client/goals/:id/progress-movement", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const goalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const movement = await getProgressMovement(userId, goalId);
  res.json(movement);
});

// Passive-on-view trigger (same pattern as progress-movement above): the client
// calls this whenever a goal card renders off_track. Re-derives status
// server-side and dedupes against any already-open advisor task for this goal.
router.post("/client/goals/:id/ensure-off-track-task", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const goalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await ensureOffTrackTask(userId, goalId);
  res.json(result);
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
  const parsedStatus = clientGoalStatusSchema.safeParse(status);
  if (!parsedStatus.success) { res.status(400).json({ error: "Invalid goal lifecycle status" }); return; }
  if (!(await reactivationAllowed(req, res, rawId, userId, parsedStatus.data))) return;
  const [updated] = await db.update(financialGoalsTable).set({ status: parsedStatus.data, updatedAt: new Date() })
    .where(and(eq(financialGoalsTable.id, rawId), eq(financialGoalsTable.userId, userId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
