import { Router, type IRouter } from "express";
import { and, eq, inArray, desc, isNull } from "drizzle-orm";
import {
  db, profilesTable, clientProfilesTable, assetClassBenchmarksTable,
  advisedStrategyReturnsTable, advisedPlansTable, advisorAssignmentsTable,
  roleSchema, clientStatusSchema,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import { createUserWithProfile } from "../lib/createUserWithProfile";
import { computeNetWorth } from "../lib/netWorthService";

const router: IRouter = Router();
const adminGuard = [requireAuth, requireRole("super_admin")];

// ── Users ──────────────────────────────────────────────────────────────────

router.get("/admin/users", ...adminGuard, async (req, res): Promise<void> => {
  const users = await db.select().from(profilesTable).orderBy(desc(profilesTable.createdAt));
  res.json(users);
});

router.get("/admin/users/:id", ...adminGuard, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const [user] = await db.select().from(profilesTable).where(eq(profilesTable.id, id));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(user);
});

router.post("/admin/users", ...adminGuard, async (req, res): Promise<void> => {
  const { email, password, fullName, role, advisorId, riskProfile, status } = req.body;
  const parsedRole = role === undefined ? undefined : roleSchema.safeParse(role);
  const parsedStatus = status === undefined ? undefined : clientStatusSchema.safeParse(status);
  if (parsedRole && !parsedRole.success) { res.status(400).json({ error: "Invalid role" }); return; }
  if (parsedStatus && !parsedStatus.success) { res.status(400).json({ error: "Invalid client status" }); return; }
  const normalizedRole = parsedRole?.success ? parsedRole.data : undefined;
  const normalizedStatus = parsedStatus?.success ? parsedStatus.data : undefined;
  const result = await createUserWithProfile({
    email, password, fullName, role: normalizedRole ?? "free_user", advisorId, riskProfile,
    assignedBy: (req as any).userId,
    ...(normalizedStatus !== undefined ? { status: normalizedStatus } : {}),
  });
  if (!result.ok) { res.status(result.httpStatus).json({ error: result.error }); return; }
  res.status(201).json(result.profile);
});

router.put("/admin/users/:id", ...adminGuard, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const assignedBy = (req as any).userId as string;
  const { fullName, role, preferredCurrency, advisorId } = req.body;
  const parsedRole = role === undefined ? undefined : roleSchema.safeParse(role);
  if (parsedRole && !parsedRole.success) { res.status(400).json({ error: "Invalid role" }); return; }
  if (advisorId !== undefined && advisorId !== null && typeof advisorId !== "string") {
    res.status(400).json({ error: "advisorId must be a string or null" });
    return;
  }
  const normalizedRole = parsedRole?.success ? parsedRole.data : undefined;
  const updated = await db.transaction(async (tx) => {
    const [profile] = await tx.update(profilesTable).set({
      ...(fullName !== undefined ? { fullName } : {}),
      ...(role !== undefined ? { role: normalizedRole } : {}),
      ...(preferredCurrency !== undefined ? { preferredCurrency } : {}),
      updatedAt: new Date(),
    }).where(eq(profilesTable.id, id)).returning();
    if (!profile) return undefined;

    const [existingClientProfile] = await tx.select().from(clientProfilesTable)
      .where(eq(clientProfilesTable.userId, id));
    const shouldHaveClientProfile = profile.role === "investment_client" || !!existingClientProfile;
    if (!shouldHaveClientProfile) return profile;

    const nextAdvisorId = advisorId === undefined
      ? existingClientProfile?.advisorId ?? null
      : (typeof advisorId === "string" && advisorId.trim() ? advisorId.trim() : null);

    if (existingClientProfile) {
      if (advisorId !== undefined) {
        await tx.update(clientProfilesTable)
          .set({ advisorId: nextAdvisorId, updatedAt: new Date() })
          .where(eq(clientProfilesTable.userId, id));
      }
    } else {
      await tx.insert(clientProfilesTable).values({
        userId: id,
        advisorId: nextAdvisorId,
        status: "active",
      });
    }

    if (advisorId !== undefined || !existingClientProfile) {
      const openAssignments = await tx.select({ id: advisorAssignmentsTable.id })
        .from(advisorAssignmentsTable)
        .where(and(
          eq(advisorAssignmentsTable.clientUserId, id),
          isNull(advisorAssignmentsTable.endedAt),
        ));
      const previousAdvisorId = existingClientProfile?.advisorId ?? null;
      if (previousAdvisorId !== nextAdvisorId || (nextAdvisorId === null && openAssignments.length > 0)) {
        if (openAssignments.length > 0) {
          await tx.update(advisorAssignmentsTable)
            .set({ endedAt: new Date() })
            .where(and(
              eq(advisorAssignmentsTable.clientUserId, id),
              isNull(advisorAssignmentsTable.endedAt),
            ));
        }
        if (nextAdvisorId) {
          await tx.insert(advisorAssignmentsTable).values({
            clientUserId: id,
            advisorId: nextAdvisorId,
            assignedBy,
          });
        }
      } else if (nextAdvisorId && openAssignments.length === 0) {
        await tx.insert(advisorAssignmentsTable).values({
          clientUserId: id,
          advisorId: nextAdvisorId,
          assignedBy,
        });
      }
    }

    return profile;
  });
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/admin/users/:id", ...adminGuard, async (req, res): Promise<void> => {
  const id = req.params.id as string;

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (clerkSecretKey) {
    // Best-effort Clerk deletion
    await fetch(`https://api.clerk.com/v1/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${clerkSecretKey}` },
    }).catch(() => {});
  }

  await db.delete(profilesTable).where(eq(profilesTable.id, id));
  res.sendStatus(204);
});

