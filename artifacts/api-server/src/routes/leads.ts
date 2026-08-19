import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, leadsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import { createUserWithProfile } from "../lib/createUserWithProfile";

const router: IRouter = Router();
const leadGuard = [requireAuth, requireRole("advisor", "super_admin")];

router.get("/leads", requireAuth, async (req, res): Promise<void> => {
  res.json(await db.select().from(leadsTable));
});

router.post("/leads", async (req, res): Promise<void> => {
  const { email, firstName, source, quizResult, healthScore, status, notes } = req.body;
  if (!email) { res.status(400).json({ error: "email required" }); return; }
  const [lead] = await db.insert(leadsTable).values({
    email, firstName: firstName ?? null, source: source ?? null,
    quizResult: quizResult ?? null, healthScore: healthScore ?? null,
    status: status ?? "new", notes: notes ?? null,
  }).returning();
  res.status(201).json(lead);
});

// Previously any authenticated user (including a free_user) could flip any
// lead's status — tightened to advisor/super_admin alongside adding the
// convert endpoint below, so both write paths on this table share one guard.
router.put("/leads/:id", ...leadGuard, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { email, firstName, source, quizResult, healthScore, status, notes } = req.body;
  const [updated] = await db.update(leadsTable).set({
    email, firstName: firstName ?? null, source: source ?? null,
    quizResult: quizResult ?? null, healthScore: healthScore ?? null,
    status, notes: notes ?? null, updatedAt: new Date(),
  }).where(eq(leadsTable.id, rawId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// Converts a lead into a real investment_client account, replacing the old
// "converted" status which used to be a purely cosmetic label with zero side
// effects — no user/profile was ever created or linked. Advisors own the lead
// relationship (assignedAdvisorId) but previously had no way to create a
// client account at all (POST /admin/users is super_admin-only), so this is
// the first client-creation path available to them.
router.post("/leads/:id/convert", ...leadGuard, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { password, riskProfile } = req.body;

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, rawId));
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }
  if (lead.convertedUserId) { res.status(409).json({ error: "Lead already converted" }); return; }

  const result = await createUserWithProfile({
    email: lead.email,
    password,
    fullName: lead.firstName,
    role: "investment_client",
    advisorId: lead.assignedAdvisorId || userId,
    riskProfile: riskProfile ?? null,
    status: "prospect",
  });
  if (!result.ok) { res.status(result.httpStatus).json({ error: result.error }); return; }

  const [updatedLead] = await db.update(leadsTable).set({
    status: "converted", convertedUserId: result.profile.id, updatedAt: new Date(),
  }).where(eq(leadsTable.id, rawId)).returning();

  res.status(201).json({ lead: updatedLead, profile: result.profile });
});

export default router;
