import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { z } from "zod/v4";
import { CHECKPOINT_CODES } from "@workspace/tier-policy";
import { db, leadsTable, membershipsTable, profilesTable, leadStatusSchema, normalizeRiskProfile } from "@workspace/db";
import { requireAuth, requireRole, requireAdvisorOwnsLeadById } from "../middlewares/requireAuth";
import { createUserWithProfile } from "../lib/createUserWithProfile";
import { promoteLeadToClient } from "../lib/promoteLead";
import { isRowActive } from "../lib/membershipStore";
import { registerInterest, withLinkedPerson } from "../lib/leadInterest";

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
    res.json(await withLinkedPerson(await db.select().from(leadsTable)));
    return;
  }
  res.json(await withLinkedPerson(await db.select().from(leadsTable).where(eq(leadsTable.assignedAdvisorId, userId))));
});

// Same scoping as the list above, via requireAdvisorOwnsLeadById: super_admin
// sees any lead, an advisor only the leads assigned to them.
router.get("/leads/:id", ...leadGuard, requireAdvisorOwnsLeadById(), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, rawId));
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }
  const [withPerson] = await withLinkedPerson([lead]);
  res.json(withPerson);
});

// Called by an interest CTA (SmartUpgradeCard, GoalScenarioCTA, the off-track
// Sol card) for an already-authenticated free_user or investment_client — the
// caller only ever passes `source`, everything else about the person comes
// from their own profile. A user clicking multiple CTAs over time stays one
// lead record: any existing non-churned lead for this userId just gets its
// source/updatedAt touched instead of a new row being created.
const interestBody = z.object({ source: z.enum(CHECKPOINT_CODES) });

router.post("/leads/from-interest", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const body = interestBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "source must be a checkpoint code" }); return; }

  const [profile] = await db.select({ email: profilesTable.email }).from(profilesTable).where(eq(profilesTable.id, userId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const { lead, created } = await registerInterest(userId, profile.email, body.data.source);
  const [withPerson] = await withLinkedPerson([lead]);
  res.status(created ? 201 : 200).json(withPerson);
});

// The public quiz funnel. Anyone can call this, so it takes only what a visitor can know about
// themselves: status is always unassigned and notes are staff's. Unknown fields are dropped.
const publicLeadBody = z.object({
  email: z.email().max(254),
  firstName: z.string().trim().max(200).nullish(),
  source: z.string().trim().max(200).nullish(),
  quizResult: z.string().max(5000).nullish(),
  healthScore: z.number().int().min(0).max(100).nullish(),
});

const publicLeadLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

router.post("/leads", publicLeadLimit, async (req, res): Promise<void> => {
  const body = publicLeadBody.safeParse(req.body ?? {});
  if (!body.success) { res.status(400).json({ error: "A valid email is required" }); return; }
  const { email, firstName, source, quizResult, healthScore } = body.data;
  const [lead] = await db.insert(leadsTable).values({
    email, firstName: firstName ?? null, source: source ?? null,
    quizResult: quizResult ?? null, healthScore: healthScore ?? null,
    status: "unassigned",
  }).returning();
  res.status(201).json(lead);
});

// The advisor leads page's "Add lead", with the fields the public route refuses.
const staffLeadBody = z.object({
  email: z.email().max(254),
  firstName: z.string().trim().max(200).nullish(),
  source: z.string().trim().max(200).nullish(),
  status: leadStatusSchema.optional(),
  notes: z.string().max(5000).nullish(),
});

router.post("/advisor/leads", ...leadGuard, async (req, res): Promise<void> => {
  const body = staffLeadBody.safeParse(req.body ?? {});
  if (!body.success) { res.status(400).json({ error: "A valid email and lead status are required" }); return; }
  const { email, firstName, source, status, notes } = body.data;
  // DECISION: a lead an advisor adds is assigned to them. The list and every write are scoped to
  // the assigned advisor, so an unassigned one would vanish from the page that just created it.
  // That follows the assign route's rule: an assigned lead is no longer "unassigned".
  const isAdvisor = (req as any).userRole === "advisor";
  const nextStatus = status ?? "unassigned";
  const [lead] = await db.insert(leadsTable).values({
    email, firstName: firstName ?? null, source: source ?? null, notes: notes ?? null,
    assignedAdvisorId: isAdvisor ? (req as any).userId : null,
    status: isAdvisor && nextStatus === "unassigned" ? "active" : nextStatus,
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

router.put("/leads/:id", ...leadGuard, requireAdvisorOwnsLeadById(), async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const updates = pickLeadAdvisorEditableFields(req.body ?? {});
  if (updates.status !== undefined && !leadStatusSchema.safeParse(updates.status).success) {
    res.status(400).json({ error: "Invalid lead status" });
    return;
  }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, rawId));
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }

  if (updates.status === "client" && lead.status !== "client") {
    const promotion = await promoteLeadToClient(lead, userId);
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

  // A paying self-serve member is already a client with no advisor pointer, which would lock
  // their new advisor out of the client routes. Assignment finishes their promotion, so both
  // doors end in the same state.
  if (updated.userId && updated.status === "active") {
    const [member] = await db.select({ id: membershipsTable.userId, status: membershipsTable.status, currentPeriodEnd: membershipsTable.currentPeriodEnd })
      .from(membershipsTable).where(eq(membershipsTable.userId, updated.userId));
    const [profile] = await db.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, updated.userId));
    if (profile?.role === "investment_client" && isRowActive(member)) {
      const promotion = await promoteLeadToClient(updated, (req as any).userId);
      if (!promotion.ok) { res.status(promotion.httpStatus).json({ error: promotion.error }); return; }
      const [promoted] = await db.update(leadsTable).set({ status: "client", updatedAt: new Date() })
        .where(eq(leadsTable.id, rawId)).returning();
      res.json(promoted);
      return;
    }
  }

  res.json(updated);
});

// Converts an ANONYMOUS lead (no linked userId — the quiz-capture funnel) into
// a brand-new investment_client account, since there's no existing profiles
// row to promote. This is deliberately the only path that creates a new Clerk
// account from a lead — a lead that already has userId set (came from an
// authenticated interest CTA, see leads.userId's comment) already has a real
// account, and goes through the lead-status-to-"client" promotion transaction
// instead (see the lead-detail Profile tab), never through here.
router.post("/leads/:id/convert", ...leadGuard, requireAdvisorOwnsLeadById(), async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { password, riskProfile } = req.body;
  if (riskProfile != null && riskProfile !== "" && !normalizeRiskProfile(riskProfile)) { res.status(400).json({ error: "Invalid risk profile" }); return; }

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
    assignedBy: userId,
    riskProfile: riskProfile ?? null,
    status: "pending_payment",
  });
  if (!result.ok) { res.status(result.httpStatus).json({ error: result.error }); return; }

  const [updatedLead] = await db.update(leadsTable).set({
    status: "client", convertedUserId: result.profile.id, updatedAt: new Date(),
  }).where(eq(leadsTable.id, rawId)).returning();

  res.status(201).json({ lead: updatedLead, profile: result.profile });
});

export default router;
