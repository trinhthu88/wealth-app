import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  scoreEffectiveSavingsRate, scoreGoalProjection, scoreNetWorth, scoreWealthGrowthRate,
} = await import("../healthscore");
const {
  db, profilesTable, financialGoalsTable, budgetEntriesTable, assetsTable, liabilitiesTable,
} = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

// ── Pure scoring-tier boundary tests (no DB) ────────────────────────────────

describe("scoreEffectiveSavingsRate", () => {
  it.each([
    [25, 25], [24.9, 22],
    [20, 22], [19.9, 18],
    [15, 18], [14.9, 12],
    [10, 12], [9.9, 6],
    [5, 6], [4.9, 0],
    [0, 0], [-10, 0],
  ])("scores %d%% as %d", (pct, expected) => {
    expect(scoreEffectiveSavingsRate(pct)).toBe(expected);
  });
});

describe("scoreGoalProjection", () => {
  it("returns 0 when the user has no goal at all", () => {
    expect(scoreGoalProjection(500, 1000, false)).toBe(0);
  });

  it("returns 25 when the projection meets or beats the target", () => {
    expect(scoreGoalProjection(1000, 1000, true)).toBe(25);
    expect(scoreGoalProjection(1500, 1000, true)).toBe(25);
  });

  it("returns 15 for a gap at exactly the 20% boundary, 5 just past it", () => {
    expect(scoreGoalProjection(800, 1000, true)).toBe(15); // 20% gap
    expect(scoreGoalProjection(799, 1000, true)).toBe(5); // 20.1% gap
  });

  it("does not throw or produce NaN when target is 0", () => {
    const score = scoreGoalProjection(0, 0, true);
    expect(Number.isNaN(score)).toBe(false);
  });
});

describe("scoreNetWorth", () => {
  it("returns 0 when there's no net-worth data at all", () => {
    expect(scoreNetWorth(0, false)).toBe(0);
  });

  it.each([
    [100_001, 20], [100_000, 14],
    [1, 14], [0, 7], [-1, 2],
  ])("scores net worth %d as %d once data exists", (netWorth, expected) => {
    expect(scoreNetWorth(netWorth, true)).toBe(expected);
  });
});

describe("scoreWealthGrowthRate", () => {
  it.each([
    [10, 20], [9.9, 16],
    [7, 16], [6.9, 10],
    [4, 10], [3.9, 5],
    [1, 5], [0.9, 0],
    [0, 0],
  ])("scores growth rate %d%% as %d", (pct, expected) => {
    expect(scoreWealthGrowthRate(pct)).toBe(expected);
  });
});

// ── Full route integration tests ────────────────────────────────────────────

describe("POST /health-score", () => {
  const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const noGoalsUser = `test-hs-no-goals-${RUN_ID}`;
  const noBudgetUser = `test-hs-no-budget-${RUN_ID}`;
  const maxedUser = `test-hs-maxed-${RUN_ID}`;
  const allUsers = [noGoalsUser, noBudgetUser, maxedUser];

  beforeAll(async () => {
    await db.insert(profilesTable).values(
      allUsers.map(id => ({
        id, email: `${id}@test.local`, fullName: "Health Score Test User", role: "free_user" as const,
      })),
    );

    // noBudgetUser: has a goal, but no budget_entries row at all (income should resolve to 0).
    await db.insert(financialGoalsTable).values({
      userId: noBudgetUser, title: "Emergency fund", goalType: "emergency", targetAmount: "10000", currentAmount: "0",
    });

    // maxedUser: everything maxed out — savings rate, goal already met, huge net worth, high growth.
    await db.update(profilesTable).set({
      totalSavings: "500000", totalInvestments: "500000",
      savingsRatePercent: "20", investmentRatePercent: "20",
    }).where(eq(profilesTable.id, maxedUser));
    await db.insert(budgetEntriesTable).values({
      userId: maxedUser, periodMonth: "2026-01-01", income: "10000",
      housing: "1000", food: "500", transport: "200", utilities: "100", entertainment: "100", other: "100",
    });
    await db.insert(financialGoalsTable).values({
      userId: maxedUser, title: "Already there", goalType: "wealth",
      targetAmount: "100000", currentAmount: "200000",
      targetDate: new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split("T")[0],
    });
    await db.insert(assetsTable).values({
      userId: maxedUser, name: "Brokerage", category: "investment", valueUsd: "500000",
    });
  });

  afterAll(async () => {
    for (const id of allUsers) {
      await db.delete(financialGoalsTable).where(eq(financialGoalsTable.userId, id));
      await db.delete(budgetEntriesTable).where(eq(budgetEntriesTable.userId, id));
      await db.delete(assetsTable).where(eq(assetsTable.userId, id));
      await db.delete(liabilitiesTable).where(eq(liabilitiesTable.userId, id));
      await db.delete(profilesTable).where(eq(profilesTable.id, id));
    }
  });

  it("scores a user with no goals as goalsScore 0 without throwing", async () => {
    const res = await request(app)
      .post("/api/health-score")
      .set(asUser(noGoalsUser))
      .expect(200);
    expect(res.body.goalsScore).toBe(0);
    expect(Number.isFinite(res.body.overallScore)).toBe(true);
  });

  it("does not produce NaN/Infinity in effectiveSavingsRate when there's no budget entry (income = 0)", async () => {
    const res = await request(app)
      .post("/api/health-score")
      .set(asUser(noBudgetUser))
      .expect(200);
    expect(res.body.savingsScore).toBe(0);
    expect(Number.isFinite(res.body.insights.effectiveSavingsRate)).toBe(true);
    expect(res.body.insights.effectiveSavingsRate).toBe(0);
  });

  it("caps the overall score at 100 even when every component is maxed", async () => {
    const res = await request(app)
      .post("/api/health-score")
      .set(asUser(maxedUser))
      .expect(200);
    expect(res.body.overallScore).toBeLessThanOrEqual(100);
    expect(res.body.savingsScore).toBeLessThanOrEqual(25);
    expect(res.body.goalsScore).toBeLessThanOrEqual(25);
    expect(res.body.netWorthScore).toBeLessThanOrEqual(20);
  });
});
