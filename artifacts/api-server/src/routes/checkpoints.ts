import { Router, type IRouter } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { db, conversionCheckpointsTable, profilesTable } from "@workspace/db";
import { CHECKPOINT_CODES, type CheckpointCode } from "@workspace/tier-policy";
import { requireAuth, requireRole, requireAdvisorOwnsLead } from "../middlewares/requireAuth";
import { getOpenCheckpoint } from "../lib/checkpointEngine";
import { getEntitlementContext } from "../lib/entitlements";
import { registerInterest } from "../lib/leadInterest";

const router: IRouter = Router();
const idParam = z.uuid();

// GET stamps shownAt: the frontend asks only when a matching component is on screen.
router.get("/me/checkpoint", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const open = await getOpenCheckpoint(userId);
  if (!open) { res.json(null); return; }
  if (!open.shownAt) {
    await db.update(conversionCheckpointsTable).set({ shownAt: new Date() })
      .where(eq(conversionCheckpointsTable.id, open.id));
  }
  res.json({ id: open.id, code: open.code, copyKey: open.code, firedAt: open.firedAt, snapshot: open.snapshot });
});

async function findOwnOpen(id: unknown, userId: string) {
  const parsed = idParam.safeParse(id);
  if (!parsed.success) return null;
  const [row] = await db.select().from(conversionCheckpointsTable).where(and(
    eq(conversionCheckpointsTable.id, parsed.data),
    eq(conversionCheckpointsTable.userId, userId),
    isNull(conversionCheckpointsTable.dismissedAt),
    isNull(conversionCheckpointsTable.acceptedAt),
  ));
  return row ?? null;
}

router.post("/me/checkpoint/:id/dismiss", requireAuth, async (req, res): Promise<void> => {
  const row = await findOwnOpen(req.params.id, (req as any).userId);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(conversionCheckpointsTable).set({ dismissedAt: new Date() })
    .where(eq(conversionCheckpointsTable.id, row.id));
  res.sendStatus(204);
});

router.post("/me/checkpoint/:id/accept", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const row = await findOwnOpen(req.params.id, userId);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.code === "C1_score_ready") {
    res.status(409).json({ error: "This checkpoint has nothing to accept." });
    return;
  }
  if (!CHECKPOINT_CODES.includes(row.code as CheckpointCode)) {
    res.status(409).json({ error: "Unknown checkpoint" });
    return;
  }

  // DECISION: a Track B client already has an advisor, and their action opens messages,
  // so accepting records the choice without creating a lead. Only a free user gets a lead.
  const { tier } = await getEntitlementContext(req);
  let leadId: string | null = null;
  if (tier === "free") {
    const [profile] = await db.select({ email: profilesTable.email }).from(profilesTable).where(eq(profilesTable.id, userId));
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
    ({ lead: { id: leadId } } = await registerInterest(userId, profile.email, row.code as CheckpointCode));
  }
  await db.update(conversionCheckpointsTable).set({ acceptedAt: new Date(), leadId })
    .where(eq(conversionCheckpointsTable.id, row.id));
  res.json({ id: row.id, code: row.code, leadId });
});

router.get("/advisor/leads/:id/checkpoints", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsLead("id"), async (req, res): Promise<void> => {
  const rows = await db.select().from(conversionCheckpointsTable)
    .where(eq(conversionCheckpointsTable.userId, req.params.id as string))
    .orderBy(asc(conversionCheckpointsTable.firedAt));
  res.json(rows);
});

export default router;
