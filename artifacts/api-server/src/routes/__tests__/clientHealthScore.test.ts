import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db, profilesTable, clientBudgetMonthsTable, clientHoldingsTable, healthScoresTable,
  financialGoalsTable, liabilitiesTable,
} = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const newClientId = `user_test_new_${RUN_ID}`;
const emptyClientId = `user_test_empty_${RUN_ID}`;
const scoredClientId = `user_test_scored_${RUN_ID}`;

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

// 4 months ago — past the 3-month gate.
const ESTABLISHED_CREATED_AT = new Date(Date.now() - 4 * 30 * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  await db.insert(profilesTable).values([
    // No createdAt override — defaults to "now", so this one stays gated.
    { id: newClientId, email: `health-new-${RUN_ID}@test.local`, role: "investment_client" },
    { id: emptyClientId, email: `health-empty-${RUN_ID}@test.local`, role: "investment_client", createdAt: ESTABLISHED_CREATED_AT },
    { id: scoredClientId, email: `health-scored-${RUN_ID}@test.local`, role: "investment_client", createdAt: ESTABLISHED_CREATED_AT },
  ]);

  // One budget month: 20% savings rate (income 5000, expenses 3000, investments
  // 1000 -> net 1000/5000), net_surplus > 0 -> counts toward savings consistency.
  await db.insert(clientBudgetMonthsTable).values({
    userId: scoredClientId, month: new Date().toISOString().slice(0, 7) + "-01",
    primaryIncome: "5000", totalIncome: "5000",
    housing: "3000", totalExpenses: "3000",
    investmentContributions: [{ label: "RSP", amount: 1000, source_id: "x", source_type: "advised_plan" }],
    totalInvestments: "1000", netSurplus: "1000", savingsRatePct: "20",
  });

  // Self-holding with a known cost basis vs. current value -> deterministic
  // investment-growth % without depending on live price lookups.
  await db.insert(clientHoldingsTable).values({
    userId: scoredClientId, holdingType: "other", label: "Private note",
    totalInvestedOther: "8000", currentValueOther: "10000", isActive: true,
  });

  // Goal at 50% progress via its own currentAmount (no goal_holding_links).
  await db.insert(financialGoalsTable).values({
    userId: scoredClientId, title: "Test goal", goalType: "custom",
    targetAmount: "5000", currentAmount: "2500", status: "on_track",
  });

  // $2,000 liability against $10,000 of assets (the holding above) -> 80% score.
  await db.insert(liabilitiesTable).values({
    userId: scoredClientId, name: "Test loan", category: "other", balanceUsd: "2000",
  });
});

afterAll(async () => {
  await db.delete(healthScoresTable).where(eq(healthScoresTable.userId, scoredClientId));
  await db.delete(healthScoresTable).where(eq(healthScoresTable.userId, emptyClientId));
  await db.delete(healthScoresTable).where(eq(healthScoresTable.userId, newClientId));
  await db.delete(clientBudgetMonthsTable).where(eq(clientBudgetMonthsTable.userId, scoredClientId));
  await db.delete(clientHoldingsTable).where(eq(clientHoldingsTable.userId, scoredClientId));
  await db.delete(financialGoalsTable).where(eq(financialGoalsTable.userId, scoredClientId));
  await db.delete(liabilitiesTable).where(eq(liabilitiesTable.userId, scoredClientId));
  await db.delete(profilesTable).where(eq(profilesTable.id, scoredClientId));
  await db.delete(profilesTable).where(eq(profilesTable.id, emptyClientId));
  await db.delete(profilesTable).where(eq(profilesTable.id, newClientId));
});

describe("GET /client/health-score", () => {
  it("401s an unauthenticated caller", async () => {
    await request(app).get("/api/client/health-score").expect(401);
  });

  it("gates a client active for less than 3 months", async () => {
    const res = await request(app).get("/api/client/health-score").set(asUser(newClientId)).expect(200);
    expect(res.body.gated).toBe(true);
    expect(res.body.monthsActive).toBeLessThan(3);
  });

  it("returns null for an established client with no budget, goals, or holdings", async () => {
    const res = await request(app).get("/api/client/health-score").set(asUser(emptyClientId)).expect(200);
    expect(res.body).toBeNull();
  });

  it("computes the weighted 5-dimension score", async () => {
    const res = await request(app).get("/api/client/health-score").set(asUser(scoredClientId)).expect(200);
    expect(res.body.gated).toBe(false);

    const { dimensions } = res.body.details;
    // 1 of the last 3 months has net_surplus > 0 -> 1/3.
    expect(dimensions.savingsConsistency).toBe(33);
    // (10000 - 8000) / 8000 * 100.
    expect(dimensions.investmentGrowth).toBe(25);
    // 2500 / 5000 * 100.
    expect(dimensions.goalProgress).toBe(50);
    // 100 - (2000 / 10000 * 100).
    expect(dimensions.debtToAsset).toBe(80);
    // Only one budget month on record.
    expect(dimensions.budgetSurplus).toBe(20);

    // 0.25*33.33 + 0.25*25 + 0.20*50 + 0.20*80 + 0.10*20, rounded.
    expect(res.body.overallScore).toBe(43);

    for (const key of ["savingsConsistency", "investmentGrowth", "goalProgress", "debtToAsset", "budgetSurplus"]) {
      expect(dimensions[key]).toBeGreaterThanOrEqual(0);
      expect(dimensions[key]).toBeLessThanOrEqual(100);
    }
  });

  it("returns the same cached row on a second call the same day rather than recomputing", async () => {
    const first = await request(app).get("/api/client/health-score").set(asUser(scoredClientId)).expect(200);
    const second = await request(app).get("/api/client/health-score").set(asUser(scoredClientId)).expect(200);
    expect(second.body.id).toBe(first.body.id);
  });
});
