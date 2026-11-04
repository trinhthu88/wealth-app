import { Router, type IRouter, type Response } from "express";
import { and, eq, inArray, desc } from "drizzle-orm";
import {
  db, clientProfilesTable, profilesTable, advisedPlansTable,
  clientBudgetMonthsTable, normalizeRiskProfile, healthScoresTable,
} from "@workspace/db";
import { requireAuth, requireRole, requireAdvisorOwnsClient, requireAdvisorOwnsLead } from "../middlewares/requireAuth";
import { computeNetWorth } from "../lib/netWorthService";
import { getEngagement } from "../lib/engagement";

const router: IRouter = Router();

const advisorGuard = [requireAuth, requireRole("advisor", "super_admin")];
const advisorOwnsClientGuard = [...advisorGuard, requireAdvisorOwnsClient("id")];
const advisorOwnsLeadGuard = [...advisorGuard, requireAdvisorOwnsLead("id")];

// Explicit allowlist of client-profile fields an advisor may update through this endpoint.
// advisorId, kycStatus, id, and any role/status field are intentionally excluded.
const CLIENT_PROFILE_UPDATABLE_FIELDS = [
  "riskProfile",
  "riskScore",
  "investmentStyle",
  "indicativeAmount",
  "preCallNotes",
  "preferredContactTime",
  "onboardingStep",
  "prospectOnboardingComplete",
  "fullOnboardingComplete",
  "relationshipStartDate",
  "annualReviewDate",
  "internalNotes",
  "advisorInternalNotes",
  // clientTrack (derived), preferredDisplayCurrency (profiles owns currency) and
  // onboardingTrackComplete (onboarding_stage owns state) are deprecated: not writable.
] as const;

function pickUpdatableClientProfileFields(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of CLIENT_PROFILE_UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }
  return result;
}

router.get("/client-profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
  if (!cp) { res.status(404).json({ error: "Not found" }); return; }
  res.json(cp);
});

router.get("/advisor/clients/:id/profile", ...advisorOwnsClientGuard, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, id));
  if (!profile) { res.status(404).json({ error: "Not found" }); return; }
  res.json(profile);
});

router.get("/advisor/clients/:id/client-profile", ...advisorOwnsClientGuard, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, id));
  if (!cp) { res.status(404).json({ error: "Not found" }); return; }
  res.json(cp);
});

router.put("/advisor/clients/:id/client-profile", ...advisorOwnsClientGuard, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const updates = pickUpdatableClientProfileFields(req.body ?? {});
  if (Object.prototype.hasOwnProperty.call(updates, "riskProfile")) {
    const riskProfile = normalizeRiskProfile(updates.riskProfile);
    if (!riskProfile) { res.status(400).json({ error: "Invalid risk profile" }); return; }
    updates.riskProfile = riskProfile;
    updates.riskProfileSource = "advisor";
  }
  const existing = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, id));
  let cp;
  if (existing.length > 0) {
    [cp] = await db.update(clientProfilesTable).set({ ...updates, updatedAt: new Date() }).where(eq(clientProfilesTable.userId, id)).returning();
  } else {
    [cp] = await db.insert(clientProfilesTable).values({ ...updates, userId: id }).returning();
  }
  res.json(cp);
});

// Budget sharing is the user's choice for leads and clients alike.
async function sendBudgetSummary(userId: string, res: Response): Promise<void> {
  const [clientProfile] = await db.select({
    shareBudgetWithAdvisor: clientProfilesTable.shareBudgetWithAdvisor,
  }).from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
  if (!clientProfile?.shareBudgetWithAdvisor) {
    res.status(403).json({ error: "The client has not shared their budget summary." });
    return;
  }

  const months = await db.select({
    month: clientBudgetMonthsTable.month,
    income: clientBudgetMonthsTable.totalIncome,
    spending: clientBudgetMonthsTable.totalExpenses,
    surplus: clientBudgetMonthsTable.netSurplus,
    savingsRatePct: clientBudgetMonthsTable.savingsRatePct,
  }).from(clientBudgetMonthsTable)
    .where(eq(clientBudgetMonthsTable.userId, userId))
    .orderBy(desc(clientBudgetMonthsTable.month))
    .limit(12);

  res.json({ shared: true, months });
}

