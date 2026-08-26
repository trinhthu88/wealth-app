import { Router, type IRouter } from "express";
import { eq, desc, and, ne, sql } from "drizzle-orm";
import {
  db, profilesTable, clientProfilesTable,
  advisedPlansTable, advisedPlanStatementsTable, advisedPlanHoldingsTable,
  clientHoldingsTable, clientHoldingTransactionsTable, clientBudgetMonthsTable, advisedPlanTransactionsTable,
  scenarioRunsTable, financialGoalsTable, netWorthSnapshotsTable, assetsTable, liabilitiesTable,
  financialPlansTable, planMilestonesTable, milestoneCommentsTable,
  conversationsTable, messagesTable, advisedStrategyReturnsTable,
} from "@workspace/db";
import { requireAuth, requireRole, requireAdvisorOwnsClient, requireAdvisorOwnsLead, requireAdvisorOwnsClientOrLead, requireAdvisorOwnsPlan } from "../middlewares/requireAuth";
import { resolveHoldingBenchmark, getDeviationWarning } from "../lib/benchmarks";
import { recordHoldingTransaction, upsertMonthlyHoldingLedgerEntry, getOrCreateDefaultCashHolding } from "../lib/holdingTransactions";
import { syncAdvisedPlanContributionsToBudget } from "../lib/advisedPlanBudgetSync";

const router: IRouter = Router();

// ── Client profile track (used by useClientTrack) ─────────────────────────
router.get("/client/profile/track", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [cp] = await db.select({
    clientTrack: clientProfilesTable.clientTrack,
    onboardingTrackComplete: clientProfilesTable.onboardingTrackComplete,
    preferredDisplayCurrency: clientProfilesTable.preferredDisplayCurrency,
    advisorId: clientProfilesTable.advisorId,
  }).from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));

  res.json(cp ?? { clientTrack: "track_b", onboardingTrackComplete: false, preferredDisplayCurrency: "USD" });
});

// ── Save profile basics during onboarding ────────────────────────────────
router.put("/client/profile/basics", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { fullName, countryCode, isExpat, preferredDisplayCurrency } = req.body;

  // Update profiles table
  await db.update(profilesTable)
    .set({ fullName: fullName ?? null, countryCode: countryCode ?? null, isExpat: isExpat ?? false, updatedAt: new Date() })
    .where(eq(profilesTable.id, userId));

  // Upsert client_profiles
  const existing = await db.select({ id: clientProfilesTable.id })
    .from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));

  let cp;
  if (existing.length > 0) {
    [cp] = await db.update(clientProfilesTable)
      .set({ preferredDisplayCurrency: preferredDisplayCurrency ?? "USD", updatedAt: new Date() })
      .where(eq(clientProfilesTable.userId, userId))
      .returning();
  } else {
    [cp] = await db.insert(clientProfilesTable)
      .values({ userId, preferredDisplayCurrency: preferredDisplayCurrency ?? "USD" })
      .returning();
  }
  res.json(cp);
});

// ── Mark onboarding complete ──────────────────────────────────────────────
router.post("/client/onboarding/complete", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { preferredDisplayCurrency } = req.body;

  await db.update(profilesTable)
    .set({ onboardingComplete: true, updatedAt: new Date() })
    .where(eq(profilesTable.id, userId));

  const existing = await db.select({ id: clientProfilesTable.id })
    .from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));

  let cp;
  if (existing.length > 0) {
    [cp] = await db.update(clientProfilesTable)
      .set({
        onboardingTrackComplete: true,
        ...(preferredDisplayCurrency ? { preferredDisplayCurrency } : {}),
        updatedAt: new Date(),
      })
      .where(eq(clientProfilesTable.userId, userId))
      .returning();
  } else {
    [cp] = await db.insert(clientProfilesTable)
      .values({ userId, onboardingTrackComplete: true, preferredDisplayCurrency: preferredDisplayCurrency ?? "USD" })
      .returning();
  }
  res.json(cp);
});

// ── Advised plans ─────────────────────────────────────────────────────────
router.get("/client/advised-plans", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;

  const plans = await db.select().from(advisedPlansTable)
    .where(and(eq(advisedPlansTable.userId, userId), eq(advisedPlansTable.isVisibleToClient, true)))
    .orderBy(desc(advisedPlansTable.createdAt));

  // Enrich each plan with its latest statement + holdings
  const enriched = await Promise.all(plans.map(async (plan) => {
    const [latestStatement] = await db.select()
      .from(advisedPlanStatementsTable)
      .where(eq(advisedPlanStatementsTable.advisedPlanId, plan.id))
      .orderBy(desc(advisedPlanStatementsTable.periodEnd))
      .limit(1);

    const latestHoldings = latestStatement
      ? await db.select().from(advisedPlanHoldingsTable)
          .where(eq(advisedPlanHoldingsTable.statementId, latestStatement.id))
      : [];

    return { ...plan, latestStatement: latestStatement ?? null, latestHoldings };
  }));

  res.json(enriched);
});

// Advisor route: create/update advised plan. Uses requireAdvisorOwnsClientOrLead
// so the same route serves a lead (not yet promoted) and an already-promoted
// client identically — see that middleware's comment for why this tree isn't
// duplicated the way the read-only Goals/NetWorth/Holdings routes are.
router.post("/advisor/clients/:id/advised-plans", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClientOrLead("id"), async (req, res): Promise<void> => {
  const advisorId = (req as any).userId;
  const userId = req.params.id as string;
  const {
    providerName, productCode, productName, policyNumber, introducerCode,
    planType, currency, termYears, annualPremium, initialPremium,
    effectiveDate, maturityDate, status, latestAccountValue, latestNetContribution,
    latestStatementDate, nickname, advisorNotes, isVisibleToClient,
  } = req.body;

  if (!providerName || !productName) {
    res.status(400).json({ error: "providerName and productName required" });
    return;
  }

  const [plan] = await db.insert(advisedPlansTable).values({
    userId, advisorId,
    providerName, productCode: productCode ?? null, productName,
    policyNumber: policyNumber ?? null, introducerCode: introducerCode ?? null,
    planType: planType ?? "rsp", currency: currency ?? "USD",
    termYears: termYears ?? null, annualPremium: annualPremium ?? "0", initialPremium: initialPremium ?? "0",
    effectiveDate: effectiveDate ?? null, maturityDate: maturityDate ?? null,
    // A plan starts as a scenario an advisor runs for a lead — it only becomes
    // "inforce" once policyNumber is filled and the advisor explicitly flips it
    // (see the lead-detail plan-status endpoint added for the lead pipeline).
    status: status ?? "scenario",
    latestAccountValue: latestAccountValue ?? "0", latestNetContribution: latestNetContribution ?? "0",
    latestStatementDate: latestStatementDate ?? null,
    nickname: nickname ?? null, advisorNotes: advisorNotes ?? null,
    isVisibleToClient: isVisibleToClient ?? true,
  }).returning();

  // Auto-set client to track_a
  await db.update(clientProfilesTable)
    .set({ clientTrack: "track_a", updatedAt: new Date() })
    .where(eq(clientProfilesTable.userId, userId));

  res.status(201).json(plan);
});

