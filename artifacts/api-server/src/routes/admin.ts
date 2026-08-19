import { Router, type IRouter } from "express";
import { eq, inArray, desc } from "drizzle-orm";
import {
  db, profilesTable, clientProfilesTable, clientPackagesTable, portfolioSnapshotsTable,
  assetClassBenchmarksTable, advisedStrategyReturnsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

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
  if (!email || !password) { res.status(400).json({ error: "email and password required" }); return; }

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) { res.status(500).json({ error: "CLERK_SECRET_KEY not configured" }); return; }

  const nameParts = (fullName ?? "").trim().split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const clerkRes = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clerkSecretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
      password,
      first_name: firstName,
      last_name: lastName,
      skip_password_checks: true,
      skip_password_requirement: false,
    }),
  });

  if (!clerkRes.ok) {
    const errBody = await clerkRes.json().catch(() => ({}));
    const msg = (errBody as any).errors?.[0]?.long_message ?? (errBody as any).errors?.[0]?.message ?? "Failed to create user in Clerk";
    res.status(400).json({ error: msg });
    return;
  }

  const clerkUser = await clerkRes.json() as { id: string };

  // Insert into our profiles table
  const [profile] = await db.insert(profilesTable).values({
    id: clerkUser.id,
    email,
    fullName: fullName || null,
    role: role || "free_user",
  }).returning();

  // If investment_client, create client_profiles row
  if (role === "investment_client") {
    await db.insert(clientProfilesTable).values({
      userId: clerkUser.id,
      advisorId: advisorId || null,
      riskProfile: riskProfile || null,
      status: status || "prospect",
    });
  }

  res.status(201).json(profile);
});

router.put("/admin/users/:id", ...adminGuard, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const { fullName, role, preferredCurrency, advisorId } = req.body;
  const [updated] = await db.update(profilesTable).set({
    ...(fullName !== undefined ? { fullName } : {}),
    ...(role !== undefined ? { role } : {}),
    ...(preferredCurrency !== undefined ? { preferredCurrency } : {}),
    updatedAt: new Date(),
  }).where(eq(profilesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  // Handle advisorId assignment for investment clients
  if (advisorId !== undefined) {
    const existing = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, id));
    if (existing.length > 0) {
      await db.update(clientProfilesTable).set({ advisorId: advisorId || null, updatedAt: new Date() }).where(eq(clientProfilesTable.userId, id));
    } else if (role === "investment_client" || updated.role === "investment_client") {
      await db.insert(clientProfilesTable).values({ userId: id, advisorId: advisorId || null });
    }
  }

  // If role changed TO investment_client, auto-create client_profiles
  if (role === "investment_client") {
    const existing = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, id));
    if (existing.length === 0) {
      await db.insert(clientProfilesTable).values({ userId: id, status: "prospect" });
    }
  }

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

  // Get all packages for these clients
  const clientIds = clients.map(c => c.id);
  if (clientIds.length === 0) { res.json([]); return; }

  const packages = await db.select({
    userId: clientPackagesTable.userId,
    status: clientPackagesTable.status,
    id: clientPackagesTable.id,
  }).from(clientPackagesTable).where(inArray(clientPackagesTable.userId, clientIds));

  // Get latest snapshot per package
  const pkgIds = packages.map(p => p.id);
  const snapshots = pkgIds.length > 0
    ? await db.select({
        clientPackageId: portfolioSnapshotsTable.clientPackageId,
        totalValueUsd: portfolioSnapshotsTable.totalValueUsd,
        snapshotDate: portfolioSnapshotsTable.snapshotDate,
      }).from(portfolioSnapshotsTable)
        .where(inArray(portfolioSnapshotsTable.clientPackageId, pkgIds))
        .orderBy(desc(portfolioSnapshotsTable.snapshotDate))
    : [];

  // Get advisors for name lookup
  const advisorIds = [...new Set(clients.map(c => c.advisorId).filter(Boolean) as string[])];
  const advisors = advisorIds.length > 0
    ? await db.select({ id: profilesTable.id, fullName: profilesTable.fullName, email: profilesTable.email })
        .from(profilesTable).where(inArray(profilesTable.id, advisorIds))
    : [];
  const advisorMap = Object.fromEntries(advisors.map(a => [a.id, a.fullName ?? a.email]));

  // Build latest snapshot map per package
  const latestSnap: Record<string, number> = {};
  for (const s of snapshots) {
    if (!latestSnap[s.clientPackageId]) {
      latestSnap[s.clientPackageId] = parseFloat(s.totalValueUsd as string);
    }
  }

  const result = clients.map(c => {
    const clientPkgs = packages.filter(p => p.userId === c.id);
    const activePkgs = clientPkgs.filter(p => p.status === "active");
    const portfolioValue = clientPkgs.reduce((sum, p) => sum + (latestSnap[p.id] ?? 0), 0);
    return {
      ...c,
      advisorName: c.advisorId ? advisorMap[c.advisorId] ?? null : null,
      portfolioValue,
      packagesCount: clientPkgs.length,
      activePackages: activePkgs.length,
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
