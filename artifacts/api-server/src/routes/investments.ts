import { Router, type IRouter } from "express";
import { eq, desc, and, inArray } from "drizzle-orm";
import {
  db,
  fundsTable,
  fundPricesTable,
  clientFinancialSnapshotsTable,
  clientPackagesTable,
  packageAllocationsTable,
  packageTransactionsTable,
  portfolioSnapshotsTable,
  scenariosTable,
  clientProfilesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ── Funds (read for all authenticated, write for advisor/admin) ──────────────

router.get("/funds", requireAuth, async (req, res): Promise<void> => {
  const funds = await db.select().from(fundsTable).where(eq(fundsTable.isActive, true)).orderBy(fundsTable.name);
  res.json(funds);
});

router.get("/funds/all", requireAuth, requireRole("advisor", "super_admin"), async (req, res): Promise<void> => {
  const funds = await db.select().from(fundsTable).orderBy(fundsTable.name);
  res.json(funds);
});

router.post("/funds", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const { name, ticker, isin, assetClass, geography, currency, fundManager, fundType, expenseRatio, benchmarkIndex, factsheetUrl, priceApiSymbol, priceApiExchange } = req.body;
  if (!name || !assetClass) { res.status(400).json({ error: "name and assetClass required" }); return; }
  const [fund] = await db.insert(fundsTable).values({ name, ticker, isin, assetClass, geography, currency, fundManager, fundType, expenseRatio, benchmarkIndex, factsheetUrl, priceApiSymbol, priceApiExchange }).returning();
  res.status(201).json(fund);
});

router.put("/funds/:id", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const updates = req.body;
  const [fund] = await db.update(fundsTable).set(updates).where(eq(fundsTable.id, id)).returning();
  if (!fund) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fund);
});

// ── Fund Prices ──────────────────────────────────────────────────────────────

router.get("/fund-prices", requireAuth, async (req, res): Promise<void> => {
  const { fundIds } = req.query;
  if (!fundIds) { res.status(400).json({ error: "fundIds required" }); return; }
  const ids = (fundIds as string).split(",");

  // Get latest price per fund using subquery approach
  const prices = await db.select().from(fundPricesTable)
    .where(inArray(fundPricesTable.fundId, ids))
    .orderBy(desc(fundPricesTable.priceDate));

  // Deduplicate to latest per fund
  const latest: Record<string, typeof prices[0]> = {};
  for (const p of prices) {
    if (!latest[p.fundId]) latest[p.fundId] = p;
  }
  res.json(Object.values(latest));
});

router.get("/fund-prices/:fundId/history", requireAuth, async (req, res): Promise<void> => {
  const fundId = req.params.fundId as string;
  const history = await db.select().from(fundPricesTable)
    .where(eq(fundPricesTable.fundId, fundId))
    .orderBy(desc(fundPricesTable.priceDate))
    .limit(180);
  res.json(history.reverse());
});

router.post("/fund-prices", requireAuth, requireRole("advisor", "super_admin"), async (req, res): Promise<void> => {
  const { fundId, priceDate, priceNative, priceUsd, change1d, change1dPercent, source } = req.body;
  if (!fundId || !priceDate || !priceNative || !priceUsd) { res.status(400).json({ error: "fundId, priceDate, priceNative, priceUsd required" }); return; }
  const existing = await db.select().from(fundPricesTable)
    .where(and(eq(fundPricesTable.fundId, fundId), eq(fundPricesTable.priceDate, priceDate)));
  let price;
  if (existing.length > 0) {
    [price] = await db.update(fundPricesTable).set({ priceNative, priceUsd, change1d, change1dPercent, source: source ?? "manual" }).where(eq(fundPricesTable.id, existing[0].id)).returning();
  } else {
    [price] = await db.insert(fundPricesTable).values({ fundId, priceDate, priceNative, priceUsd, change1d, change1dPercent, source: source ?? "manual" }).returning();
  }
  res.json(price);
});

// ── Client Financial Snapshot ────────────────────────────────────────────────

