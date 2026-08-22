import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db, profilesTable, financialGoalsTable, advisedPlansTable, advisedStrategyReturnsTable,
} = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clientId = `user_test_${RUN_ID}`;

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

let planId: string;
let goalId: string;
let ratesRowInserted = false;
let expectedRatePct = 6;

beforeAll(async () => {
  await db.insert(profilesTable).values({
    id: clientId, email: `coast-point-${RUN_ID}@test.local`, fullName: "Coast Point Test User", role: "investment_client",
  });

  // Ensure an rsp advised_strategy_returns row exists so resolveBlendedRate has
  // a real rate to weight against (admin-managed; insert one only if missing —
  // this table is shared/real data, so read back whatever rate actually applies
  // rather than assuming ours won.
  const [existingRate] = await db.select().from(advisedStrategyReturnsTable).where(eq(advisedStrategyReturnsTable.planType, "rsp"));
  if (existingRate) {
    expectedRatePct = parseFloat(existingRate.targetAnnualReturnPct);
  } else {
    await db.insert(advisedStrategyReturnsTable).values({ planType: "rsp", label: "RSP", targetAnnualReturnPct: "6" });
    ratesRowInserted = true;
    expectedRatePct = 6;
  }

  const [plan] = await db.insert(advisedPlansTable).values({
    userId: clientId, providerName: "Acme", productName: "RSP Plan", planType: "rsp",
    status: "inforce", latestAccountValue: "20000",
  }).returning();
  planId = plan.id;

  const tenYearsOut = new Date();
  tenYearsOut.setFullYear(tenYearsOut.getFullYear() + 10);

  const [goal] = await db.insert(financialGoalsTable).values({
    userId: clientId, title: "Retirement", goalType: "retire",
    targetAmount: "1000000", targetDate: tenYearsOut.toISOString().slice(0, 10),
    monthlyContribution: "500",
  }).returning();
  goalId = goal.id;
});

afterAll(async () => {
  await db.delete(financialGoalsTable).where(eq(financialGoalsTable.id, goalId));
  await db.delete(advisedPlansTable).where(eq(advisedPlansTable.id, planId));
  await db.delete(profilesTable).where(eq(profilesTable.id, clientId));
  if (ratesRowInserted) {
    await db.delete(advisedStrategyReturnsTable).where(eq(advisedStrategyReturnsTable.planType, "rsp"));
  }
});

describe("GET /client/plan/coast-point", () => {
  it("401s an unauthenticated caller", async () => {
    await request(app).get("/api/client/plan/coast-point").expect(401);
  });

  it("returns a real blended rate and base coast-point for a retire goal", async () => {
    const res = await request(app).get("/api/client/plan/coast-point").set(asUser(clientId)).expect(200);
    expect(res.body.available).toBe(true);
    expect(res.body.goalId).toBe(goalId);
    expect(res.body.blendedAnnualReturnPct).toBeCloseTo(expectedRatePct, 1);
    expect(res.body.portfolioValue).toBe(20000);
    expect(res.body.base).toBeTruthy();
    expect(res.body.accelerated).toBeNull();
  });

  it("solves an accelerated coast-point when extraMonthly is passed, and it's no later than the base", async () => {
    const res = await request(app)
      .get("/api/client/plan/coast-point?extraMonthly=300")
      .set(asUser(clientId))
      .expect(200);
    expect(res.body.extraMonthly).toBe(300);
    expect(res.body.accelerated).toBeTruthy();
    if (res.body.base.coastMonthsFromNow != null && res.body.accelerated.coastMonthsFromNow != null) {
      expect(res.body.accelerated.coastMonthsFromNow).toBeLessThanOrEqual(res.body.base.coastMonthsFromNow);
    }
  });

  it("reports unavailable for a client with no retire-type goal", async () => {
    const otherId = `user_test_other_${RUN_ID}`;
    await db.insert(profilesTable).values({ id: otherId, email: `coast-point-other-${RUN_ID}@test.local`, role: "investment_client" });
    try {
      const res = await request(app).get("/api/client/plan/coast-point").set(asUser(otherId)).expect(200);
      expect(res.body).toEqual({ available: false, reason: "no_retirement_goal" });
    } finally {
      await db.delete(profilesTable).where(eq(profilesTable.id, otherId));
    }
  });
});
