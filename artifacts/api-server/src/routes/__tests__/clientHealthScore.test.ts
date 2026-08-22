import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db, profilesTable, clientBudgetMonthsTable, clientHoldingsTable, healthScoresTable,
} = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const emptyClientId = `user_test_empty_${RUN_ID}`;
const scoredClientId = `user_test_scored_${RUN_ID}`;

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: emptyClientId, email: `health-empty-${RUN_ID}@test.local`, role: "investment_client" },
    { id: scoredClientId, email: `health-scored-${RUN_ID}@test.local`, role: "investment_client" },
  ]);

  // 6 months of $3,000 expenses covered by $9,000 cash = 3 months coverage,
  // and a 20% savings rate (income 5000, expenses 3000, investments 1000 -> net 1000/5000).
  await db.insert(clientBudgetMonthsTable).values({
    userId: scoredClientId, month: new Date().toISOString().slice(0, 7) + "-01",
    primaryIncome: "5000", totalIncome: "5000",
    housing: "3000", totalExpenses: "3000",
    investmentContributions: [{ label: "RSP", amount: 1000, source_id: "x", source_type: "advised_plan" }],
    totalInvestments: "1000", netSurplus: "1000", savingsRatePct: "20",
  });

  await db.insert(clientHoldingsTable).values({
    userId: scoredClientId, holdingType: "cash", label: "Emergency fund",
    currentBalance: "9000", isActive: true,
  });
});

afterAll(async () => {
  await db.delete(healthScoresTable).where(eq(healthScoresTable.userId, scoredClientId));
  await db.delete(healthScoresTable).where(eq(healthScoresTable.userId, emptyClientId));
  await db.delete(clientBudgetMonthsTable).where(eq(clientBudgetMonthsTable.userId, scoredClientId));
  await db.delete(clientHoldingsTable).where(eq(clientHoldingsTable.userId, scoredClientId));
  await db.delete(profilesTable).where(eq(profilesTable.id, scoredClientId));
  await db.delete(profilesTable).where(eq(profilesTable.id, emptyClientId));
});

describe("GET /client/health-score", () => {
  it("401s an unauthenticated caller", async () => {
    await request(app).get("/api/client/health-score").expect(401);
  });

  it("returns null for a client with no budget, goals, or holdings", async () => {
    const res = await request(app).get("/api/client/health-score").set(asUser(emptyClientId)).expect(200);
    expect(res.body).toBeNull();
  });

  it("computes real, distinct component scores — not a duplicate budgetScore/savingsScore", async () => {
    const res = await request(app).get("/api/client/health-score").set(asUser(scoredClientId)).expect(200);
    expect(res.body.overallScore).toBeGreaterThan(0);
    // Contribution consistency (20% savings rate -> the 88 tier).
    expect(res.body.savingsScore).toBe(88);
    // Cash resilience: $9,000 / $3,000 expenses = 3 months coverage -> the 72 tier.
    // This must NOT equal savingsScore (88) — that's the bug being fixed.
    expect(res.body.budgetScore).toBe(72);
    expect(res.body.budgetScore).not.toBe(res.body.savingsScore);
    // All four components must already be 0-100 (no un-normalized point scale).
    for (const key of ["savingsScore", "goalsScore", "netWorthScore", "budgetScore"]) {
      expect(res.body[key]).toBeGreaterThanOrEqual(0);
      expect(res.body[key]).toBeLessThanOrEqual(100);
    }
  });

  it("returns the same cached row on a second call the same day rather than recomputing", async () => {
    const first = await request(app).get("/api/client/health-score").set(asUser(scoredClientId)).expect(200);
    const second = await request(app).get("/api/client/health-score").set(asUser(scoredClientId)).expect(200);
    expect(second.body.id).toBe(first.body.id);
  });
});