router.get("/client-financial-snapshot", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [snap] = await db.select().from(clientFinancialSnapshotsTable).where(eq(clientFinancialSnapshotsTable.userId, userId));
  if (!snap) { res.status(404).json({ error: "Not found" }); return; }
  res.json(snap);
});

router.post("/client-financial-snapshot", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { monthlyIncome, savingsRange, hasInvestments, investmentsRoughValue, hasDebts, debtsRoughValue } = req.body;
  const existing = await db.select().from(clientFinancialSnapshotsTable).where(eq(clientFinancialSnapshotsTable.userId, userId));
  let snap;
  if (existing.length > 0) {
    [snap] = await db.update(clientFinancialSnapshotsTable).set({ monthlyIncome, savingsRange, hasInvestments, investmentsRoughValue, hasDebts, debtsRoughValue }).where(eq(clientFinancialSnapshotsTable.userId, userId)).returning();
  } else {
    [snap] = await db.insert(clientFinancialSnapshotsTable).values({ userId, monthlyIncome, savingsRange, hasInvestments, investmentsRoughValue, hasDebts, debtsRoughValue }).returning();
  }
  res.json(snap);
});

// ── Client Profile (extended for investment portal) ──────────────────────────

router.get("/client-profile/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
  if (!cp) {
    // Auto-create if investment_client
    const [created] = await db.insert(clientProfilesTable).values({ userId }).returning();
    res.json(created);
    return;
  }
  res.json(cp);
});

router.put("/client-profile/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const updates = req.body;
  const existing = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
  let cp;
  if (existing.length > 0) {
    [cp] = await db.update(clientProfilesTable).set(updates).where(eq(clientProfilesTable.userId, userId)).returning();
  } else {
    [cp] = await db.insert(clientProfilesTable).values({ userId, ...updates }).returning();
  }
  res.json(cp);
});

// ── Client Packages ──────────────────────────────────────────────────────────

router.get("/packages", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const packages = await db.select().from(clientPackagesTable).where(eq(clientPackagesTable.userId, userId)).orderBy(desc(clientPackagesTable.createdAt));

  // Attach latest snapshot per package
  const result = await Promise.all(packages.map(async (pkg) => {
    const [snap] = await db.select().from(portfolioSnapshotsTable)
      .where(eq(portfolioSnapshotsTable.clientPackageId, pkg.id))
      .orderBy(desc(portfolioSnapshotsTable.snapshotDate))
      .limit(1);
    const allocs = await db.select({
      id: packageAllocationsTable.id,
      fundId: packageAllocationsTable.fundId,
      weightPercent: packageAllocationsTable.weightPercent,
      unitsHeld: packageAllocationsTable.unitsHeld,
      fund: { name: fundsTable.name, ticker: fundsTable.ticker, assetClass: fundsTable.assetClass },
    }).from(packageAllocationsTable)
      .leftJoin(fundsTable, eq(packageAllocationsTable.fundId, fundsTable.id))
      .where(and(eq(packageAllocationsTable.clientPackageId, pkg.id), eq(packageAllocationsTable.isActive, true)));
    return { ...pkg, latestSnapshot: snap ?? null, allocations: allocs };
  }));

  res.json(result);
});

router.get("/packages/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const [pkg] = await db.select().from(clientPackagesTable)
    .where(and(eq(clientPackagesTable.id, id), eq(clientPackagesTable.userId, userId)));
  if (!pkg) { res.status(404).json({ error: "Not found" }); return; }

  const allocations = await db.select({
    id: packageAllocationsTable.id,
    fundId: packageAllocationsTable.fundId,
    weightPercent: packageAllocationsTable.weightPercent,
    unitsHeld: packageAllocationsTable.unitsHeld,
    isActive: packageAllocationsTable.isActive,
    notes: packageAllocationsTable.notes,
    fund: { id: fundsTable.id, name: fundsTable.name, ticker: fundsTable.ticker, assetClass: fundsTable.assetClass, fundManager: fundsTable.fundManager, factsheetUrl: fundsTable.factsheetUrl },
  }).from(packageAllocationsTable)
    .leftJoin(fundsTable, eq(packageAllocationsTable.fundId, fundsTable.id))
    .where(eq(packageAllocationsTable.clientPackageId, id));

  const transactions = await db.select().from(packageTransactionsTable)
    .where(eq(packageTransactionsTable.clientPackageId, id))
    .orderBy(desc(packageTransactionsTable.transactionDate));

  const snapshots = await db.select().from(portfolioSnapshotsTable)
    .where(eq(portfolioSnapshotsTable.clientPackageId, id))
    .orderBy(portfolioSnapshotsTable.snapshotDate);

  res.json({ ...pkg, allocations, transactions, snapshots });
});

