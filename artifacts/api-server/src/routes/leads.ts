import { Router, type IRouter } from "express";
import { and, asc, eq, ne } from "drizzle-orm";
import { db, leadsTable, profilesTable } from "@workspace/db";
import { requireAuth, requireRole, requireAdvisorOwnsLeadById } from "../middlewares/requireAuth";
import { createUserWithProfile } from "../lib/createUserWithProfile";
import { promoteLeadToClient } from "../lib/promoteLead";

const router: IRouter = Router();
const leadGuard = [requireAuth, requireRole("advisor", "super_admin")];
const superAdminGuard = [requireAuth, requireRole("super_admin")];

// super_admin sees every lead — this is the assignment queue, so a super
// admin needs visibility into the unassigned pool system-wide. An advisor
// only sees leads assigned to them (including the unassigned pool would leak
// every other advisor's prospective clients before a super_admin has routed
// them).
router.get("/leads", ...leadGuard, async (req, res): Promise<void> => {
  const userRole = (req as any).userRole;
  const userId = (req as any).userId;
  if (userRole === "super_admin") {
    res.json(await db.select().from(leadsTable));
    return;
  }
  res.json(await db.select().from(leadsTable).where(eq(leadsTable.assignedAdvisorId, userId)));
});

// Same scoping as the list above, via requireAdvisorOwnsLeadById: super_admin
// sees any lead, an advisor only the leads assigned to them.
router.get("/leads/:id", ...leadGuard, requireAdvisorOwnsLeadById(), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, rawId));
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }
  res.json(lead);
});

// Called by an interest CTA (SmartUpgradeCard, GoalScenarioCTA, the off-track
// Sol card) for an already-authenticated free_user or investment_client — the
// caller only ever passes `source`, everything else about the person comes
// from their own profile. A user clicking multiple CTAs over time stays one
// lead record: any existing non-churned lead for this userId just gets its
// source/updatedAt touched instead of a new row being created.
router.post("/leads/from-interest", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { source } = req.body;
  if (!source) { res.status(400).json({ error: "source required" }); return; }

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const [existing] = await db.select().from(leadsTable)
    .where(and(eq(leadsTable.userId, userId), ne(leadsTable.status, "churned")))
    .orderBy(asc(leadsTable.createdAt));

  if (existing) {
    const [updated] = await db.update(leadsTable).set({ source, updatedAt: new Date() })
      .where(eq(leadsTable.id, existing.id)).returning();
    res.json(updated);
    return;
  }

  const [lead] = await db.insert(leadsTable).values({
    email: profile.email,
    firstName: profile.fullName ?? null,
    userId,
    source,
    status: "unassigned",
  }).returning();
  res.status(201).json(lead);
});

router.post("/leads", async (req, res): Promise<void> => {
  const { email, firstName, source, quizResult, healthScore, status, notes } = req.body;
  if (!email) { res.status(400).json({ error: "email required" }); return; }
  const [lead] = await db.insert(leadsTable).values({
    email, firstName: firstName ?? null, source: source ?? null,
    quizResult: quizResult ?? null, healthScore: healthScore ?? null,
    status: status ?? "unassigned", notes: notes ?? null,
  }).returning();
  res.status(201).json(lead);
});

// Advisor-editable subset: status and notes only — not assignedAdvisorId (only
// PUT /leads/:id/assign, super_admin-only, sets that) or userId. This is the
// lead-detail Profile tab's write path. Transitioning status *into* "client"
// (not just re-saving while already "client") triggers the promotion
// transaction below first — a promotion that fails leaves the lead's status
// unchanged, rather than half-promoting silently.
const LEAD_ADVISOR_EDITABLE_FIELDS = ["status", "notes"] as const;
function pickLeadAdvisorEditableFields(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of LEAD_ADVISOR_EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) result[field] = body[field];
  }
  return result;
}

router.put("/leads/:id", ...leadGuard, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const updates = pickLeadAdvisorEditableFields(req.body ?? {});

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, rawId));
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }

  if (updates.status === "client" && lead.status !== "client") {
    const promotion = await promoteLeadToClient(lead);
    if (!promotion.ok) { res.status(promotion.httpStatus).json({ error: promotion.error }); return; }
  }

  const [updated] = await db.update(leadsTable).set({
    ...updates, updatedAt: new Date(),
  }).where(eq(leadsTable.id, rawId)).returning();
  res.json(updated);
});

// Super-admin-only: assigns a lead to an advisor. Only flips status from
// "unassigned" to "active" — reassigning an already-active (or cold/churned)
// lead to a different advisor changes assignedAdvisorId without touching its
// current relationship status.
router.put("/leads/:id/assign", ...superAdminGuard, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { advisorId } = req.body;
  if (!advisorId) { res.status(400).json({ error: "advisorId required" }); return; }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, rawId));
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db.update(leadsTable).set({
    assignedAdvisorId: advisorId,
    status: lead.status === "unassigned" ? "active" : lead.status,
    updatedAt: new Date(),
  }).where(eq(leadsTable.id, rawId)).returning();

  res.json(updated);
});

// Converts an ANONYMOUS lead (no linked userId — the quiz-capture funnel) into
// a brand-new investment_client account, since there's no existing profiles
// row to promote. This is deliberately the only path that creates a new Clerk
// account from a lead — a lead that already has userId set (came from an
// authenticated interest CTA, see leads.userId's comment) already has a real
// account, and goes through the lead-status-to-"client" promotion transaction
// instead (see the lead-detail Profile tab), never through here.
router.post("/leads/:id/convert", ...leadGuard, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { password, riskProfile } = req.body;

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, rawId));
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }
  if (lead.convertedUserId) { res.status(409).json({ error: "Lead already converted" }); return; }
  if (lead.userId) {
    res.status(409).json({ error: "This lead is already linked to an account — promote it by setting its status to \"client\" instead of converting." });
    return;
  }

  const result = await createUserWithProfile({
    email: lead.email,
    password,
    fullName: lead.firstName,
    role: "investment_client",
    advisorId: lead.assignedAdvisorId || userId,
    riskProfile: riskProfile ?? null,
    status: "active",
  });
  if (!result.ok) { res.status(result.httpStatus).json({ error: result.error }); return; }

  const [updatedLead] = await db.update(leadsTable).set({
    status: "client", convertedUserId: result.profile.id, updatedAt: new Date(),
  }).where(eq(leadsTable.id, rawId)).returning();

  res.status(201).json({ lead: updatedLead, profile: result.profile });
});

export default router;