router.get("/advisor/clients/:id/budget-summary", ...advisorOwnsClientGuard, async (req, res): Promise<void> => {
  await sendBudgetSummary(req.params.id as string, res);
});

// DECISION: a lead's budget honours shareBudgetWithAdvisor, like a client's. The brief asks
// only for ownership scoping, but the sharing toggle is an explicit privacy choice, and
// being assigned an advisor should not silently override it.
router.get("/advisor/leads/:id/budget", ...advisorOwnsLeadGuard, async (req, res): Promise<void> => {
  await sendBudgetSummary(req.params.id as string, res);
});

router.get("/advisor/leads/:id/score", ...advisorOwnsLeadGuard, async (req, res): Promise<void> => {
  const history = await db.select().from(healthScoresTable)
    .where(eq(healthScoresTable.userId, req.params.id as string))
    .orderBy(desc(healthScoresTable.scoreDate), desc(healthScoresTable.createdAt))
    .limit(12);
  res.json({ latest: history[0] ?? null, history });
});

router.get("/advisor/leads/:id/engagement", ...advisorOwnsLeadGuard, async (req, res): Promise<void> => {
  res.json(await getEngagement(req.params.id as string));
});

router.get("/advisor/clients", ...advisorGuard, async (req, res): Promise<void> => {
  const callerId = (req as any).userId;

  // Check if caller is super_admin (sees all) or advisor (sees assigned)
  const [callerProfile] = await db.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, callerId));
  const isAdmin = callerProfile?.role === "super_admin";

  const query = db.select({
    id: profilesTable.id,
    email: profilesTable.email,
    fullName: profilesTable.fullName,
    role: profilesTable.role,
    createdAt: profilesTable.createdAt,
    kycStatus: clientProfilesTable.kycStatus,
    riskProfile: clientProfilesTable.riskProfile,
    status: clientProfilesTable.status,
    investmentStyle: clientProfilesTable.investmentStyle,
    indicativeAmount: clientProfilesTable.indicativeAmount,
    onboardingStep: clientProfilesTable.onboardingStep,
    advisorId: clientProfilesTable.advisorId,
  }).from(profilesTable)
    .innerJoin(clientProfilesTable, eq(clientProfilesTable.userId, profilesTable.id));
  // A client_profiles row alone does not make a client (free users may hold
  // preferences there); every client list filters on role.
  const isClient = eq(profilesTable.role, "investment_client");

  const clients = isAdmin
    ? await query.where(isClient).orderBy(desc(profilesTable.createdAt))
    : await query.where(and(isClient, eq(clientProfilesTable.advisorId, callerId))).orderBy(desc(profilesTable.createdAt));

  // Enrich with portfolio value
  const clientIds = clients.map(c => c.id);
  if (clientIds.length === 0) { res.json([]); return; }

  // advised_plans, not client_packages, is what an advisor can actually create
  // for a client now (see client-detail.tsx's Packages-tab removal) — the
  // client-list "plans" count reflects that going-forward model.
  const plans = await db.select({ userId: advisedPlansTable.userId })
    .from(advisedPlansTable).where(inArray(advisedPlansTable.userId, clientIds));

  const netWorthByClient = new Map(await Promise.all(clients.map(async (client) => {
    const summary = await computeNetWorth(client.id, { currency: "USD" });
    return [client.id, summary] as const;
  })));
  const result = clients.map(c => {
    const summary = netWorthByClient.get(c.id);
    const portfolioValue = summary?.portfolio.total ?? 0;
    const plansCount = plans.filter(p => p.userId === c.id).length;
    return { ...c, portfolioValue, netWorth: summary?.netWorth ?? 0, plansCount };
  });

  res.json(result);
});

export default router;
