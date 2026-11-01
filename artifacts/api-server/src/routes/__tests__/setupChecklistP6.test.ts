import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db,
  advisedPlansTable,
  assetsTable,
  clientBudgetMonthsTable,
  clientHoldingsTable,
  clientProfilesTable,
  conversationsTable,
  financialGoalsTable,
  goalHoldingLinksTable,
  liabilitiesTable,
  messagesTable,
  profilesTable,
} = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clientId = `p6-client-${RUN_ID}`;
const advisorId = `p6-advisor-${RUN_ID}`;

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

function dateMonthOffset(monthOffset: number): string {
  const month = new Date();
  month.setUTCDate(1);
  month.setUTCMonth(month.getUTCMonth() + monthOffset);
  return month.toISOString().slice(0, 10);
}

async function clearFixtureData() {
  const conversations = await db.select({ id: conversationsTable.id }).from(conversationsTable)
    .where(eq(conversationsTable.clientId, clientId));
  const conversationIds = conversations.map((row) => row.id);
  if (conversationIds.length > 0) {
    await db.delete(messagesTable).where(inArray(messagesTable.conversationId, conversationIds));
  }
  await db.delete(conversationsTable).where(eq(conversationsTable.clientId, clientId));
  await db.delete(goalHoldingLinksTable).where(eq(goalHoldingLinksTable.userId, clientId));
  await db.delete(financialGoalsTable).where(eq(financialGoalsTable.userId, clientId));
  await db.delete(clientBudgetMonthsTable).where(eq(clientBudgetMonthsTable.userId, clientId));
  await db.delete(clientHoldingsTable).where(eq(clientHoldingsTable.userId, clientId));
  await db.delete(assetsTable).where(eq(assetsTable.userId, clientId));
  await db.delete(liabilitiesTable).where(eq(liabilitiesTable.userId, clientId));
  await db.delete(advisedPlansTable).where(eq(advisedPlansTable.userId, clientId));
}

async function resetClientProfile() {
  await db.update(clientProfilesTable).set({
    firstFocus: null,
    riskProfile: null,
    startingFromZero: false,
    checklistHidden: false,
    onboardingStage: "not_started",
  }).where(eq(clientProfilesTable.userId, clientId));
}

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: clientId, email: `${clientId}@test.local`, fullName: "P6 Test Client", role: "investment_client" },
    { id: advisorId, email: `${advisorId}@test.local`, fullName: "P6 Test Advisor", role: "advisor" },
  ]);
  await db.insert(clientProfilesTable).values({ userId: clientId, advisorId });
});

afterEach(async () => {
  await clearFixtureData();
  await resetClientProfile();
  await db.update(profilesTable).set({
    fullName: "P6 Test Client",
    countryCode: null,
    isExpat: false,
    preferredCurrency: "USD",
    dateOfBirth: null,
  }).where(eq(profilesTable.id, clientId));
});

afterAll(async () => {
  await clearFixtureData();
  await db.delete(clientProfilesTable).where(eq(clientProfilesTable.userId, clientId));
  await db.delete(profilesTable).where(inArray(profilesTable.id, [clientId, advisorId]));
});

