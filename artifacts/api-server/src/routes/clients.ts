import { Router, type IRouter } from "express";
import { eq, inArray, desc } from "drizzle-orm";
import { db, clientProfilesTable, profilesTable, clientPackagesTable, portfolioSnapshotsTable, advisedPlansTable } from "@workspace/db";
import { requireAuth, requireRole, requireAdvisorOwnsClient } from "../middlewares/requireAuth";

const router: IRouter = Router();

const advisorGuard = [requireAuth, requireRole("advisor", "super_admin")];
const advisorOwnsClientGuard = [...advisorGuard, requireAdvisorOwnsClient("id")];

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
  "clientTrack",
  "preferredDisplayCurrency",
  "onboardingTrackComplete",
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
  const existing = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, id));
  let cp;
  if (existing.length > 0) {
    [cp] = await db.update(clientProfilesTable).set({ ...updates, updatedAt: new Date() }).where(eq(clientProfilesTable.userId, id)).returning();
  } else {
    [cp] = await db.insert(clientProfilesTable).values({ ...updates, userId: id }).returning();
  }
  res.json(cp);
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

  const clients = isAdmin
    ? await query.where(eq(profilesTable.role, "investment_client")).orderBy(desc(profilesTable.createdAt))
    : await query.where(eq(clientProfilesTable.advisorId, callerId)).orderBy(desc(profilesTable.createdAt));

  // Enrich with portfolio value
  const clientIds = clients.map(c => c.id);
  if (clientIds.length === 0) { res.json([]); return; }

  const packages = await db.select({
    userId: clientPackagesTable.userId,
    id: clientPackagesTable.id,
    status: clientPackagesTable.status,
  }).from(clientPackagesTable).where(inArray(clientPackagesTable.userId, clientIds));

  const pkgIds = packages.map(p => p.id);
  const snapshots = pkgIds.length > 0
    ? await db.select({
        clientPackageId: portfolioSnapshotsTable.clientPackageId,
        totalValueUsd: portfolioSnapshotsTable.totalValueUsd,
      }).from(portfolioSnapshotsTable)
        .where(inArray(portfolioSnapshotsTable.clientPackageId, pkgIds))
        .orderBy(desc(portfolioSnapshotsTable.snapshotDate))
    : [];

  const latestSnap: Record<string, number> = {};
  for (const s of snapshots) {
    if (!latestSnap[s.clientPackageId]) {
      latestSnap[s.clientPackageId] = parseFloat(s.totalValueUsd as string);
    }
  }

  // advised_plans, not client_packages, is what an advisor can actually create
  // for a client now (see client-detail.tsx's Packages-tab removal) — the
  // client-list "plans" count reflects that going-forward model.
  const plans = await db.select({ userId: advisedPlansTable.userId })
    .from(advisedPlansTable).where(inArray(advisedPlansTable.userId, clientIds));

  const result = clients.map(c => {
    const clientPkgs = packages.filter(p => p.userId === c.id);
    const portfolioValue = clientPkgs.reduce((sum, p) => sum + (latestSnap[p.id] ?? 0), 0);
    const plansCount = plans.filter(p => p.userId === c.id).length;
    return { ...c, portfolioValue, plansCount };
  });

  res.json(result);
});

export default router;