// ── Advisor: list plans for a client ─────────────────────────────────────
router.get("/advisor/clients/:id/advised-plans", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClientOrLead("id"), async (req, res): Promise<void> => {
  const userId = req.params.id as string;
  const plans = await db.select().from(advisedPlansTable)
    .where(eq(advisedPlansTable.userId, userId))
    .orderBy(desc(advisedPlansTable.createdAt));
  res.json(plans);
});

// ── Advisor: get statements for a plan ───────────────────────────────────
router.get("/advisor/clients/:clientId/advised-plans/:planId/statements", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClientOrLead("clientId"), async (req, res): Promise<void> => {
  const planId = req.params.planId as string;
  const stmts = await db.select().from(advisedPlanStatementsTable)
    .where(eq(advisedPlanStatementsTable.advisedPlanId, planId))
    .orderBy(desc(advisedPlanStatementsTable.periodEnd));
  res.json(stmts);
});

// ── Client: get statements per plan (for client portal) ──────────────────
router.get("/client/advised-plans/:planId/statements", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const planId = req.params.planId as string;
  const [plan] = await db.select({ id: advisedPlansTable.id })
    .from(advisedPlansTable).where(and(eq(advisedPlansTable.id, planId), eq(advisedPlansTable.userId, userId)));
  if (!plan) { res.status(403).json({ error: "Forbidden" }); return; }
  const stmts = await db.select().from(advisedPlanStatementsTable)
    .where(eq(advisedPlanStatementsTable.advisedPlanId, planId))
    .orderBy(desc(advisedPlanStatementsTable.periodEnd));
  res.json(stmts);
});

// ── Client: last 20 transactions for a plan (across all its statements) ──
router.get("/client/advised-plans/:planId/transactions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const planId = req.params.planId as string;
  const [plan] = await db.select({ id: advisedPlansTable.id })
    .from(advisedPlansTable).where(and(eq(advisedPlansTable.id, planId), eq(advisedPlansTable.userId, userId)));
  if (!plan) { res.status(403).json({ error: "Forbidden" }); return; }
  const rows = await db.select().from(advisedPlanTransactionsTable)
    .where(eq(advisedPlanTransactionsTable.advisedPlanId, planId))
    .orderBy(desc(advisedPlanTransactionsTable.transactionDate))
    .limit(20);
  res.json(rows);
});

// ── Client: get holdings for a statement ─────────────────────────────────
router.get("/client/advised-plans/:planId/statements/:stmtId/holdings", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const stmtId = req.params.stmtId as string;
  const holdings = await db.select().from(advisedPlanHoldingsTable)
    .where(and(eq(advisedPlanHoldingsTable.statementId, stmtId), eq(advisedPlanHoldingsTable.userId, userId)));
  res.json(holdings);
});

// ── Advisor: add statement + holdings + transactions ──────────────────────
router.post("/advisor/clients/:clientId/advised-plans/:planId/statements", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClientOrLead("clientId"), async (req, res): Promise<void> => {
  const advisorId = (req as any).userId;
  const planId = req.params.planId as string;
  const clientId = req.params.clientId as string;
  const {
    periodStart, periodEnd, statementDate, entryMode,
    openingValue, closingValue, contributions, extraAllocations,
    policyFee, assetManagementFee, adminCharges, advisoryServicesFee,
    bidOfferSpread, surrenders, surrenderCharges, investmentReturns,
    funds = [], transactions = [],
    newLatestAccountValue, newLatestNetContribution,
  } = req.body;

  if (!periodStart || !periodEnd || openingValue == null || closingValue == null) {
    res.status(400).json({ error: "periodStart, periodEnd, openingValue, closingValue required" });
    return;
  }

  const s = (v: unknown) => v != null ? String(v) : "0";

  const [stmt] = await db.insert(advisedPlanStatementsTable).values({
    advisedPlanId: planId, userId: clientId,
    periodStart, periodEnd, statementDate: statementDate ?? null,
    openingValue: s(openingValue), closingValue: s(closingValue),
    contributions: s(contributions), extraAllocations: s(extraAllocations),
    policyFee: s(policyFee), assetManagementFee: s(assetManagementFee),
    adminCharges: s(adminCharges), advisoryServicesFee: s(advisoryServicesFee),
    bidOfferSpread: s(bidOfferSpread), surrenders: s(surrenders),
    surrenderCharges: s(surrenderCharges), investmentReturns: s(investmentReturns),
    enteredBy: advisorId, entryMode: entryMode ?? "summary",
  }).returning();

  // Insert fund holdings
  if (funds.length > 0) {
    await db.insert(advisedPlanHoldingsTable).values(
      funds.filter((f: any) => f.fundCode && f.fundName).map((f: any) => ({
        statementId: stmt.id, advisedPlanId: planId, userId: clientId,
        fundCode: f.fundCode, fundName: f.fundName,
        unitValueDate: f.unitValueDate || periodEnd,
        unitValue: f.unitValue ? String(f.unitValue) : null,
        unitsHeld: f.unitsHeld ? String(f.unitsHeld) : null,
        holdingValue: f.holdingValue ? String(f.holdingValue) : (f.unitValue && f.unitsHeld ? String(parseFloat(f.unitValue) * parseFloat(f.unitsHeld)) : null),
        finalValue: f.holdingValue ? String(f.holdingValue) : null,
        futureAllocationPct: f.futureAllocationPct ? String(f.futureAllocationPct) : "0",
      }))
    );
  }

  // Insert transactions (full_detail mode)
  if (entryMode === "full_detail" && transactions.length > 0) {
    await db.insert(advisedPlanTransactionsTable).values(
      transactions.filter((t: any) => t.fundCode && t.description && t.netAmount).map((t: any) => ({
        statementId: stmt.id, advisedPlanId: planId, userId: clientId,
        fundCode: t.fundCode, fundName: t.fundName ?? null,
        transactionDate: t.transactionDate, description: t.description,
        netAmount: String(t.netAmount),
        unitValue: t.unitValue ? String(t.unitValue) : null,
        unitsThisTransaction: t.unitsThisTransaction ? String(t.unitsThisTransaction) : null,
      }))
    );
  }

  // Update plan latest values
  if (newLatestAccountValue != null) {
    await db.update(advisedPlansTable)
      .set({
        latestAccountValue: String(newLatestAccountValue),
        latestNetContribution: String(newLatestNetContribution ?? 0),
        latestStatementDate: periodEnd,
        updatedAt: new Date(),
      })
      .where(eq(advisedPlansTable.id, planId));
  }

  res.status(201).json(stmt);
});