describe("GET /client/setup-checklist", () => {
  it("marks each item only when its source data exists and returns setup counts", async () => {
    const [plan] = await db.insert(advisedPlansTable).values({
      userId: clientId,
      advisorId,
      providerName: "Visible provider",
      productName: "Visible plan",
      isVisibleToClient: true,
    }).returning();
    const initial = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(initial.body.advisorName).toBe("P6 Test Advisor");
    expect(initial.body.clientName).toBe("P6 Test Client");
    expect(initial.body.setupSummary).toEqual({ visiblePlans: 1, activeGoals: 0, budgetMonths: 0 });
    expect(initial.body.wealthScoreUnlock).toEqual({ monthsWithBudget: 0, required: 3 });
    expect(initial.body.items.map((item: any) => item.done)).toEqual([false, false, false, false, false, false]);

    await db.insert(clientBudgetMonthsTable).values({ userId: clientId, month: dateMonthOffset(0) });
    let result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.items.filter((item: any) => item.done).map((item: any) => item.id)).toEqual(["budget"]);
    expect(result.body.wealthScoreUnlock).toEqual({ monthsWithBudget: 1, required: 3 });
    await db.insert(clientBudgetMonthsTable).values([
      { userId: clientId, month: dateMonthOffset(-1) },
      { userId: clientId, month: dateMonthOffset(-2) },
    ]);
    result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.wealthScoreUnlock).toEqual({ monthsWithBudget: 3, required: 3 });

    const [goal] = await db.insert(financialGoalsTable).values({
      userId: clientId,
      title: "Emergency fund",
      goalType: "safety_net",
    }).returning();
    result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.items.filter((item: any) => item.done).map((item: any) => item.id)).toEqual(["budget", "goal"]);
    expect(result.body.items.find((item: any) => item.id === "goal_link").href)
      .toBe(`/client/goals?openLink=${goal.id}`);

    const [holding] = await db.insert(clientHoldingsTable).values({
      userId: clientId,
      holdingType: "cash",
      label: "Savings",
    }).returning();
    result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.items.filter((item: any) => item.done).map((item: any) => item.id))
      .toEqual(["budget", "goal", "wealth"]);

    await db.insert(goalHoldingLinksTable).values({
      userId: clientId,
      goalId: goal.id,
      sourceType: "self_holding",
      sourceId: holding.id,
    });
    result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.items.filter((item: any) => item.done).map((item: any) => item.id))
      .toEqual(["budget", "goal", "wealth", "goal_link"]);

    await db.update(clientProfilesTable).set({ riskProfile: "balanced" })
      .where(eq(clientProfilesTable.userId, clientId));
    result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.items.filter((item: any) => item.done).map((item: any) => item.id))
      .toEqual(["budget", "goal", "wealth", "goal_link", "risk"]);

    const [conversation] = await db.insert(conversationsTable).values({ clientId, advisorId }).returning();
    await db.insert(messagesTable).values({
      conversationId: conversation.id,
      senderId: clientId,
      senderRole: "investment_client",
      content: "Hello",
    });
    result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.items.filter((item: any) => item.done).map((item: any) => item.id))
      .toEqual(["budget", "goal", "wealth", "goal_link", "risk", "advisor_hello"]);
    expect(result.body.items.find((item: any) => item.id === "risk").action).toBe("risk_check");
    expect(plan.isVisibleToClient).toBe(true);
  });

  it("accepts a manual asset, liability, or starting-from-zero preference as wealth completion", async () => {
    let result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.items.find((item: any) => item.id === "wealth").done).toBe(false);

    const [asset] = await db.insert(assetsTable).values({
      userId: clientId,
      name: "Home",
      category: "property",
      valueUsd: "100000",
    }).returning();
    result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.items.find((item: any) => item.id === "wealth").done).toBe(true);
    await db.delete(assetsTable).where(eq(assetsTable.id, asset.id));

    await db.insert(liabilitiesTable).values({
      userId: clientId,
      name: "Mortgage",
      category: "mortgage",
      balanceUsd: "50000",
    });
    result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.items.find((item: any) => item.id === "wealth").done).toBe(true);
    await db.delete(liabilitiesTable).where(eq(liabilitiesTable.userId, clientId));

    await request(app).put("/api/client/setup-checklist/preferences").set(asUser(clientId))
      .send({ startingFromZero: true }).expect(200);
    result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.startingFromZero).toBe(true);
    expect(result.body.items.find((item: any) => item.id === "wealth").done).toBe(true);

    const hidden = await request(app).put("/api/client/setup-checklist/preferences").set(asUser(clientId))
      .send({ checklistHidden: true }).expect(200);
    expect(hidden.body.checklistHidden).toBe(true);
    expect(hidden.body.startingFromZero).toBeUndefined();
    result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.checklistHidden).toBe(true);
    await request(app).put("/api/client/setup-checklist/preferences").set(asUser(clientId))
      .send({ startingFromZero: "yes" }).expect(400);
  });

  it("does not count an inactive deleted holding as wealth", async () => {
    await db.insert(clientHoldingsTable).values({
      userId: clientId,
      holdingType: "cash",
      label: "Deleted cash holding",
      isActive: false,
    });

    const result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.items.find((item: any) => item.id === "wealth").done).toBe(false);
  });

  it("does not count a link attached only to a cancelled goal", async () => {
    const [goal] = await db.insert(financialGoalsTable).values({
      userId: clientId,
      title: "Cancelled goal",
      goalType: "safety_net",
    }).returning();
    const [holding] = await db.insert(clientHoldingsTable).values({
      userId: clientId,
      holdingType: "cash",
      label: "Current savings",
    }).returning();
    await db.update(financialGoalsTable).set({ status: "cancelled" })
      .where(eq(financialGoalsTable.id, goal.id));
    await db.insert(goalHoldingLinksTable).values({
      userId: clientId,
      goalId: goal.id,
      sourceType: "self_holding",
      sourceId: holding.id,
    });

    const result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
    expect(result.body.items.find((item: any) => item.id === "goal_link").done).toBe(false);
  });

  it("uses Vietnam local month when UTC is still in the previous month and no client zone is known", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T17:00:00.000Z")); // 2026-11-01 00:00 in Ho Chi Minh City
    try {
      await db.insert(clientBudgetMonthsTable).values({ userId: clientId, month: "2026-11-01" });

      const result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
      expect(result.body.items.find((item: any) => item.id === "budget").done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the client's reported timezone instead of the Vietnam fallback", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T02:00:00.000Z")); // 2026-10-31 in Los Angeles
    try {
      await db.insert(clientBudgetMonthsTable).values({ userId: clientId, month: "2026-10-01" });

      const result = await request(app).get("/api/client/setup-checklist")
        .set(asUser(clientId))
        .set("x-client-time-zone", "America/Los_Angeles")
        .expect(200);
      expect(result.body.items.find((item: any) => item.id === "budget").done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("orders items by first focus, with sensible orders for investing and retirement", async () => {
    const cases = [
      ["know_my_money", ["budget", "goal", "wealth", "goal_link", "risk", "advisor_hello"]],
      ["save_for_big", ["budget", "goal", "wealth", "goal_link", "risk", "advisor_hello"]],
      ["organise_existing", ["wealth", "goal", "goal_link", "budget", "risk", "advisor_hello"]],
      ["start_investing", ["wealth", "risk", "goal", "goal_link", "budget", "advisor_hello"]],
      ["plan_retirement", ["goal", "wealth", "risk", "goal_link", "budget", "advisor_hello"]],
    ] as const;

    for (const [focus, expected] of cases) {
      await db.update(clientProfilesTable).set({ firstFocus: focus })
        .where(eq(clientProfilesTable.userId, clientId));
      const result = await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(200);
      expect(result.body.items.map((item: any) => item.id)).toEqual(expected);
    }
  });

  it("rejects access from free-tier accounts", async () => {
    await db.update(profilesTable).set({ role: "free_user" }).where(eq(profilesTable.id, clientId));
    await request(app).get("/api/client/setup-checklist").set(asUser(clientId)).expect(403);
    await db.update(profilesTable).set({ role: "investment_client" }).where(eq(profilesTable.id, clientId));
  });
});

describe("investment-client onboarding writes", () => {
  it("stores month-year DOB as day one, saves focus, and never moves onboarding backward", async () => {
    await request(app).put("/api/client/profile/basics").set(asUser(clientId)).send({
      fullName: "P6 Updated Client",
      dateOfBirth: "1989-05",
      countryCode: "VN",
      isExpat: true,
      preferredCurrency: "VND",
    }).expect(200);
    let [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, clientId));
    let [clientProfile] = await db.select().from(clientProfilesTable)
      .where(eq(clientProfilesTable.userId, clientId));
    expect(profile.dateOfBirth).toBe("1989-05-01");
    expect(profile.preferredCurrency).toBe("VND");
    expect(clientProfile.onboardingStage).toBe("profile");

    await request(app).put("/api/client/profile/basics").set(asUser(clientId)).send({
      dateOfBirth: "1989-05",
    }).expect(200);
    [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, clientId));
    expect(profile.fullName).toBe("P6 Updated Client");
    expect(profile.countryCode).toBe("VN");

    await request(app).post("/api/client/onboarding/complete").set(asUser(clientId))
      .send({ firstFocus: "plan_retirement" }).expect(200);
    [clientProfile] = await db.select().from(clientProfilesTable)
      .where(eq(clientProfilesTable.userId, clientId));
    expect(clientProfile.firstFocus).toBe("plan_retirement");
    expect(clientProfile.onboardingStage).toBe("complete");

    await request(app).put("/api/client/profile/basics").set(asUser(clientId))
      .send({ fullName: "Still Complete", dateOfBirth: "1990-12" }).expect(200);
    [clientProfile] = await db.select().from(clientProfilesTable)
      .where(eq(clientProfilesTable.userId, clientId));
    expect(clientProfile.onboardingStage).toBe("complete");

    await request(app).post("/api/client/onboarding/complete").set(asUser(clientId))
      .send({ firstFocus: "invented_focus" }).expect(400);
  });

  it("refuses About you without a valid DOB and refuses completion before About you", async () => {
    const incomplete = await request(app).post("/api/client/onboarding/complete").set(asUser(clientId))
      .send({ firstFocus: "plan_retirement" }).expect(400);
    expect(incomplete.body.error).toMatch(/save about you/i);

    const missingDob = await request(app).put("/api/client/profile/basics").set(asUser(clientId))
      .send({ fullName: "No DOB" }).expect(400);
    expect(missingDob.body.error).toMatch(/date of birth.*required/i);

    const invalidDob = await request(app).put("/api/client/profile/basics").set(asUser(clientId))
      .send({ dateOfBirth: "2026-13" }).expect(400);
    expect(invalidDob.body.error).toMatch(/valid month and year/i);

    const [clientProfile] = await db.select().from(clientProfilesTable)
      .where(eq(clientProfilesTable.userId, clientId));
    expect(clientProfile.onboardingStage).toBe("not_started");
  });
});
