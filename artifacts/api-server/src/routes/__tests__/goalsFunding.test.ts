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
  financialGoalsTable,
  clientHoldingsTable,
  goalHoldingLinksTable,
} = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const investmentClientId = `goal-funding-invest-${RUN_ID}`;
const freeClientId = `goal-funding-free-${RUN_ID}`;
const propertyId = `22222222-2222-4222-8222-${RUN_ID.replace(/\D/g, "").padStart(12, "0").slice(-12)}`;
const createdAt = new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000);
const targetDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
let linkedGoalId: string;
let manualGoalId: string;
let freeLinkedGoalId: string;

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

beforeAll(async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ rates: { USD: 1, VND: 25_400, EUR: 0.92 } }),
  }) as unknown as Response));

  await db.insert(profilesTable).values([
    { id: investmentClientId, email: `${investmentClientId}@test.local`, role: "investment_client" },
    { id: freeClientId, email: `${freeClientId}@test.local`, role: "free_user" },
  ]);
  const [linkedGoal] = await db.insert(financialGoalsTable).values({
    userId: investmentClientId,
    title: "Linked property goal",
    goalType: "home_purchase",
    targetAmount: "1000",
    currentAmount: "999",
    monthlyContribution: "125",
    targetDate,
    currency: "USD",
    status: "active",
    createdAt,
  }).returning();
  linkedGoalId = linkedGoal.id;

  const [manualGoal] = await db.insert(financialGoalsTable).values({
    userId: investmentClientId,
    title: "Manual VND goal",
    goalType: "retirement",
    targetAmount: "25400000",
    currentAmount: "2540000",
    monthlyContribution: "600",
    targetDate,
    currency: "VND",
    status: "active",
    createdAt,
  }).returning();
  manualGoalId = manualGoal.id;

  const [freeLinkedGoal] = await db.insert(financialGoalsTable).values({
    userId: freeClientId,
    title: "Free linked goal",
    goalType: "home_purchase",
    targetAmount: "1000",
    currentAmount: "50",
    targetDate,
    status: "active",
    createdAt,
  }).returning();
  freeLinkedGoalId = freeLinkedGoal.id;

  await db.insert(clientHoldingsTable).values([
    {
      id: propertyId,
      userId: investmentClientId,
      holdingType: "property",
      label: "VND property",
      currentEstimatedValue: "2540000",
      currency: "VND",
      isActive: true,
    },
    {
      userId: freeClientId,
      holdingType: "property",
      label: "Free user's linked property",
      currentEstimatedValue: "2540000",
      currency: "VND",
      isActive: true,
    },
  ]);
  const [freeHolding] = await db.select({ id: clientHoldingsTable.id }).from(clientHoldingsTable)
    .where(eq(clientHoldingsTable.userId, freeClientId));

  await db.insert(goalHoldingLinksTable).values([
    { goalId: linkedGoalId, userId: investmentClientId, sourceType: "self_holding", sourceId: propertyId, allocationPct: "50" },
    { goalId: freeLinkedGoalId, userId: freeClientId, sourceType: "self_holding", sourceId: freeHolding.id, allocationPct: "50" },
  ]);
});

afterAll(async () => {
  await db.delete(goalHoldingLinksTable).where(eq(goalHoldingLinksTable.userId, investmentClientId));
  await db.delete(goalHoldingLinksTable).where(eq(goalHoldingLinksTable.userId, freeClientId));
  await db.delete(financialGoalsTable).where(eq(financialGoalsTable.userId, investmentClientId));
  await db.delete(financialGoalsTable).where(eq(financialGoalsTable.userId, freeClientId));
  await db.delete(clientHoldingsTable).where(eq(clientHoldingsTable.userId, investmentClientId));
  await db.delete(clientHoldingsTable).where(eq(clientHoldingsTable.userId, freeClientId));
  await db.delete(profilesTable).where(eq(profilesTable.id, investmentClientId));
  await db.delete(profilesTable).where(eq(profilesTable.id, freeClientId));
  vi.unstubAllGlobals();
});

describe("server-computed goal funding and pacing", () => {
  it("returns linked and manual funding in USD with derived pacing", async () => {
    const response = await request(app)
      .get("/api/goals")
      .set(asUser(investmentClientId))
      .expect(200);

    const linkedGoal = response.body.find((goal: any) => goal.id === linkedGoalId);
    expect(linkedGoal.funding).toMatchObject({
      currentAmount: 50,
      currency: "USD",
      source: "links",
    });
    expect(linkedGoal.funding.breakdown).toEqual([
      expect.objectContaining({
        allocationPct: 50,
        sourceValueUsd: 100,
        contributionUsd: 50,
      }),
    ]);
    expect(linkedGoal.pacing).toBe("off_track");

    const manualGoal = response.body.find((goal: any) => goal.id === manualGoalId);
    expect(manualGoal.funding).toMatchObject({
      currentAmount: 100,
      currency: "USD",
      source: "manual",
      breakdown: [],
    });
    expect(manualGoal.targetAmountUsd).toBe(1000);
    expect(manualGoal.pacing).toBe("off_track");
  });

  it("preserves current amount and monthly contribution on a partial edit", async () => {
    const response = await request(app)
      .put(`/api/goals/${manualGoalId}`)
      .set(asUser(investmentClientId))
      .send({ title: "Renamed VND goal" })
      .expect(200);

    expect(response.body).toMatchObject({
      title: "Renamed VND goal",
      currentAmount: "2540000",
      monthlyContribution: "600",
    });
  });

  it("rejects auto-update and pathway writes for linked goals and investment clients", async () => {
    await request(app)
      .post("/api/goals/auto-update")
      .set(asUser(freeClientId))
      .send({ goalId: freeLinkedGoalId, newCurrentAmount: 900 })
      .expect(409);

    await request(app)
      .post("/api/goals/auto-update")
      .set(asUser(investmentClientId))
      .send({ goalId: manualGoalId, newCurrentAmount: 900 })
      .expect(409);

    await request(app)
      .post("/api/goals/upsert-from-pathway")
      .set(asUser(freeClientId))
      .send({ title: "Pathway goal", goalType: "retirement" })
      .expect(409);

    await request(app)
      .post("/api/goals/upsert-from-pathway")
      .set(asUser(investmentClientId))
      .send({ title: "Pathway goal", goalType: "retirement" })
      .expect(409);

    const [manualGoal] = await db.select().from(financialGoalsTable)
      .where(eq(financialGoalsTable.id, manualGoalId));
    expect(manualGoal.currentAmount).toBe("2540000");
  });
});