router.post("/packages", requireAuth, requireRole("advisor", "super_admin"), async (req, res): Promise<void> => {
  const advisorId = (req as any).userId;
  const { userId, goalId, nickname, type, monthlyAmount, lumpSumAmount, startDate, endDate, currency, expectedAnnualReturn, advisorNotes, allocations } = req.body;
  if (!userId || !nickname || !type) { res.status(400).json({ error: "userId, nickname, type required" }); return; }

  const [pkg] = await db.insert(clientPackagesTable).values({
    userId, advisorId, goalId, nickname, type, monthlyAmount, lumpSumAmount,
    startDate, endDate, currency, expectedAnnualReturn, advisorNotes,
  }).returning();

  if (allocations && Array.isArray(allocations) && allocations.length > 0) {
    await db.insert(packageAllocationsTable).values(
      allocations.map((a: any) => ({
        clientPackageId: pkg.id,
        fundId: a.fundId,
        weightPercent: a.weightPercent,
        unitsHeld: a.unitsHeld ?? "0",
        setBy: advisorId,
        effectiveFrom: new Date().toISOString().split("T")[0],
        notes: a.notes,
      })),
    );
  }

  // Initial snapshot
  await db.insert(portfolioSnapshotsTable).values({
    clientPackageId: pkg.id,
    userId,
    snapshotDate: new Date().toISOString().split("T")[0],
    totalInvestedUsd: "0",
    totalValueUsd: "0",
    totalReturnPercent: "0",
  });

  res.status(201).json(pkg);
});

router.put("/packages/:id", requireAuth, requireRole("advisor", "super_admin"), async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const updates = req.body;
  const [pkg] = await db.update(clientPackagesTable).set(updates).where(eq(clientPackagesTable.id, id)).returning();
  if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
  res.json(pkg);
});

// ── Package Allocations (advisor manages) ────────────────────────────────────

router.put("/packages/:id/allocations", requireAuth, requireRole("advisor", "super_admin"), async (req, res): Promise<void> => {
  const advisorId = (req as any).userId;
  const id = req.params.id as string;
  const { allocations } = req.body;
  if (!allocations) { res.status(400).json({ error: "allocations required" }); return; }

  // Deactivate old allocations
  await db.update(packageAllocationsTable).set({ isActive: false }).where(eq(packageAllocationsTable.clientPackageId, id));

  // Insert new ones
  if (allocations.length > 0) {
    await db.insert(packageAllocationsTable).values(
      allocations.map((a: any) => ({
        clientPackageId: id,
        fundId: a.fundId,
        weightPercent: a.weightPercent,
        unitsHeld: a.unitsHeld ?? "0",
        setBy: advisorId,
        effectiveFrom: new Date().toISOString().split("T")[0],
        notes: a.notes,
      })),
    );
  }

  const updated = await db.select({
    id: packageAllocationsTable.id,
    fundId: packageAllocationsTable.fundId,
    weightPercent: packageAllocationsTable.weightPercent,
    unitsHeld: packageAllocationsTable.unitsHeld,
    fund: { id: fundsTable.id, name: fundsTable.name, ticker: fundsTable.ticker, assetClass: fundsTable.assetClass },
  }).from(packageAllocationsTable)
    .leftJoin(fundsTable, eq(packageAllocationsTable.fundId, fundsTable.id))
    .where(and(eq(packageAllocationsTable.clientPackageId, id), eq(packageAllocationsTable.isActive, true)));

  res.json(updated);
});

// ── Package Transactions (advisor enters) ────────────────────────────────────

