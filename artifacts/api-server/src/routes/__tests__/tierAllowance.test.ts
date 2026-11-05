import { afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { grantMembership } from "./helpers/membership";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));
// Sol's route must never reach a real model here; an unavailable client answers 503.
vi.mock("@workspace/integrations-anthropic-ai", () => { throw new Error("not configured in tests"); });

const { default: app } = await import("../../app");
const {
  db, profilesTable, clientProfilesTable, leadsTable, advisedPlansTable, financialGoalsTable, clientHoldingsTable,
  solConversationsTable, solMessagesTable, scenarioRunsTable, scenariosTable, clientBudgetMonthsTable,
  netWorthSnapshotsTable, conversationsTable, documentsTable,
} = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const created: string[] = [];
let counter = 0;

async function makeUser(role: "free_user" | "investment_client" | "advisor" = "free_user") {
  const id = `tier-${++counter}-${RUN_ID}`;
  created.push(id);
  await db.insert(profilesTable).values({ id, email: `${id}@test.local`, fullName: `User ${counter}`, role });
  return id;
}
async function makeClient(advisorId?: string) {
  const id = await makeUser("investment_client");
  await grantMembership(id);
  await db.insert(clientProfilesTable).values({ userId: id, advisorId: advisorId ?? null });
  return id;
}
async function makeLead(userId: string, status: string, assignedAdvisorId?: string) {
  await db.insert(leadsTable).values({ email: `${userId}@test.local`, userId, status, assignedAdvisorId: assignedAdvisorId ?? null, source: "C7_direct" });
}
const asUser = (id: string) => ({ "x-test-user-id": id });
const goal = { title: "House", goalType: "house" };
const holding = (n: number) => ({ holdingType: "other", label: `Holding ${n}` });
const expectLimit = (res: request.Response, capability: string, limit: number | null, checkpoint: string | null) => {
  expect(res.status).toBe(403);
  expect(res.body).toMatchObject({ code: "LIMIT", capability, limit, checkpoint });
  expect(typeof res.body.error).toBe("string");
};
async function addSolMessages(userId: string, n: number, sentAt = new Date()) {
  const [convo] = await db.insert(solConversationsTable).values({ userId }).returning();
  await db.insert(solMessagesTable).values(
    Array.from({ length: n }, () => ({ conversationId: convo.id, role: "user", content: "hi", sentAt })),
  );
}

afterAll(async () => {
  const convos = await db.select({ id: solConversationsTable.id }).from(solConversationsTable).where(inArray(solConversationsTable.userId, created));
  if (convos.length) await db.delete(solMessagesTable).where(inArray(solMessagesTable.conversationId, convos.map((c) => c.id)));
  await db.delete(solConversationsTable).where(inArray(solConversationsTable.userId, created));
  await db.delete(conversationsTable).where(inArray(conversationsTable.clientId, created));
  await db.delete(documentsTable).where(inArray(documentsTable.userId, created));
  await db.delete(scenarioRunsTable).where(inArray(scenarioRunsTable.userId, created));
  await db.delete(scenariosTable).where(inArray(scenariosTable.userId, created));
  await db.delete(clientBudgetMonthsTable).where(inArray(clientBudgetMonthsTable.userId, created));
  await db.delete(netWorthSnapshotsTable).where(inArray(netWorthSnapshotsTable.userId, created));
  await db.delete(clientHoldingsTable).where(inArray(clientHoldingsTable.userId, created));
  await db.delete(financialGoalsTable).where(inArray(financialGoalsTable.userId, created));
  await db.delete(advisedPlansTable).where(inArray(advisedPlansTable.userId, created));
  await db.delete(leadsTable).where(inArray(leadsTable.userId, created));
  await db.delete(clientProfilesTable).where(inArray(clientProfilesTable.userId, created));
  await db.delete(profilesTable).where(inArray(profilesTable.id, created));
});

describe("goals cap", () => {
  it("lets a free user create one active goal and refuses the second with C2", async () => {
    const u = await makeUser();
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
    expectLimit(await request(app).post("/api/goals").set(asUser(u)).send(goal), "goals", 1, "C2_goal_slot");
  });

  it("does not count a finished goal, but reopening one at the cap is refused", async () => {
    const u = await makeUser();
    const first = await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
    await request(app).patch(`/api/goals/${first.body.id}/status`).set(asUser(u)).send({ status: "completed" }).expect(200);
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
    expectLimit(await request(app).patch(`/api/goals/${first.body.id}/status`).set(asUser(u)).send({ status: "active" }), "goals", 1, "C2_goal_slot");
    expectLimit(await request(app).put(`/api/goals/${first.body.id}`).set(asUser(u)).send({ status: "active" }), "goals", 1, "C2_goal_slot");
  });

  it("still lets a free user edit their active goal at the cap", async () => {
    const u = await makeUser();
    const first = await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
    await request(app).put(`/api/goals/${first.body.id}`).set(asUser(u)).send({ title: "New", status: "active" }).expect(200);
  });

  it("does not cap a client", async () => {
    const u = await makeClient();
    for (let i = 0; i < 3; i++) await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
  });
});