// Flips a plan's status — the "scenario → inforce" transition specifically
// requires a policyNumber in the same request (Phase 0's validation rule);
// blocked otherwise rather than allowing an in-force plan with no policy
// number. Keyed by the plan itself (requireAdvisorOwnsPlan), not by a
// client/lead id, so it works the same whether the owning user has been
// promoted yet or not.
router.put("/advised-plans/:id/status", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsPlan("id"), async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const { status, policyNumber } = req.body;
  if (!status) { res.status(400).json({ error: "status required" }); return; }

  const [plan] = await db.select().from(advisedPlansTable).where(eq(advisedPlansTable.id, id));
  if (!plan) { res.status(404).json({ error: "Not found" }); return; }

  const resolvedPolicyNumber = policyNumber !== undefined ? policyNumber : plan.policyNumber;
  if (status === "inforce" && !resolvedPolicyNumber) {
    res.status(400).json({ error: "policyNumber is required to mark a plan in-force" });
    return;
  }

  const [updated] = await db.update(advisedPlansTable).set({
    status,
    ...(policyNumber !== undefined ? { policyNumber } : {}),
    updatedAt: new Date(),
  }).where(eq(advisedPlansTable.id, id)).returning();

  // Going in-force should immediately (and retroactively, from when the plan
  // actually took effect) show up as a budget contribution — not wait for the
  // client to happen to open the Budget page. Best-effort: a sync failure
  // shouldn't block the status change itself from succeeding.
  if (updated.status === "inforce") {
    const fromMonth = (updated.effectiveDate ?? new Date().toISOString().slice(0, 10)).slice(0, 7) + "-01";
    try {
      await syncAdvisedPlanContributionsToBudget(db, { userId: updated.userId, fromMonth });
    } catch { /* status change still succeeds even if the budget sync fails */ }
  }

  res.json(updated);
});

// Edits a plan's current, going-forward contribution rate — annualPremium
// (the RSP premium; the client-facing monthly figure is annualPremium / 12)
// and/or initialPremium (the lump-sum amount). Deliberately separate from the
// status route above: this never touches status/policyNumber, and a status
// change never touches these fields. Also deliberately doesn't rewrite any
// advised_plan_statements rows — those remain the historical record of what
// was actually contributed; this only changes the rate applied going forward
// (and is what POST /client/budget/sync-contributions reads live).
router.put("/advised-plans/:id/contribution", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsPlan("id"), async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const { annualPremium, initialPremium } = req.body;
  if (annualPremium == null && initialPremium == null) {
    res.status(400).json({ error: "annualPremium or initialPremium required" });
    return;
  }

  const [plan] = await db.select().from(advisedPlansTable).where(eq(advisedPlansTable.id, id));
  if (!plan) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db.update(advisedPlansTable).set({
    ...(annualPremium != null ? { annualPremium: String(annualPremium) } : {}),
    ...(initialPremium != null ? { initialPremium: String(initialPremium) } : {}),
    updatedAt: new Date(),
  }).where(eq(advisedPlansTable.id, id)).returning();

  // Only backfill if the plan is actually in-force — a scenario-stage premium
  // edit is just modeling and shouldn't touch the client's real budget history.
  if (updated.status === "inforce" && annualPremium != null) {
    const fromMonth = (updated.effectiveDate ?? new Date().toISOString().slice(0, 10)).slice(0, 7) + "-01";
    try {
      await syncAdvisedPlanContributionsToBudget(db, { userId: updated.userId, fromMonth });
    } catch { /* premium change still succeeds even if the budget sync fails */ }
  }

  res.json(updated);
});

// ── Client self-entered holdings ──────────────────────────────────────────

// Shared by the client's own route and the advisor-owns-lead route below —
// self-held holdings exist on a userId regardless of the account's current role.
function getActiveHoldingsForUser(userId: string) {
  return db.select().from(clientHoldingsTable)
    .where(and(eq(clientHoldingsTable.userId, userId), eq(clientHoldingsTable.isActive, true)))
    .orderBy(desc(clientHoldingsTable.createdAt));
}

router.get("/client/holdings", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  res.json(await getActiveHoldingsForUser(userId));
});

// Advisor read-only view of a lead's self-held holdings. No advisor route for
// an already-promoted client exists yet; this is scoped to leads specifically,
// per the lead pipeline redesign.
router.get("/advisor/leads/:id/holdings", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsLead("id"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  res.json(await getActiveHoldingsForUser(rawId));
});

router.post("/client/holdings", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const {
    holdingType, label, currency, purchaseDate, notes, expectedAnnualReturnPct,
    ticker, brokerPlatform, unitsHeld, averageCostPrice,
    coinSymbol, exchangeName,
    propertyAddress, country, purchasePrice, currentEstimatedValue, outstandingMortgage, monthlyRentalIncome,
    bankName, accountType, currentBalance, interestRatePct,
    schemeName, pensionCountry, currentBalancePension, monthlyContribution, employerContribution,
    currentValueOther, totalInvestedOther,
  } = req.body;

  if (!holdingType || !label) {
    res.status(400).json({ error: "holdingType and label required" });
    return;
  }

  const [holding] = await db.insert(clientHoldingsTable).values({
    userId, holdingType, label, currency: currency ?? "USD",
    purchaseDate: purchaseDate ?? null, notes: notes ?? null,
    expectedAnnualReturnPct: expectedAnnualReturnPct != null ? String(expectedAnnualReturnPct) : null,
    ticker: ticker ?? null, brokerPlatform: brokerPlatform ?? null,
    unitsHeld: unitsHeld != null ? String(unitsHeld) : null,
    averageCostPrice: averageCostPrice != null ? String(averageCostPrice) : null,
    coinSymbol: coinSymbol ?? null, exchangeName: exchangeName ?? null,
    propertyAddress: propertyAddress ?? null, country: country ?? null,
    purchasePrice: purchasePrice != null ? String(purchasePrice) : null,
    currentEstimatedValue: currentEstimatedValue != null ? String(currentEstimatedValue) : null,
    outstandingMortgage: outstandingMortgage != null ? String(outstandingMortgage) : "0",
    monthlyRentalIncome: monthlyRentalIncome != null ? String(monthlyRentalIncome) : "0",
    bankName: bankName ?? null, accountType: accountType ?? null,
    currentBalance: currentBalance != null ? String(currentBalance) : null,
    interestRatePct: interestRatePct != null ? String(interestRatePct) : null,
    schemeName: schemeName ?? null, pensionCountry: pensionCountry ?? null,
    currentBalancePension: currentBalancePension != null ? String(currentBalancePension) : null,
    monthlyContribution: monthlyContribution != null ? String(monthlyContribution) : "0",
    employerContribution: employerContribution != null ? String(employerContribution) : "0",
    currentValueOther: currentValueOther != null ? String(currentValueOther) : null,
    totalInvestedOther: totalInvestedOther != null ? String(totalInvestedOther) : null,
  }).returning();

  res.status(201).json(holding);
});

