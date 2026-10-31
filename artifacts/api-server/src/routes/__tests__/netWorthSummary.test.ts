import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db,
  profilesTable,
  clientProfilesTable,
  clientHoldingsTable,
  priceCacheTable,
  advisedPlansTable,
  assetsTable,
  liabilitiesTable,
  financialGoalsTable,
  healthScoresTable,
  netWorthSnapshotsTable,
} = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const { toolGetNetWorthSummary } = await import("../sol");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clientId = `networth-client-${RUN_ID}`;
const advisorId = `networth-advisor-${RUN_ID}`;
const adminId = `networth-admin-${RUN_ID}`;
const fourMonthsAgo = new Date(Date.now() - 4 * 30 * 24 * 60 * 60 * 1000);
const tickerSymbol = `NW${RUN_ID.replace(/[^a-z0-9]/gi, "").toUpperCase()}`;

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: clientId, email: `${clientId}@test.local`, fullName: "Net Worth Test Client", role: "investment_client", createdAt: fourMonthsAgo },
    { id: advisorId, email: `${advisorId}@test.local`, role: "advisor" },
    { id: adminId, email: `${adminId}@test.local`, role: "super_admin" },
  ]);
  await db.insert(clientProfilesTable).values({ userId: clientId, advisorId });
  await db.insert(clientHoldingsTable).values({
    userId: clientId,
    holdingType: "property",
    label: "Test property",
    currentEstimatedValue: "100000",
    outstandingMortgage: "40000",
    isActive: true,
  });
  await db.insert(clientHoldingsTable).values({
    userId: clientId,
    holdingType: "stock_etf",
    label: "Live-priced holding",
    ticker: tickerSymbol,
    unitsHeld: "2",
    averageCostPrice: "30",
    isActive: true,
  });
  await db.insert(priceCacheTable).values({
    symbol: tickerSymbol,
    symbolType: "stock",
    priceUsd: "50",
  });
  await db.insert(advisedPlansTable).values({
    userId: clientId,
    advisorId,
    providerName: "Test provider",
    productName: "Test advised plan",
    nickname: "Retirement account",
    planType: "rsp",
    status: "inforce",
    latestAccountValue: "10000",
    isVisibleToClient: true,
  });
  await db.insert(assetsTable).values({
    userId: clientId,
    name: "Manual asset",
    category: "other_asset",
    valueUsd: "5000",
  });
  await db.insert(liabilitiesTable).values({
    userId: clientId,
    name: "Manual liability",
    category: "personal_loan",
    balanceUsd: "3000",
  });
  const targetDate = new Date();
  targetDate.setFullYear(targetDate.getFullYear() + 10);
  await db.insert(financialGoalsTable).values({
    userId: clientId,
    title: "Retirement goal",
    goalType: "retire",
    targetAmount: "1000000",
    targetDate: targetDate.toISOString().slice(0, 10),
    monthlyContribution: "500",
    status: "active",
  });
});

afterAll(async () => {
  await db.delete(healthScoresTable).where(eq(healthScoresTable.userId, clientId));
  await db.delete(netWorthSnapshotsTable).where(eq(netWorthSnapshotsTable.userId, clientId));
  await db.delete(financialGoalsTable).where(eq(financialGoalsTable.userId, clientId));
  await db.delete(clientHoldingsTable).where(eq(clientHoldingsTable.userId, clientId));
  await db.delete(priceCacheTable).where(eq(priceCacheTable.symbol, tickerSymbol));
  await db.delete(advisedPlansTable).where(eq(advisedPlansTable.userId, clientId));
  await db.delete(assetsTable).where(eq(assetsTable.userId, clientId));
  await db.delete(liabilitiesTable).where(eq(liabilitiesTable.userId, clientId));
  await db.delete(clientProfilesTable).where(eq(clientProfilesTable.userId, clientId));
  await db.delete(profilesTable).where(eq(profilesTable.id, clientId));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorId));
  await db.delete(profilesTable).where(eq(profilesTable.id, adminId));
});

describe("server-computed net worth", () => {
  it("returns the same current totals to the client, dashboard, Sol, and advisor summary", async () => {
    const summary = await request(app)
      .get("/api/client/networth/summary")
      .set(asUser(clientId))
      .expect(200);

    expect(summary.body).toMatchObject({
      currency: "USD",
      totalAssets: 115100,
      totalLiabilities: 43000,
      netWorth: 72100,
      portfolio: { selfManaged: 100100, advised: 10000, total: 110100 },
    });
    expect(summary.body.items.map((item: { source: string }) => item.source)).toEqual(
      expect.arrayContaining(["holding", "advised_plan", "asset", "liability", "mortgage"]),
    );

    const dashboard = await request(app)
      .get("/api/client/dashboard/networth")
      .set(asUser(clientId))
      .expect(200);
    expect(dashboard.body.netWorth).toBe(summary.body.netWorth);

    const sol = await toolGetNetWorthSummary(clientId);
    expect(sol.netWorth).toBe(summary.body.netWorth);

    const advisorSummary = await request(app)
      .get(`/api/advisor/clients/${clientId}/networth/summary`)
      .set(asUser(advisorId))
      .expect(200);
    expect(advisorSummary.body.netWorth).toBe(summary.body.netWorth);
  });

  it("uses the shared portfolio total for coast point and advisor/admin client lists", async () => {
    const coastPoint = await request(app)
      .get("/api/client/plan/coast-point")
      .set(asUser(clientId))
      .expect(200);
    expect(coastPoint.body.portfolioValue).toBe(110100);

    const advisorClients = await request(app)
      .get("/api/advisor/clients")
      .set(asUser(advisorId))
      .expect(200);
    const advisorClient = advisorClients.body.find((client: { id: string }) => client.id === clientId);
    expect(advisorClient.portfolioValue).toBe(110100);
    expect(advisorClient.netWorth).toBe(72100);

    const adminClients = await request(app)
      .get("/api/admin/clients")
      .set(asUser(adminId))
      .expect(200);
    const adminClient = adminClients.body.find((client: { id: string }) => client.id === clientId);
    expect(adminClient.portfolioValue).toBe(110100);
    expect(adminClient.netWorth).toBe(72100);
  });

  it("uses the shared asset and liability totals in the client wealth score", async () => {
    const response = await request(app)
      .get("/api/client/health-score")
      .set(asUser(clientId))
      .expect(200);
    expect(response.body.details.dimensions.debtToAsset).toBe(63);
  });

  it("allows only the assigned advisor and rejects browser snapshot writes", async () => {
    await request(app)
      .get(`/api/advisor/clients/${clientId}/networth/summary`)
      .set(asUser(adminId))
      .expect(200);

    const unassignedAdvisorId = `networth-unassigned-${RUN_ID}`;
    await db.insert(profilesTable).values({
      id: unassignedAdvisorId,
      email: `${unassignedAdvisorId}@test.local`,
      role: "advisor",
    });
    try {
      await request(app)
        .get(`/api/advisor/clients/${clientId}/networth/summary`)
        .set(asUser(unassignedAdvisorId))
        .expect(403);
    } finally {
      await db.delete(profilesTable).where(eq(profilesTable.id, unassignedAdvisorId));
    }

    await request(app)
      .post("/api/client/networth/snapshot")
      .set(asUser(clientId))
      .send({ totalAssetsUsd: 1, totalLiabilitiesUsd: 0, netWorthUsd: 1 })
      .expect(410);
  });
});