router.get("/packages/:id/transactions", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const txs = await db.select({
    id: packageTransactionsTable.id,
    transactionDate: packageTransactionsTable.transactionDate,
    transactionType: packageTransactionsTable.transactionType,
    amountUsd: packageTransactionsTable.amountUsd,
    units: packageTransactionsTable.units,
    pricePerUnitUsd: packageTransactionsTable.pricePerUnitUsd,
    notes: packageTransactionsTable.notes,
    createdAt: packageTransactionsTable.createdAt,
    fund: { name: fundsTable.name, ticker: fundsTable.ticker },
  }).from(packageTransactionsTable)
    .leftJoin(fundsTable, eq(packageTransactionsTable.fundId, fundsTable.id))
    .where(eq(packageTransactionsTable.clientPackageId, id))
    .orderBy(desc(packageTransactionsTable.transactionDate));
  res.json(txs);
});

router.post("/packages/:id/transactions", requireAuth, requireRole("advisor", "super_admin"), async (req, res): Promise<void> => {
  const createdBy = (req as any).userId;
  const clientPackageId = req.params.id as string;
  const { userId, fundId, transactionDate, transactionType, amountUsd, units, pricePerUnitUsd, notes } = req.body;
  if (!userId || !transactionDate || !transactionType || !amountUsd) {
    res.status(400).json({ error: "userId, transactionDate, transactionType, amountUsd required" });
    return;
  }
  const [tx] = await db.insert(packageTransactionsTable).values({
    clientPackageId, userId, fundId, transactionDate, transactionType,
    amountUsd, units, pricePerUnitUsd, notes, createdBy,
  }).returning();
  res.status(201).json(tx);
});

// ── Portfolio Snapshots ──────────────────────────────────────────────────────

router.get("/packages/:id/snapshots", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const snapshots = await db.select().from(portfolioSnapshotsTable)
    .where(eq(portfolioSnapshotsTable.clientPackageId, id))
    .orderBy(portfolioSnapshotsTable.snapshotDate);
  res.json(snapshots);
});

router.post("/packages/:id/snapshots", requireAuth, requireRole("advisor", "super_admin"), async (req, res): Promise<void> => {
  const clientPackageId = req.params.id as string;
  const { userId, snapshotDate, totalInvestedUsd, totalValueUsd, totalReturnPercent, fundBreakdown } = req.body;
  const existing = await db.select().from(portfolioSnapshotsTable)
    .where(and(eq(portfolioSnapshotsTable.clientPackageId, clientPackageId), eq(portfolioSnapshotsTable.snapshotDate, snapshotDate)));
  let snap;
  if (existing.length > 0) {
    [snap] = await db.update(portfolioSnapshotsTable).set({ totalInvestedUsd, totalValueUsd, totalReturnPercent, fundBreakdown }).where(eq(portfolioSnapshotsTable.id, existing[0].id)).returning();
  } else {
    [snap] = await db.insert(portfolioSnapshotsTable).values({ clientPackageId, userId, snapshotDate, totalInvestedUsd, totalValueUsd, totalReturnPercent, fundBreakdown }).returning();
  }
  res.json(snap);
});

// ── All transactions across all packages (client view) ───────────────────────

router.get("/transactions/all", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const txs = await db.select({
    id: packageTransactionsTable.id,
    clientPackageId: packageTransactionsTable.clientPackageId,
    transactionDate: packageTransactionsTable.transactionDate,
    transactionType: packageTransactionsTable.transactionType,
    amountUsd: packageTransactionsTable.amountUsd,
    units: packageTransactionsTable.units,
    pricePerUnitUsd: packageTransactionsTable.pricePerUnitUsd,
    notes: packageTransactionsTable.notes,
    createdAt: packageTransactionsTable.createdAt,
    fund: { name: fundsTable.name, ticker: fundsTable.ticker },
    package: { nickname: clientPackagesTable.nickname, type: clientPackagesTable.type },
  }).from(packageTransactionsTable)
    .leftJoin(fundsTable, eq(packageTransactionsTable.fundId, fundsTable.id))
    .leftJoin(clientPackagesTable, eq(packageTransactionsTable.clientPackageId, clientPackagesTable.id))
    .where(eq(packageTransactionsTable.userId, userId))
    .orderBy(desc(packageTransactionsTable.transactionDate));
  res.json(txs);
});