router.put("/client/holdings/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const body = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const numericFields = ["unitsHeld", "averageCostPrice", "purchasePrice", "currentEstimatedValue",
    "outstandingMortgage", "monthlyRentalIncome", "currentBalance", "interestRatePct",
    "currentBalancePension", "monthlyContribution", "employerContribution",
    "currentValueOther", "totalInvestedOther", "expectedAnnualReturnPct"];

  for (const [k, v] of Object.entries(body)) {
    if (numericFields.includes(k)) {
      updates[k] = v != null ? String(v) : null;
    } else {
      updates[k] = v;
    }
  }

  const [holding] = await db.update(clientHoldingsTable)
    .set(updates as any)
    .where(and(eq(clientHoldingsTable.id, id), eq(clientHoldingsTable.userId, userId)))
    .returning();

  if (!holding) { res.status(404).json({ error: "Not found" }); return; }
  res.json(holding);
});

router.delete("/client/holdings/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  await db.update(clientHoldingsTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(clientHoldingsTable.id, id), eq(clientHoldingsTable.userId, userId)));
  res.sendStatus(204);
});

// ── Self-held holding transactions (money in / money out history) ────────

router.get("/client/holdings/:id/transactions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const [holding] = await db.select({ id: clientHoldingsTable.id }).from(clientHoldingsTable)
    .where(and(eq(clientHoldingsTable.id, id), eq(clientHoldingsTable.userId, userId)));
  if (!holding) { res.status(404).json({ error: "Not found" }); return; }

  const rows = await db.select().from(clientHoldingTransactionsTable)
    .where(eq(clientHoldingTransactionsTable.holdingId, id))
    .orderBy(desc(clientHoldingTransactionsTable.transactionDate), desc(clientHoldingTransactionsTable.createdAt));
  res.json(rows);
});

const MANUAL_TX_TYPES = new Set(["in", "out", "fee", "value_update"]);

router.post("/client/holdings/:id/transactions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const { type, amount, description, transactionDate, units } = req.body;
  if (!MANUAL_TX_TYPES.has(type) || !(Number(amount) > 0)) {
    res.status(400).json({ error: "type ('in', 'out', 'fee', or 'value_update') and a positive amount are required" });
    return;
  }
  try {
    const row = await recordHoldingTransaction(db, {
      holdingId: id, userId, type, amount: Number(amount),
      source: "manual", description: description ?? null, transactionDate,
      units: units != null ? Number(units) : null,
    });
    res.status(201).json(row);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

router.delete("/client/holdings/:id/transactions/:txId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { id, txId } = req.params as { id: string; txId: string };

  const [row] = await db.select().from(clientHoldingTransactionsTable)
    .where(and(
      eq(clientHoldingTransactionsTable.id, txId),
      eq(clientHoldingTransactionsTable.holdingId, id),
      eq(clientHoldingTransactionsTable.userId, userId),
    ));
  // Only manual entries are user-deletable — synced budget_contribution/surplus_sweep
  // rows are managed by the budget save flow (POST /client/budget), not directly.
  if (!row || row.source !== "manual") { res.status(404).json({ error: "Not found" }); return; }

  const [holding] = await db.select().from(clientHoldingsTable).where(eq(clientHoldingsTable.id, id));
  await db.delete(clientHoldingTransactionsTable).where(eq(clientHoldingTransactionsTable.id, txId));
  // "value_update" set an absolute value rather than a delta — there's no
  // reliable prior value to restore (other transactions may have followed
  // it), so deleting one only removes the ledger row, not the holding's value.
  if (holding?.holdingType === "cash" && (row.type === "in" || row.type === "out" || row.type === "fee")) {
    const delta = row.type === "in" ? -parseFloat(row.amount) : parseFloat(row.amount);
    await db.update(clientHoldingsTable)
      .set({ currentBalance: sql`${clientHoldingsTable.currentBalance} + ${delta}`, updatedAt: new Date() })
      .where(eq(clientHoldingsTable.id, id));
  }
  res.sendStatus(204);
});

// Advisor read-only view of a lead's self-held holding transactions — mirrors
// GET /advisor/leads/:id/holdings above.
router.get("/advisor/leads/:id/holdings/:holdingId/transactions", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsLead("id"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const holdingId = req.params.holdingId as string;
  const [holding] = await db.select({ id: clientHoldingsTable.id }).from(clientHoldingsTable)
    .where(and(eq(clientHoldingsTable.id, holdingId), eq(clientHoldingsTable.userId, rawId)));
  if (!holding) { res.status(404).json({ error: "Not found" }); return; }

  const rows = await db.select().from(clientHoldingTransactionsTable)
    .where(eq(clientHoldingTransactionsTable.holdingId, holdingId))
    .orderBy(desc(clientHoldingTransactionsTable.transactionDate));
  res.json(rows);
});

function deviationResponse(value: number | null, benchmarkValue: number | null) {
  if (value == null || benchmarkValue == null) return null;
  const warning = getDeviationWarning(value, benchmarkValue);
  return warning ? { deltaPoints: warning.deltaPoints, isOptimistic: warning.isOptimistic } : null;
}

// Resolve the expected-return benchmark for a holding shape that may not be saved yet
// (used by the add/edit holding form to preview the benchmark + deviation as the client types).
router.post("/client/holdings/benchmark-preview", requireAuth, async (req, res): Promise<void> => {
  const { holdingType, ticker, coinSymbol, interestRatePct, expectedAnnualReturnPct } = req.body;
  if (!holdingType) { res.status(400).json({ error: "holdingType required" }); return; }
  const result = await resolveHoldingBenchmark({ holdingType, ticker, coinSymbol, interestRatePct, expectedAnnualReturnPct });
  res.json({
    ...result,
    deviation: deviationResponse(result.isOverride ? result.value : null, result.benchmarkValue),
  });
});

// Resolve the benchmark for an already-saved holding.
router.get("/client/holdings/:id/benchmark", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const [holding] = await db.select().from(clientHoldingsTable)
    .where(and(eq(clientHoldingsTable.id, id), eq(clientHoldingsTable.userId, userId)));
  if (!holding) { res.status(404).json({ error: "Not found" }); return; }
  const result = await resolveHoldingBenchmark({
    holdingType: holding.holdingType,
    ticker: holding.ticker,
    coinSymbol: holding.coinSymbol,
    interestRatePct: holding.interestRatePct,
    expectedAnnualReturnPct: holding.expectedAnnualReturnPct,
  });
  res.json({
    ...result,
    deviation: deviationResponse(result.isOverride ? result.value : null, result.benchmarkValue),
  });
});