describe("holdings cap", () => {
  it("allows five, refuses the sixth with C5, and frees a slot on removal", async () => {
    const u = await makeUser();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/api/client/holdings").set(asUser(u)).send(holding(i)).expect(201);
      ids.push(res.body.id);
    }
    expectLimit(await request(app).post("/api/client/holdings").set(asUser(u)).send(holding(6)), "holdings", 5, "C5_investable");
    await request(app).delete(`/api/client/holdings/${ids[0]}`).set(asUser(u));
    await request(app).post("/api/client/holdings").set(asUser(u)).send(holding(7)).expect(201);
    // Restoring the removed holding would make six active.
    expectLimit(await request(app).put(`/api/client/holdings/${ids[0]}`).set(asUser(u)).send({ isActive: true }), "holdings", 5, "C5_investable");
    await request(app).put(`/api/client/holdings/${ids[1]}`).set(asUser(u)).send({ label: "Renamed", isActive: true }).expect(200);
  });

  it("does not cap a client", async () => {
    const u = await makeClient();
    for (let i = 0; i < 6; i++) await request(app).post("/api/client/holdings").set(asUser(u)).send(holding(i)).expect(201);
  });
});

describe("scenario types", () => {
  it("allows increase_monthly for free and refuses the others on both routes", async () => {
    const u = await makeUser();
    await request(app).post("/api/client/scenarios").set(asUser(u)).send({ scenarioType: "increase_monthly" }).expect(201);
    expectLimit(await request(app).post("/api/client/scenarios").set(asUser(u)).send({ scenarioType: "add_lump_sum" }), "scenarios", 1, "C3_off_track");
    const legacy = await request(app).post("/api/scenarios").set(asUser(u)).send({ scenarioType: "market_drop", inputData: {}, outputData: {} });
    expectLimit(legacy, "scenarios", 1, "C3_off_track");
  });

  it("allows all six for a client", async () => {
    const u = await makeClient();
    for (const scenarioType of ["increase_monthly", "add_lump_sum", "reduce_monthly", "pause_contributions", "market_drop", "retire_earlier"]) {
      await request(app).post("/api/client/scenarios").set(asUser(u)).send({ scenarioType }).expect(201);
    }
  });
});

describe("Sol messages per day", () => {
  it("refuses a free user's eleventh message today", async () => {
    const u = await makeUser();
    await addSolMessages(u, 10);
    expectLimit(await request(app).post("/api/sol/chat").set(asUser(u)).send({ message: "hi" }), "sol", 10, "C7_direct");
  });

  it("passes a free user under the cap, and does not count yesterday", async () => {
    const u = await makeUser();
    await addSolMessages(u, 9);
    await addSolMessages(u, 5, new Date(Date.now() - 2 * 86_400_000));
    await request(app).post("/api/sol/chat").set(asUser(u)).send({ message: "hi" }).expect(503);
  });

  it("caps a client at 100 with no checkpoint", async () => {
    const u = await makeClient();
    await addSolMessages(u, 99);
    await request(app).post("/api/sol/chat").set(asUser(u)).send({ message: "hi" }).expect(503);
    await addSolMessages(u, 1);
    expectLimit(await request(app).post("/api/sol/chat").set(asUser(u)).send({ message: "hi" }), "sol", 100, null);
  });
});

describe("coast point", () => {
  const retire = { title: "Retire by the sea", goalType: "retire", targetAmount: 500000, targetDate: "2050-01-01", monthlyContribution: 500 };

  it("gives a free user the blurred shape with the goal name and no numbers", async () => {
    const u = await makeUser();
    await request(app).post("/api/goals").set(asUser(u)).send(retire).expect(201);
    const res = await request(app).get("/api/client/plan/coast-point").set(asUser(u)).expect(200);
    expect(res.body).toMatchObject({
      available: true, blurred: true, goalTitle: retire.title,
      base: null, accelerated: null, portfolioValue: null, monthlyContribution: null,
      blendedAnnualReturnPct: null, goalTargetDate: null,
    });
  });

  it("gives a client the real result, unblurred", async () => {
    const u = await makeClient();
    await request(app).post("/api/goals").set(asUser(u)).send(retire).expect(201);
    const res = await request(app).get("/api/client/plan/coast-point").set(asUser(u)).expect(200);
    expect(res.body.blurred).toBeUndefined();
    expect(res.body.base).not.toBeNull();
  });
});