// ── Scenarios ────────────────────────────────────────────────────────────────

router.get("/scenarios", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rows = await db.select().from(scenariosTable)
    .where(eq(scenariosTable.userId, userId))
    .orderBy(desc(scenariosTable.createdAt))
    .limit(20);
  res.json(rows);
});

router.post("/scenarios", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { scenarioType, linkedGoalId, linkedPackageId, inputData, outputData, isAdvisorPushed, advisorNote } = req.body;
  if (!scenarioType || !inputData || !outputData) { res.status(400).json({ error: "scenarioType, inputData, outputData required" }); return; }
  const [scenario] = await db.insert(scenariosTable).values({
    userId, scenarioType, linkedGoalId, linkedPackageId,
    inputData, outputData, isAdvisorPushed: isAdvisorPushed ?? false, advisorNote,
  }).returning();
  res.status(201).json(scenario);
});

router.put("/scenarios/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const { status } = req.body;
  const [updated] = await db.update(scenariosTable).set({ status })
    .where(and(eq(scenariosTable.id, id), eq(scenariosTable.userId, userId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ── Advisor: client packages view ────────────────────────────────────────────

router.get("/advisor/clients/:clientId/packages", requireAuth, requireRole("advisor", "super_admin"), async (req, res): Promise<void> => {
  const clientId = req.params.clientId as string;
  const packages = await db.select().from(clientPackagesTable)
    .where(eq(clientPackagesTable.userId, clientId))
    .orderBy(desc(clientPackagesTable.createdAt));
  const result = await Promise.all(packages.map(async (pkg) => {
    const [snap] = await db.select().from(portfolioSnapshotsTable)
      .where(eq(portfolioSnapshotsTable.clientPackageId, pkg.id))
      .orderBy(desc(portfolioSnapshotsTable.snapshotDate)).limit(1);
    const allocs = await db.select({
      id: packageAllocationsTable.id,
      fundId: packageAllocationsTable.fundId,
      weightPercent: packageAllocationsTable.weightPercent,
      unitsHeld: packageAllocationsTable.unitsHeld,
      isActive: packageAllocationsTable.isActive,
      fund: { id: fundsTable.id, name: fundsTable.name, ticker: fundsTable.ticker, assetClass: fundsTable.assetClass },
    }).from(packageAllocationsTable)
      .leftJoin(fundsTable, eq(packageAllocationsTable.fundId, fundsTable.id))
      .where(eq(packageAllocationsTable.clientPackageId, pkg.id));
    return { ...pkg, latestSnapshot: snap ?? null, allocations: allocs };
  }));
  res.json(result);
});

router.get("/advisor/clients/:clientId/transactions", requireAuth, requireRole("advisor", "super_admin"), async (req, res): Promise<void> => {
  const clientId = req.params.clientId as string;
  const txs = await db.select({
    id: packageTransactionsTable.id,
    clientPackageId: packageTransactionsTable.clientPackageId,
    transactionDate: packageTransactionsTable.transactionDate,
    transactionType: packageTransactionsTable.transactionType,
    amountUsd: packageTransactionsTable.amountUsd,
    units: packageTransactionsTable.units,
    pricePerUnitUsd: packageTransactionsTable.pricePerUnitUsd,
    notes: packageTransactionsTable.notes,
    fund: { name: fundsTable.name, ticker: fundsTable.ticker },
    package: { nickname: clientPackagesTable.nickname },
  }).from(packageTransactionsTable)
    .leftJoin(fundsTable, eq(packageTransactionsTable.fundId, fundsTable.id))
    .leftJoin(clientPackagesTable, eq(packageTransactionsTable.clientPackageId, clientPackagesTable.id))
    .where(eq(packageTransactionsTable.userId, clientId))
    .orderBy(desc(packageTransactionsTable.transactionDate));
  res.json(txs);
});

export default router;