// Read-only, non-admin: target strategy returns for the "bring under management"
// comparison (self-tracked-holding scenario). Not sensitive — same data shown to admins.
router.get("/client/advised-strategy-returns", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(advisedStrategyReturnsTable).orderBy(advisedStrategyReturnsTable.planType);
  res.json(rows);
});

// ── Client budget months ──────────────────────────────────────────────────
router.get("/client/budget", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const limit = parseInt(String(req.query.limit ?? "12"), 10);
  const months = await db.select().from(clientBudgetMonthsTable)
    .where(eq(clientBudgetMonthsTable.userId, userId))
    .orderBy(desc(clientBudgetMonthsTable.month))
    .limit(limit);
  res.json(months);
});

router.get("/client/budget/:month", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const month = req.params.month as string;
  const [row] = await db.select().from(clientBudgetMonthsTable)
    .where(and(eq(clientBudgetMonthsTable.userId, userId), eq(clientBudgetMonthsTable.month, month)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/client/budget", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const {
    month, currency,
    primaryIncome, secondaryIncome, rentalIncome, otherIncome,
    housing, utilities, transport, insurance,
    foodDining, entertainment, shopping, health, education, otherExpenses,
    investmentContributions,
    notes,
  } = req.body;

  if (!month) { res.status(400).json({ error: "month required (YYYY-MM-DD)" }); return; }

  const n = (v: unknown) => parseFloat(String(v ?? "0")) || 0;
  const toStr = (v: unknown) => v != null ? String(v) : "0";
  const contributions = Array.isArray(investmentContributions) ? investmentContributions : [];

  // totalIncome/totalExpenses/totalInvestments/netSurplus/savingsRatePct are
  // computed here from the category fields, not trusted from the request body —
  // a client (or a frontend bug) submitting a category breakdown that doesn't
  // match its own totals would otherwise go uncaught.
  const totalIncome = n(primaryIncome) + n(secondaryIncome) + n(rentalIncome) + n(otherIncome);
  const totalExpenses = n(housing) + n(utilities) + n(transport) + n(insurance)
    + n(foodDining) + n(entertainment) + n(shopping) + n(health) + n(education) + n(otherExpenses);
  const totalInvestments = contributions.reduce((sum: number, c: any) => sum + n(c?.amount), 0);
  const netSurplus = totalIncome - totalExpenses - totalInvestments;
  const savingsRatePct = totalIncome > 0 ? (netSurplus / totalIncome) * 100 : 0;

  const values = {
    userId, month, currency: currency ?? "USD",
    primaryIncome: toStr(primaryIncome), secondaryIncome: toStr(secondaryIncome),
    rentalIncome: toStr(rentalIncome), otherIncome: toStr(otherIncome),
    housing: toStr(housing), utilities: toStr(utilities),
    transport: toStr(transport), insurance: toStr(insurance),
    foodDining: toStr(foodDining), entertainment: toStr(entertainment),
    shopping: toStr(shopping), health: toStr(health),
    education: toStr(education), otherExpenses: toStr(otherExpenses),
    investmentContributions: contributions,
    totalIncome: String(totalIncome), totalExpenses: String(totalExpenses),
    totalInvestments: String(totalInvestments), netSurplus: String(netSurplus),
    savingsRatePct: String(savingsRatePct),
    notes: notes ?? null,
  };

  const existing = await db.select({ id: clientBudgetMonthsTable.id })
    .from(clientBudgetMonthsTable)
    .where(and(eq(clientBudgetMonthsTable.userId, userId), eq(clientBudgetMonthsTable.month, month)));

  let row;
  if (existing.length > 0) {
    [row] = await db.update(clientBudgetMonthsTable)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(clientBudgetMonthsTable.userId, userId), eq(clientBudgetMonthsTable.month, month)))
      .returning();
  } else {
    [row] = await db.insert(clientBudgetMonthsTable).values(values).returning();
  }

  // ── Attribute contributions to self-tracked holdings, and sweep whatever's
  // left of netSurplus into a cash holding — both idempotent per (holding,
  // month, source) so re-saving this same month never double-counts.
  const ownedHoldings = await db.select({ id: clientHoldingsTable.id }).from(clientHoldingsTable)
    .where(and(eq(clientHoldingsTable.userId, userId), eq(clientHoldingsTable.isActive, true)));
  const ownedHoldingIds = new Set(ownedHoldings.map(h => h.id));

  const selfHoldingEntries = contributions.filter(
    (c: any) => c?.source_type === "self_holding" && ownedHoldingIds.has(c.source_id),
  );
  const nextHoldingIds = new Set(selfHoldingEntries.map((c: any) => c.source_id as string));

  const priorContribRows = await db.select().from(clientHoldingTransactionsTable).where(and(
    eq(clientHoldingTransactionsTable.userId, userId),
    eq(clientHoldingTransactionsTable.sourceMonth, month),
    eq(clientHoldingTransactionsTable.source, "budget_contribution"),
  ));
  for (const prior of priorContribRows) {
    if (!nextHoldingIds.has(prior.holdingId)) {
      await upsertMonthlyHoldingLedgerEntry(db, {
        holdingId: prior.holdingId, userId, source: "budget_contribution", sourceMonth: month, amount: 0,
      });
    }
  }
  for (const c of selfHoldingEntries) {
    await upsertMonthlyHoldingLedgerEntry(db, {
      holdingId: c.source_id, userId, source: "budget_contribution", sourceMonth: month,
      amount: n(c.amount), description: `Budget contribution — ${month}`,
    });
  }

  const [existingSweep] = await db.select().from(clientHoldingTransactionsTable).where(and(
    eq(clientHoldingTransactionsTable.userId, userId),
    eq(clientHoldingTransactionsTable.sourceMonth, month),
    eq(clientHoldingTransactionsTable.source, "surplus_sweep"),
  ));
  if (netSurplus > 0) {
    const targetHoldingId = existingSweep?.holdingId ?? (await getOrCreateDefaultCashHolding(db, userId)).id;
    await upsertMonthlyHoldingLedgerEntry(db, {
      holdingId: targetHoldingId, userId, source: "surplus_sweep", sourceMonth: month,
      amount: netSurplus, description: `Unattributed surplus — ${month}`,
    });
  } else if (existingSweep) {
    await upsertMonthlyHoldingLedgerEntry(db, {
      holdingId: existingSweep.holdingId, userId, source: "surplus_sweep", sourceMonth: month, amount: 0,
    });
  }

  res.json(row);
});