describe("the plan is locked for free", () => {
  it.each([
    ["get", "/api/client/plan"],
    ["get", "/api/client/plan/milestones/00000000-0000-4000-8000-000000000000/comments"],
    ["post", "/api/client/plan/milestones/00000000-0000-4000-8000-000000000000/comments"],
    ["post", "/api/client/plan/review-request"],
  ] as const)("%s %s", async (method, path) => {
    const u = await makeUser();
    const res = await request(app)[method](path).set(asUser(u)).send({});
    expectLimit(res, "plan", null, "C7_direct");
  });

  it("stays locked with an active lead, and is open to a client", async () => {
    const u = await makeUser();
    await makeLead(u, "active");
    expectLimit(await request(app).get("/api/client/plan").set(asUser(u)), "plan", null, "C7_direct");
    const client = await makeClient(await makeUser("advisor"));
    await request(app).get("/api/client/plan").set(asUser(client)).expect(200);
  });
});

describe("messages and documents open with the lead", () => {
  it.each([
    [null, 403], ["unassigned", 403], ["cold", 403], ["churned", 403], ["active", 200],
  ])("free user with lead status %s gets %s", async (status, code) => {
    const advisor = await makeUser("advisor");
    const u = await makeUser();
    if (status) await makeLead(u, status, advisor);
    const conversations = await request(app).get("/api/conversations").set(asUser(u));
    const documents = await request(app).get("/api/documents").set(asUser(u));
    expect(conversations.status).toBe(code);
    expect(documents.status).toBe(code);
    if (code === 403) {
      expectLimit(conversations, "messages", null, "C7_direct");
      expectLimit(documents, "documents", null, "C7_direct");
      expectLimit(await request(app).post("/api/conversations").set(asUser(u)).send({}), "messages", null, "C7_direct");
      expectLimit(await request(app).post("/api/documents").set(asUser(u)).send({}), "documents", null, "C7_direct");
    }
  });

  it("does not gate clients or advisors", async () => {
    const advisor = await makeUser("advisor");
    const client = await makeClient(advisor);
    await request(app).get("/api/conversations").set(asUser(client)).expect(200);
    await request(app).get("/api/documents").set(asUser(client)).expect(200);
    await request(app).get("/api/conversations").set(asUser(advisor)).expect(200);
    await request(app).get("/api/documents").set(asUser(advisor)).expect(200);
    await request(app).get(`/api/conversations?clientId=${client}`).set(asUser(advisor)).expect(200);
  });
});

describe("read windows", () => {
  const monthsAgo = (n: number) => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1)).toISOString().slice(0, 10);
  };
  async function addMonth(userId: string, month: string) {
    await db.insert(clientBudgetMonthsTable).values({ userId, month, totalIncome: "100", totalExpenses: "50", netSurplus: "50" });
  }

  it("shows free the current month plus three, for both the list and a single month", async () => {
    const u = await makeUser();
    for (const n of [0, 3, 4]) await addMonth(u, monthsAgo(n));
    const list = await request(app).get("/api/client/budget").set(asUser(u)).expect(200);
    expect(list.body.map((m: any) => m.month)).toEqual([monthsAgo(0), monthsAgo(3)]);
    await request(app).get(`/api/client/budget/${monthsAgo(3)}`).set(asUser(u)).expect(200);
    await request(app).get(`/api/client/budget/${monthsAgo(4)}`).set(asUser(u)).expect(404);
    // The older row is hidden, not deleted: promotion moves nothing.
    expect(await db.select().from(clientBudgetMonthsTable).where(eq(clientBudgetMonthsTable.userId, u))).toHaveLength(3);
  });

  it("shows a client twelve months back", async () => {
    const u = await makeClient();
    for (const n of [0, 4, 12, 13]) await addMonth(u, monthsAgo(n));
    const list = await request(app).get("/api/client/budget").set(asUser(u)).expect(200);
    expect(list.body.map((m: any) => m.month)).toEqual([monthsAgo(0), monthsAgo(4), monthsAgo(12)]);
  });

  it("limits the net worth trend to three months for free and keeps more for a client", async () => {
    const free = await makeUser();
    const client = await makeClient();
    for (const u of [free, client]) {
      await db.insert(netWorthSnapshotsTable).values([
        { userId: u, snapshotDate: monthsAgo(1), totalAssets: "1", totalLiabilities: "0", netWorth: "1" },
        { userId: u, snapshotDate: monthsAgo(6), totalAssets: "1", totalLiabilities: "0", netWorth: "1" },
      ] as any);
    }
    expect((await request(app).get("/api/client/networth/snapshots").set(asUser(free)).expect(200)).body).toHaveLength(1);
    expect((await request(app).get("/api/client/networth/snapshots").set(asUser(client)).expect(200)).body).toHaveLength(2);
  });
});