// ── Admin: all investment clients ──────────────────────────────────────────

router.get("/admin/clients", ...adminGuard, async (req, res): Promise<void> => {
  // Get all investment_client users with client profile data
  const clients = await db.select({
    id: profilesTable.id,
    email: profilesTable.email,
    fullName: profilesTable.fullName,
    createdAt: profilesTable.createdAt,
    status: clientProfilesTable.status,
    kycStatus: clientProfilesTable.kycStatus,
    riskProfile: clientProfilesTable.riskProfile,
    investmentStyle: clientProfilesTable.investmentStyle,
    advisorId: clientProfilesTable.advisorId,
  }).from(profilesTable)
    .innerJoin(clientProfilesTable, eq(clientProfilesTable.userId, profilesTable.id))
    .where(eq(profilesTable.role, "investment_client"))
    .orderBy(desc(profilesTable.createdAt));

  const clientIds = clients.map(c => c.id);
  if (clientIds.length === 0) { res.json([]); return; }

  // Get advisors for name lookup
  const advisorIds = [...new Set(clients.map(c => c.advisorId).filter(Boolean) as string[])];
  const advisors = advisorIds.length > 0
    ? await db.select({ id: profilesTable.id, fullName: profilesTable.fullName, email: profilesTable.email })
        .from(profilesTable).where(inArray(profilesTable.id, advisorIds))
    : [];
  const advisorMap = Object.fromEntries(advisors.map(a => [a.id, a.fullName ?? a.email]));

  // advised_plans, not client_packages, is what an advisor can actually create
  // for a client now (see client-detail.tsx's Packages-tab removal) — "plans"/
  // "active plans" here reflect that going-forward model. inforce is the
  // advised_plans equivalent of a package's "active" status.
  const plans = await db.select({ userId: advisedPlansTable.userId, status: advisedPlansTable.status })
    .from(advisedPlansTable).where(inArray(advisedPlansTable.userId, clientIds));
  const netWorthByClient = new Map(await Promise.all(clients.map(async (client) => {
    const summary = await computeNetWorth(client.id, { currency: "USD" });
    return [client.id, summary] as const;
  })));

  const result = clients.map(c => {
    const summary = netWorthByClient.get(c.id);
    const portfolioValue = summary?.portfolio.total ?? 0;
    const clientPlans = plans.filter(p => p.userId === c.id);
    const activePlans = clientPlans.filter(p => p.status === "inforce");
    return {
      ...c,
      advisorName: c.advisorId ? advisorMap[c.advisorId] ?? null : null,
      portfolioValue,
      netWorth: summary?.netWorth ?? 0,
      plansCount: clientPlans.length,
      activePlans: activePlans.length,
    };
  });

  res.json(result);
});

// ── Admin: advisors list (for assignment) ──────────────────────────────────

