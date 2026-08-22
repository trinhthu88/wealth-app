import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Regression test for the goalHoldingLinksTable.userId type mismatch (text-vs-uuid):
// before the fix, this insert threw a Postgres "invalid input syntax for type uuid"
// error for any real (non-UUID-shaped) Clerk user id, and the route swallowed it
// into a 500.
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const { db, profilesTable, financialGoalsTable, goalHoldingLinksTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
// Deliberately not UUID-shaped, matching real Clerk user ids like "user_2abc...".
const clientId = `user_test_${RUN_ID}`;

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

let goalId: string;
let goalBId: string;

beforeAll(async () => {
  await db.insert(profilesTable).values({
    id: clientId,
    email: `goal-links-${RUN_ID}@test.local`,
    fullName: "Goal Links Test User",
    role: "investment_client",
  });
  const [goal] = await db.insert(financialGoalsTable).values({
    userId: clientId,
    title: "Test Goal",
    goalType: "retirement",
  }).returning();
  goalId = goal.id;

  const [goalB] = await db.insert(financialGoalsTable).values({
    userId: clientId,
    title: "Test Goal B",
    goalType: "home_purchase",
  }).returning();
  goalBId = goalB.id;
});

afterAll(async () => {
  await db.delete(goalHoldingLinksTable).where(eq(goalHoldingLinksTable.userId, clientId));
  await db.delete(financialGoalsTable).where(eq(financialGoalsTable.userId, clientId));
  await db.delete(profilesTable).where(eq(profilesTable.id, clientId));
});

describe("goal holding links (userId text/uuid schema fix)", () => {
  it("creates a link with a non-UUID-shaped Clerk userId", async () => {
    const res = await request(app)
      .post(`/api/client/goals/${goalId}/links`)
      .set(asUser(clientId))
      .send({ sourceType: "self_holding", sourceId: "11111111-1111-1111-1111-111111111111", allocationPct: 100 })
      .expect(201);

    expect(res.body.userId).toBe(clientId);

    const [persisted] = await db.select().from(goalHoldingLinksTable).where(eq(goalHoldingLinksTable.id, res.body.id));
    expect(persisted.userId).toBe(clientId);
  });

  it("lists links for the goal", async () => {
    const res = await request(app)
      .get(`/api/client/goals/${goalId}/links`)
      .set(asUser(clientId))
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe("goal holding links (allocation cap, 100% across goals)", () => {
  const sharedHoldingId = "22222222-2222-2222-2222-222222222222";

  it("links 60% of a holding to goal A", async () => {
    const res = await request(app)
      .post(`/api/client/goals/${goalId}/links`)
      .set(asUser(clientId))
      .send({ sourceType: "self_holding", sourceId: sharedHoldingId, allocationPct: 60 })
      .expect(201);
    expect(res.body.allocationPct).toBe("60");
  });

  it("rejects linking 60% of the same holding to goal B (only 40% remains)", async () => {
    const res = await request(app)
      .post(`/api/client/goals/${goalBId}/links`)
      .set(asUser(clientId))
      .send({ sourceType: "self_holding", sourceId: sharedHoldingId, allocationPct: 60 })
      .expect(409);
    expect(res.body.remainingPct).toBe(40);
  });

  it("accepts linking the remaining 40% to goal B", async () => {
    const res = await request(app)
      .post(`/api/client/goals/${goalBId}/links`)
      .set(asUser(clientId))
      .send({ sourceType: "self_holding", sourceId: sharedHoldingId, allocationPct: 40 })
      .expect(201);
    expect(res.body.allocationPct).toBe("40");
  });

  it("leaves goal A's link untouched at 60%", async () => {
    const res = await request(app)
      .get(`/api/client/goals/${goalId}/links`)
      .set(asUser(clientId))
      .expect(200);
    const link = res.body.find((l: any) => l.sourceId === sharedHoldingId);
    expect(link?.allocationPct).toBe("60");
  });
});