describe("GET /me/entitlements", () => {
  const get = async (id: string) => (await request(app).get("/api/me/entitlements").set(asUser(id)).expect(200)).body;

  it("requires auth", async () => {
    await request(app).get("/api/me/entitlements").expect(401);
  });

  it("describes a free user with no lead", async () => {
    const u = await makeUser();
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
    await request(app).post("/api/client/holdings").set(asUser(u)).send(holding(1)).expect(201);
    await addSolMessages(u, 2);
    expect(await get(u)).toEqual({
      tier: "free",
      limits: {
        goals: 1, holdings: 5, budgetMonths: 3, trendMonths: 3, scenarioTypes: ["increase_monthly"], solPerDay: 10,
        coastPoint: "preview", advisedPlans: "preview", messages: "after_assign", documents: "after_assign", plan: "locked",
      },
      usage: { goals: 1, holdings: 1, solMessagesToday: 2 },
      gates: {
        goals: "limited", holdings: "limited", scenarios: "limited", sol: "limited", coastPoint: "preview",
        advisedPlans: "preview", messages: "after_assign", documents: "after_assign", plan: "locked",
      },
      atCap: { goals: true, holdings: false, sol: false },
      leadStatus: null,
      leadSource: null,
      advisor: null,
      openCheckpoint: null,
      membership: {
        status: "none", plan: null, currentPeriodEnd: null, trialEndsAt: null, source: null,
        manageUrl: null, isActive: false, pendingPayment: false, trialEligible: true,
      },
    });
  });

  it("keeps messages closed and hides the advisor for an unassigned lead", async () => {
    const u = await makeUser();
    await makeLead(u, "unassigned");
    const body = await get(u);
    expect(body).toMatchObject({ tier: "free", leadStatus: "unassigned", advisor: null });
    expect(body.gates.messages).toBe("after_assign");
  });

  it("opens messages and names the advisor for an active lead", async () => {
    const advisor = await makeUser("advisor");
    const u = await makeUser();
    await makeLead(u, "active", advisor);
    const body = await get(u);
    expect(body.leadStatus).toBe("active");
    expect(body.advisor.id).toBe(advisor);
    expect(typeof body.advisor.name).toBe("string");
    expect(body.gates).toMatchObject({ messages: "full", documents: "full", plan: "locked", goals: "limited" });
  });

  it("closes messages and hides the advisor again for a cold lead that kept its assignment", async () => {
    const advisor = await makeUser("advisor");
    const u = await makeUser();
    await makeLead(u, "cold", advisor);
    const body = await get(u);
    expect(body.advisor).toBeNull();
    expect(body.gates.messages).toBe("after_assign");
  });

  it("describes a Track B client", async () => {
    const advisor = await makeUser("advisor");
    const u = await makeClient(advisor);
    const body = await get(u);
    expect(body.tier).toBe("track_b");
    expect(body.limits.goals).toBeNull();
    expect(body.limits.advisedPlans).toBe("preview");
    expect(body.advisor.id).toBe(advisor);
  });

  it("describes a Track A client, from an inforce plan", async () => {
    const advisor = await makeUser("advisor");
    const u = await makeClient(advisor);
    await db.insert(advisedPlansTable).values({ userId: u, advisorId: advisor, providerName: "Acme", productName: "RSP Plan", planType: "rsp", status: "inforce", annualPremium: "1200" });
    const body = await get(u);
    expect(body.tier).toBe("track_a");
    expect(body.gates).toMatchObject({ advisedPlans: "full", plan: "full", messages: "full", goals: "full" });
    expect(body.limits.scenarioTypes).toHaveLength(6);
    expect(body.advisor.id).toBe(advisor);
    expect(body.atCap).toEqual({ goals: false, holdings: false, sol: false });
  });
});