router.get("/admin/advisors", ...adminGuard, async (req, res): Promise<void> => {
  const advisors = await db.select({
    id: profilesTable.id,
    email: profilesTable.email,
    fullName: profilesTable.fullName,
  }).from(profilesTable)
    .where(inArray(profilesTable.role, ["advisor", "super_admin"]))
    .orderBy(profilesTable.fullName);
  res.json(advisors);
});

// ── Admin stats ────────────────────────────────────────────────────────────

router.get("/admin/stats", ...adminGuard, async (req, res): Promise<void> => {
  const users = await db.select().from(profilesTable);
  const byRole = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});
  res.json({ totalUsers: users.length, byRole });
});

// ── Admin: asset class benchmarks (expected-return defaults for self-tracked holdings) ────

const ASSET_CLASSES = ["us_equity", "global_equity", "crypto", "global_property", "pension_balanced", "other"];

router.get("/admin/asset-class-benchmarks", ...adminGuard, async (req, res): Promise<void> => {
  const rows = await db.select().from(assetClassBenchmarksTable).orderBy(assetClassBenchmarksTable.assetClass);
  res.json(rows);
});

router.post("/admin/asset-class-benchmarks", ...adminGuard, async (req, res): Promise<void> => {
  const { assetClass, label, tenYearCagrPct, source } = req.body;
  if (!ASSET_CLASSES.includes(assetClass) || !label || tenYearCagrPct == null) {
    res.status(400).json({ error: `assetClass (one of ${ASSET_CLASSES.join(", ")}), label, and tenYearCagrPct required` });
    return;
  }
  const [row] = await db.insert(assetClassBenchmarksTable).values({
    assetClass, label, tenYearCagrPct: String(tenYearCagrPct), source: source ?? null,
  }).returning();
  res.status(201).json(row);
});

router.put("/admin/asset-class-benchmarks/:id", ...adminGuard, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const { label, tenYearCagrPct, source } = req.body;
  const [row] = await db.update(assetClassBenchmarksTable).set({
    ...(label !== undefined ? { label } : {}),
    ...(tenYearCagrPct !== undefined ? { tenYearCagrPct: String(tenYearCagrPct) } : {}),
    ...(source !== undefined ? { source } : {}),
    updatedAt: new Date(),
  }).where(eq(assetClassBenchmarksTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/admin/asset-class-benchmarks/:id", ...adminGuard, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  await db.delete(assetClassBenchmarksTable).where(eq(assetClassBenchmarksTable.id, id));
  res.sendStatus(204);
});

// ── Admin: advised strategy target returns (for "bring under management" comparison) ─────

const PLAN_TYPES = ["rsp", "lump_sum", "combination"];

router.get("/admin/advised-strategy-returns", ...adminGuard, async (req, res): Promise<void> => {
  const rows = await db.select().from(advisedStrategyReturnsTable).orderBy(advisedStrategyReturnsTable.planType);
  res.json(rows);
});

router.post("/admin/advised-strategy-returns", ...adminGuard, async (req, res): Promise<void> => {
  const { planType, label, targetAnnualReturnPct } = req.body;
  if (!PLAN_TYPES.includes(planType) || !label || targetAnnualReturnPct == null) {
    res.status(400).json({ error: `planType (one of ${PLAN_TYPES.join(", ")}), label, and targetAnnualReturnPct required` });
    return;
  }
  const [row] = await db.insert(advisedStrategyReturnsTable).values({
    planType, label, targetAnnualReturnPct: String(targetAnnualReturnPct),
  }).returning();
  res.status(201).json(row);
});

router.put("/admin/advised-strategy-returns/:id", ...adminGuard, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const { label, targetAnnualReturnPct } = req.body;
  const [row] = await db.update(advisedStrategyReturnsTable).set({
    ...(label !== undefined ? { label } : {}),
    ...(targetAnnualReturnPct !== undefined ? { targetAnnualReturnPct: String(targetAnnualReturnPct) } : {}),
    updatedAt: new Date(),
  }).where(eq(advisedStrategyReturnsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/admin/advised-strategy-returns/:id", ...adminGuard, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  await db.delete(advisedStrategyReturnsTable).where(eq(advisedStrategyReturnsTable.id, id));
  res.sendStatus(204);
});

export default router;