router.post("/client/budget/sync-contributions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;

  // Single-month "live top-up" sync (fromMonth defaults to the current month).
  // Merges into whatever's already there instead of overwriting the whole
  // array, so manual/self_holding entries the client already saved survive.
  const result = await syncAdvisedPlanContributionsToBudget(db, { userId });
  const contributions = result.contributions;

  res.json({ synced: contributions.length, contributions });
});

// ── Client scenarios ──────────────────────────────────────────────────────
router.get("/client/scenarios", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const savedOnly = req.query.saved === "true";
  const advisorOnly = req.query.advisor === "true";

  let rows;
  if (advisorOnly) {
    rows = await db.select().from(scenarioRunsTable)
      .where(and(eq(scenarioRunsTable.userId, userId), eq(scenarioRunsTable.isAdvisorPushed, true), ne(scenarioRunsTable.alertStatus, "dismissed")))
      .orderBy(desc(scenarioRunsTable.createdAt));
  } else if (savedOnly) {
    rows = await db.select().from(scenarioRunsTable)
      .where(and(eq(scenarioRunsTable.userId, userId), eq(scenarioRunsTable.isSaved, true)))
      .orderBy(desc(scenarioRunsTable.createdAt));
  } else {
    rows = await db.select().from(scenarioRunsTable)
      .where(eq(scenarioRunsTable.userId, userId))
      .orderBy(desc(scenarioRunsTable.createdAt));
  }
  res.json(rows);
});

router.post("/client/scenarios", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const {
    scenarioName, scenarioType, sourceType, sourceId, linkedGoalId,
    parameters, projectionData, baselineFinalValue, scenarioFinalValue,
    deltaValue, deltaPct, isSaved,
  } = req.body;

  if (!scenarioType) { res.status(400).json({ error: "scenarioType required" }); return; }

  const [row] = await db.insert(scenarioRunsTable).values({
    userId, scenarioName: scenarioName ?? null, scenarioType,
    sourceType: sourceType ?? null, sourceId: sourceId ?? null,
    linkedGoalId: linkedGoalId ?? null,
    parameters: parameters ?? {}, projectionData: projectionData ?? [],
    baselineFinalValue: baselineFinalValue != null ? String(baselineFinalValue) : null,
    scenarioFinalValue: scenarioFinalValue != null ? String(scenarioFinalValue) : null,
    deltaValue: deltaValue != null ? String(deltaValue) : null,
    deltaPct: deltaPct != null ? String(deltaPct) : null,
    isSaved: isSaved ?? false,
  }).returning();

  res.status(201).json(row);
});

router.delete("/client/scenarios/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  await db.delete(scenarioRunsTable)
    .where(and(eq(scenarioRunsTable.id, id), eq(scenarioRunsTable.userId, userId)));
  res.sendStatus(204);
});

// ── Symbol search ─────────────────────────────────────────────────────────
const COMMODITY_LIST = [
  { symbol: "GC=F", name: "Gold Futures ($/troy oz)", type: "Commodity" },
  { symbol: "SI=F", name: "Silver Futures ($/troy oz)", type: "Commodity" },
  { symbol: "CL=F", name: "WTI Crude Oil Futures ($/barrel)", type: "Commodity" },
  { symbol: "NG=F", name: "Natural Gas Futures", type: "Commodity" },
  { symbol: "PL=F", name: "Platinum Futures", type: "Commodity" },
  { symbol: "HG=F", name: "Copper Futures", type: "Commodity" },
  { symbol: "PA=F", name: "Palladium Futures", type: "Commodity" },
  { symbol: "ZC=F", name: "Corn Futures", type: "Commodity" },
  { symbol: "ZW=F", name: "Wheat Futures", type: "Commodity" },
  { symbol: "GLD", name: "SPDR Gold Shares ETF", type: "ETF" },
  { symbol: "SLV", name: "iShares Silver Trust ETF", type: "ETF" },
  { symbol: "USO", name: "United States Oil Fund ETF", type: "ETF" },
  { symbol: "PDBC", name: "Invesco Optimum Yield Diversified Commodity", type: "ETF" },
  { symbol: "COMT", name: "iShares GSCI Commodity Dynamic Roll ETF", type: "ETF" },
];

router.get("/symbols/search", requireAuth, async (req, res): Promise<void> => {
  const { q = "", type = "stock_etf" } = req.query as { q: string; type: string };
  if (!q || q.length < 1) { res.json([]); return; }

  if (type === "commodity") {
    const lower = q.toLowerCase();
    const matches = COMMODITY_LIST.filter(c =>
      c.symbol.toLowerCase().includes(lower) || c.name.toLowerCase().includes(lower)
    ).slice(0, 10);
    if (matches.length > 0) { res.json(matches); return; }
    // Fall through to Yahoo Finance for other commodity ETF searches
  }

  if (type === "crypto") {
    try {
      const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`;
      const r = await fetch(url);
      const data = await r.json() as any;
      const results = (data?.coins ?? []).slice(0, 15).map((c: any) => ({
        symbol: (c.symbol as string).toUpperCase(),
        name: c.name as string,
        type: "Crypto",
      }));
      res.json(results);
      return;
    } catch {
      res.json([]);
      return;
    }
  }

  // All non-crypto types (stock_etf, etf, mutual_fund, bond, commodity fallthrough) → Yahoo Finance
  try {
    const quoteTypeFilter: Record<string, Set<string>> = {
      etf: new Set(["ETF"]),
      mutual_fund: new Set(["MUTUALFUND"]),
      bond: new Set(["ETF", "BOND"]),
      stock_etf: new Set(["EQUITY", "ETF", "MUTUALFUND"]),
    };
    const allowed = quoteTypeFilter[type] ?? new Set(["EQUITY", "ETF", "MUTUALFUND"]);

    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-US&region=US&quotesCount=15&newsCount=0&enableFuzzyQuery=false`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await r.json() as any;
    const results = (data?.quotes ?? [])
      .filter((item: any) => item.symbol && allowed.has(item.quoteType))
      .map((item: any) => ({
        symbol: item.symbol as string,
        name: (item.longname || item.shortname || item.symbol) as string,
        type: item.quoteType as string,
      }));
    res.json(results);
  } catch {
    res.json([]);
  }
});

// ── Price cache proxy ─────────────────────────────────────────────────────
router.get("/prices/stock/:ticker", requireAuth, async (req, res): Promise<void> => {
  const { priceCacheTable } = await import("@workspace/db");
  const ticker = (req.params.ticker as string).toUpperCase();
  const STALE_MS = 4 * 60 * 60 * 1000;

  const [cached] = await db.select().from(priceCacheTable)
    .where(and(eq(priceCacheTable.symbol, ticker), eq(priceCacheTable.symbolType, "stock_etf")));

  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < STALE_MS) {
    res.json({ symbol: ticker, price_usd: parseFloat(cached.priceUsd as string), change_1d_pct: parseFloat(cached.change1dPct as string ?? "0"), fetched_at: cached.fetchedAt, is_stale: false });
    return;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await r.json() as any;
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) { throw new Error("no meta"); }

    const price = meta.regularMarketPrice ?? 0;
    const change = meta.regularMarketChangePercent ?? 0;

    await db.insert(priceCacheTable).values({
      symbol: ticker, symbolType: "stock_etf",
      priceUsd: String(price), change1dPct: String(change), fetchedAt: new Date(),
    }).onConflictDoUpdate({
      target: [priceCacheTable.symbol, priceCacheTable.symbolType],
      set: { priceUsd: String(price), change1dPct: String(change), fetchedAt: new Date() },
    });

    res.json({ symbol: ticker, price_usd: price, change_1d_pct: change, fetched_at: new Date().toISOString(), is_stale: false });
  } catch {
    if (cached) {
      res.json({ symbol: ticker, price_usd: parseFloat(cached.priceUsd as string), change_1d_pct: 0, fetched_at: cached.fetchedAt, is_stale: true });
    } else {
      res.status(404).json({ error: "Price unavailable" });
    }
  }
});

router.post("/prices/batch", requireAuth, async (req, res): Promise<void> => {
  const { priceCacheTable } = await import("@workspace/db");
  // `stocks` covers stock_etf, etf, mutual_fund, commodity, bond — all fetched via Yahoo Finance
  const { stocks = [], cryptos = [] } = req.body as { stocks: string[]; cryptos: string[] };
  const STALE_MS = 4 * 60 * 60 * 1000;
  const result: Record<string, unknown> = {};

  for (const ticker of stocks) {
    const sym = ticker.toUpperCase();
    const [cached] = await db.select().from(priceCacheTable)
      .where(and(eq(priceCacheTable.symbol, sym), eq(priceCacheTable.symbolType, "stock_etf")));

    if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < STALE_MS) {
      result[sym] = { symbol: sym, price_usd: parseFloat(cached.priceUsd as string), change_1d_pct: parseFloat(cached.change1dPct as string ?? "0"), fetched_at: cached.fetchedAt, is_stale: false };
    } else {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2d`;
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        const data = await r.json() as any;
        const meta = data?.chart?.result?.[0]?.meta;
        const price = meta?.regularMarketPrice ?? 0;
        const change = meta?.regularMarketChangePercent ?? 0;
        await db.insert(priceCacheTable).values({
          symbol: sym, symbolType: "stock_etf", priceUsd: String(price), change1dPct: String(change), fetchedAt: new Date(),
        }).onConflictDoUpdate({
          target: [priceCacheTable.symbol, priceCacheTable.symbolType],
          set: { priceUsd: String(price), change1dPct: String(change), fetchedAt: new Date() },
        });
        result[sym] = { symbol: sym, price_usd: price, change_1d_pct: change, fetched_at: new Date().toISOString(), is_stale: false };
      } catch {
        if (cached) result[sym] = { symbol: sym, price_usd: parseFloat(cached.priceUsd as string), change_1d_pct: 0, fetched_at: cached.fetchedAt, is_stale: true };
      }
    }
  }

  if (cryptos.length > 0) {
    const COINGECKO_MAP: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin", SOL: "solana", XRP: "ripple", ADA: "cardano", DOGE: "dogecoin", MATIC: "matic-network", DOT: "polkadot", AVAX: "avalanche-2" };
    const ids = cryptos.map(s => COINGECKO_MAP[s.toUpperCase()] || s.toLowerCase());
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`;
      const r = await fetch(url);
      const data = await r.json() as any;
      for (let i = 0; i < cryptos.length; i++) {
        const sym = cryptos[i].toUpperCase();
        const id = ids[i];
        const entry = data[id];
        if (entry) {
          const price = entry.usd ?? 0;
          const change = entry.usd_24h_change ?? 0;
          await db.insert(priceCacheTable).values({
            symbol: sym, symbolType: "crypto", priceUsd: String(price), change1dPct: String(change), fetchedAt: new Date(),
          }).onConflictDoUpdate({
            target: [priceCacheTable.symbol, priceCacheTable.symbolType],
            set: { priceUsd: String(price), change1dPct: String(change), fetchedAt: new Date() },
          });
          result[sym] = { symbol: sym, price_usd: price, change_1d_pct: change, fetched_at: new Date().toISOString(), is_stale: false };
        }
      }
    } catch { /* use stale cache if available */ }
  }

  res.json(result);
});

// ── Dashboard: scenario alert ─────────────────────────────────────────────
router.get("/client/dashboard/scenario-alert", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [alert] = await db.select().from(scenarioRunsTable)
    .where(and(
      eq(scenarioRunsTable.userId, userId),
      eq(scenarioRunsTable.isAdvisorPushed, true),
      ne(scenarioRunsTable.alertStatus, "dismissed"),
    ))
    .orderBy(desc(scenarioRunsTable.createdAt))
    .limit(1);
  res.json(alert ?? null);
});

// Count of unread advisor scenarios
router.get("/client/dashboard/scenario-alert-count", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const alerts = await db.select({ id: scenarioRunsTable.id }).from(scenarioRunsTable)
    .where(and(
      eq(scenarioRunsTable.userId, userId),
      eq(scenarioRunsTable.isAdvisorPushed, true),
      ne(scenarioRunsTable.alertStatus, "dismissed"),
    ));
  res.json({ count: alerts.length });
});

// Update scenario alert status
router.patch("/client/scenarios/:id/status", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const { status } = req.body;
  if (!["new", "viewed", "dismissed"].includes(status)) {
    res.status(400).json({ error: "Invalid status" }); return;
  }
  const [updated] = await db.update(scenarioRunsTable)
    .set({ alertStatus: status })
    .where(and(eq(scenarioRunsTable.id, id), eq(scenarioRunsTable.userId, userId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ── Dashboard: net worth summary ─────────────────────────────────────────
router.get("/client/dashboard/networth", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;

  // Try latest snapshot first
  const [snapshot] = await db.select().from(netWorthSnapshotsTable)
    .where(eq(netWorthSnapshotsTable.userId, userId))
    .orderBy(desc(netWorthSnapshotsTable.snapshotDate))
    .limit(1);

  if (snapshot) {
    res.json({
      totalAssets: parseFloat(snapshot.totalAssetsUsd as string) || 0,
      totalLiabilities: parseFloat(snapshot.totalLiabilitiesUsd as string) || 0,
      netWorth: parseFloat(snapshot.netWorthUsd as string) || 0,
      source: "snapshot",
    });
    return;
  }

  // Fall back to assets/liabilities tables
  const assets = await db.select({ value: assetsTable.valueUsd }).from(assetsTable)
    .where(eq(assetsTable.userId, userId));
  const liabilities = await db.select({ value: liabilitiesTable.balanceUsd }).from(liabilitiesTable)
    .where(eq(liabilitiesTable.userId, userId));

  const totalAssets = assets.reduce((s, a) => s + (parseFloat(a.value as string) || 0), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + (parseFloat(l.value as string) || 0), 0);

  res.json({
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    source: "computed",
  });
});

// ── Dashboard: advisor profile ────────────────────────────────────────────
router.get("/client/dashboard/advisor", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [cp] = await db.select({ advisorId: clientProfilesTable.advisorId })
    .from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));

  if (!cp?.advisorId) { res.json(null); return; }

  const [advisor] = await db.select({ id: profilesTable.id, fullName: profilesTable.fullName })
    .from(profilesTable).where(eq(profilesTable.id, cp.advisorId));

  res.json(advisor ?? null);
});

// ── Dashboard: top goals ──────────────────────────────────────────────────
router.get("/client/dashboard/goals", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const goals = await db.select().from(financialGoalsTable)
    .where(eq(financialGoalsTable.userId, userId))
    .orderBy(financialGoalsTable.priority)
    .limit(3);
  res.json(goals);
});

// ── Client plan ───────────────────────────────────────────────────────────
// There is currently no advisor-facing UI anywhere that creates a
// financial_plans row or plan_milestones for a client — the write routes
// exist (plans.ts) but nothing calls them. So `plan` is null for every real
// client today; the frontend (usePlan.ts) derives the actual pathway content
// from the client's own financial_goals instead. This route's job is just to
// hand back whatever advisor-authored milestones DO exist (for when that UI
// eventually ships) plus the advisor/review info the pathway header needs —
// both of which must be present regardless of whether a plan row exists, so
// this never collapses to a bare `null` response.
router.get("/client/plan", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;

  const [plan] = await db.select().from(financialPlansTable)
    .where(eq(financialPlansTable.clientId, userId));

  const [cp] = await db.select({
    advisorId: clientProfilesTable.advisorId,
    annualReviewDate: clientProfilesTable.annualReviewDate,
  }).from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));

  let advisorProfile = null;
  if (cp?.advisorId) {
    const [ap] = await db.select({ id: profilesTable.id, fullName: profilesTable.fullName, email: profilesTable.email })
      .from(profilesTable).where(eq(profilesTable.id, cp.advisorId));
    advisorProfile = ap ?? null;
  }

  if (!plan) {
    res.json({
      plan: null, milestones: [],
      advisorId: cp?.advisorId ?? null,
      advisorName: advisorProfile?.fullName ?? null,
      nextReviewDate: cp?.annualReviewDate ?? null,
    });
    return;
  }

  const milestones = await db.select().from(planMilestonesTable)
    .where(eq(planMilestonesTable.planId, plan.id))
    .orderBy(planMilestonesTable.orderIndex, planMilestonesTable.createdAt);

  // Fetch linked goals for milestones that have them
  const linkedGoalIds = milestones
    .map(m => m.linkedGoalId)
    .filter(Boolean) as string[];
  let linkedGoals: typeof financialGoalsTable.$inferSelect[] = [];
  if (linkedGoalIds.length > 0) {
    linkedGoals = await db.select().from(financialGoalsTable)
      .where(eq(financialGoalsTable.userId, userId));
  }

  res.json({
    plan,
    milestones: milestones.map(m => ({
      ...m,
      linkedGoal: linkedGoals.find(g => g.id === m.linkedGoalId) ?? null,
    })),
    advisorId: cp?.advisorId ?? null,
    advisorName: advisorProfile?.fullName ?? null,
    nextReviewDate: cp?.annualReviewDate ?? null,
  });
});

// ── Milestone comments ────────────────────────────────────────────────────
router.get("/client/plan/milestones/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const milestoneId = req.params.id as string;
  try {
    const comments = await db.select({
      id: milestoneCommentsTable.id,
      milestoneId: milestoneCommentsTable.milestoneId,
      userId: milestoneCommentsTable.userId,
      authorRole: milestoneCommentsTable.authorRole,
      content: milestoneCommentsTable.content,
      createdAt: milestoneCommentsTable.createdAt,
      authorName: profilesTable.fullName,
    })
      .from(milestoneCommentsTable)
      .leftJoin(profilesTable, eq(milestoneCommentsTable.userId, profilesTable.id))
      .where(eq(milestoneCommentsTable.milestoneId, milestoneId))
      .orderBy(milestoneCommentsTable.createdAt);
    res.json(comments);
  } catch {
    res.json([]); // graceful degrade if table doesn't exist
  }
});

router.post("/client/plan/milestones/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const milestoneId = req.params.id as string;
  const { content } = req.body;
  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }
  try {
    const [comment] = await db.insert(milestoneCommentsTable).values({
      milestoneId, userId, authorRole: "client", content: content.trim(),
    }).returning();
    res.status(201).json(comment);
  } catch (err: any) {
    if (err?.message?.includes("does not exist")) {
      res.status(503).json({ error: "Comments require a database migration. Please run the SQL migration." });
    } else {
      res.status(500).json({ error: "Failed to add comment" });
    }
  }
});

// ── Review request message ────────────────────────────────────────────────
router.post("/client/plan/review-request", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { advisorId, message } = req.body;
  if (!advisorId || !message) { res.status(400).json({ error: "advisorId and message required" }); return; }

  // Find or create conversation
  let [conv] = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.clientId, userId), eq(conversationsTable.advisorId, advisorId)));

  if (!conv) {
    [conv] = await db.insert(conversationsTable)
      .values({ clientId: userId, advisorId })
      .returning();
  }

  const [msg] = await db.insert(messagesTable).values({
    conversationId: conv.id, senderId: userId, senderRole: "client", content: message,
  }).returning();

  res.status(201).json({ conversationId: conv.id, message: msg });
});

export default router;
