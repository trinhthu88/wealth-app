import { afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { grantMembership } from "./helpers/membership";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db, profilesTable, clientProfilesTable, leadsTable, conversionCheckpointsTable, financialGoalsTable,
  goalProgressSnapshotsTable, clientHoldingsTable, clientHoldingTransactionsTable, clientBudgetMonthsTable, healthScoresTable,
} = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const created: string[] = [];
let counter = 0;

async function makeUser(role: "free_user" | "investment_client" | "advisor" = "free_user", values = {}) {
  const id = `chk-${++counter}-${RUN_ID}`;
  created.push(id);
  await db.insert(profilesTable).values({ id, email: `${id}@test.local`, fullName: "Test User", role, ...values });
  if (role === "investment_client") await grantMembership(id);
  return id;
}
const asUser = (id: string) => ({ "x-test-user-id": id });
const rowsOf = (id: string) => db.select().from(conversionCheckpointsTable).where(eq(conversionCheckpointsTable.userId, id));
const leadsOf = (id: string) => db.select().from(leadsTable).where(eq(leadsTable.userId, id));
const goal = { title: "House", goalType: "house" };
const openCode = async (id: string) =>
  (await request(app).get("/api/me/entitlements").set(asUser(id)).expect(200)).body.openCheckpoint?.code ?? null;

async function fillHoldings(userId: string, n: number) {
  await db.insert(clientHoldingsTable).values(Array.from({ length: n }, (_, i) => ({
    userId, holdingType: "other", label: `H${i}`, currency: "USD",
  })));
}
const monthsAgo = (n: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1)).toISOString().slice(0, 10);
};
const budgetBody = (month: string, surplusShare: number) => ({
  month, currency: "USD", primaryIncome: 1000, housing: 1000 * (1 - surplusShare),
});

afterAll(async () => {
  await db.delete(conversionCheckpointsTable).where(inArray(conversionCheckpointsTable.userId, created));
  await db.delete(leadsTable).where(inArray(leadsTable.userId, created));
  await db.delete(healthScoresTable).where(inArray(healthScoresTable.userId, created));
  await db.delete(clientHoldingTransactionsTable).where(inArray(clientHoldingTransactionsTable.userId, created));
  await db.delete(clientBudgetMonthsTable).where(inArray(clientBudgetMonthsTable.userId, created));
  await db.delete(clientHoldingsTable).where(inArray(clientHoldingsTable.userId, created));
  await db.delete(goalProgressSnapshotsTable).where(inArray(goalProgressSnapshotsTable.userId, created));
  await db.delete(financialGoalsTable).where(inArray(financialGoalsTable.userId, created));
  await db.delete(clientProfilesTable).where(inArray(clientProfilesTable.userId, created));
  await db.delete(profilesTable).where(inArray(profilesTable.id, created));
});

describe("C2 and C5 fire from the refused attempt", () => {
  it("C2 fires when a free user hits the goal cap, and only then", async () => {
    const u = await makeUser();
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
    expect((await rowsOf(u)).filter((r) => r.code === "C2_goal_slot")).toHaveLength(0);
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(403);
    const c2 = (await rowsOf(u)).filter((r) => r.code === "C2_goal_slot");
    expect(c2).toHaveLength(1);
    expect(c2[0].snapshot).toMatchObject({ capability: "goals", limit: 1, used: 1 });
    expect(await openCode(u)).toBe("C2_goal_slot");
  });

  it("repeated refusals do not make a second row", async () => {
    const u = await makeUser();
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(403);
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(403);
    expect((await rowsOf(u)).filter((r) => r.code === "C2_goal_slot")).toHaveLength(1);
  });

  it("valid cap-refused goals are saved as drafts, while empty requests fail validation", async () => {
    const u = await makeUser();
    await request(app).post("/api/goals").set(asUser(u)).send({}).expect(400);
    expect(await rowsOf(u)).toHaveLength(0);
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
    await request(app).post("/api/goals").set(asUser(u)).send({}).expect(400);
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(403);
    expect(await openCode(u)).toBe("C2_goal_slot");
    const goals = await db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, u));
    expect(goals).toHaveLength(2);
    expect(goals.filter((item) => item.status === "draft")).toHaveLength(1);
  });

  it("C5 fires on a sixth holding", async () => {
    const u = await makeUser();
    await fillHoldings(u, 5);
    await request(app).post("/api/client/holdings").set(asUser(u)).send({}).expect(403);
    expect(await openCode(u)).toBe("C5_investable");
  });

  it("nothing fires for a client at any count", async () => {
    const u = await makeUser("investment_client");
    await db.insert(clientProfilesTable).values({ userId: u });
    await fillHoldings(u, 6);
    await request(app).post("/api/client/holdings").set(asUser(u)).send({ holdingType: "other", label: "Seventh" }).expect(201);
    expect((await rowsOf(u)).filter((r) => r.code === "C5_investable")).toHaveLength(0);
  });

  it("nothing fires while a lead is in progress", async () => {
    const u = await makeUser();
    await db.insert(leadsTable).values({ email: `${u}@test.local`, userId: u, status: "unassigned" });
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(403);
    expect(await rowsOf(u)).toHaveLength(0);
  });

  it("C2 supersedes an open C1, keeping one open", async () => {
    const u = await makeUser();
    await db.insert(conversionCheckpointsTable).values({ userId: u, code: "C1_score_ready", snapshot: {} });
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(403);
    const rows = await rowsOf(u);
    expect(rows.filter((r) => !r.dismissedAt && !r.acceptedAt).map((r) => r.code)).toEqual(["C2_goal_slot"]);
    expect(rows.find((r) => r.code === "C1_score_ready")?.snapshot).toMatchObject({ supersededBy: "C2_goal_slot" });
  });
});

describe("post-write hooks", () => {
  it("POST /client/budget fires C4 on the second qualifying month, not the first", async () => {
    const u = await makeUser();
    await request(app).post("/api/client/budget").set(asUser(u)).send(budgetBody(monthsAgo(1), 0.5));
    const afterFirst = await rowsOf(u);
    expect(afterFirst.filter((r) => r.code === "C4_surplus")).toHaveLength(0);
    await request(app).post("/api/client/budget").set(asUser(u)).send(budgetBody(monthsAgo(0), 0.5));
    const c4 = (await rowsOf(u)).filter((r) => r.code === "C4_surplus");
    expect(c4).toHaveLength(1);
    expect(c4[0].snapshot).toMatchObject({ monthlySurplus: 500 });
  });

  it("POST /client/holdings fires C5 at the value threshold", async () => {
    const u = await makeUser();
    await request(app).post("/api/client/holdings").set(asUser(u))
      .send({ holdingType: "cash", label: "Savings", currentBalance: 25000, bankName: "B", accountType: "savings" }).expect(201);
    const c5 = (await rowsOf(u)).filter((r) => r.code === "C5_investable");
    expect(c5).toHaveLength(1);
    expect(c5[0].snapshot).toMatchObject({ portfolioValue: 25000 });
  });

  it("POST and PUT /goals fire C3 once two snapshots are off track", async () => {
    const u = await makeUser();
    const res = await request(app).post("/api/goals").set(asUser(u))
      .send({ ...goal, targetAmount: 100000, targetDate: "2030-01-01" }).expect(201);
    expect((await rowsOf(u)).filter((r) => r.code === "C3_off_track")).toHaveLength(0);
    await db.update(financialGoalsTable).set({ createdAt: new Date("2020-01-01") }).where(eq(financialGoalsTable.id, res.body.id));
    await db.insert(goalProgressSnapshotsTable).values({
      goalId: res.body.id, userId: u, snapshotDate: "2026-01-01", computedCurrentAmount: "1",
    }).onConflictDoNothing();
    await request(app).put(`/api/goals/${res.body.id}`).set(asUser(u)).send({ notes: "x" }).expect(200);
    const c3 = (await rowsOf(u)).filter((r) => r.code === "C3_off_track");
    expect(c3).toHaveLength(1);
    expect(c3[0].snapshot).toMatchObject({ goalId: res.body.id, goalTitle: "House" });
    expect((c3[0].snapshot as any).gapUsd).toBeGreaterThan(0);
  });

  it("GET /client/health-score gives a new free user a score straight away and fires C1", async () => {
    const u = await makeUser();
    await db.insert(clientProfilesTable).values({ userId: u, onboardingStage: "complete" });
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
    const res = await request(app).get("/api/client/health-score").set(asUser(u)).expect(200);
    expect(res.body.gated).toBe(false);
    expect(typeof res.body.overallScore).toBe("number");
    const c1 = (await rowsOf(u)).filter((r) => r.code === "C1_score_ready");
    expect(c1).toHaveLength(1);
    expect(await leadsOf(u)).toHaveLength(0);
  });

  it("keeps a new client's three-month wait", async () => {
    const u = await makeUser("investment_client");
    await db.insert(clientProfilesTable).values({ userId: u });
    const res = await request(app).get("/api/client/health-score").set(asUser(u)).expect(200);
    expect(res.body.gated).toBe(true);
  });

  it("a failing evaluation does not fail the write", async () => {
    const u = await makeUser();
    const engine = await import("../../lib/checkpointEngine");
    const spy = vi.spyOn(db, "select").mockImplementationOnce(() => { throw new Error("database down"); });
    await expect(engine.runCheckpointHook(u)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
  });

  it("an unknown user is a no-op", async () => {
    const engine = await import("../../lib/checkpointEngine");
    await expect(engine.runCheckpointHook("no-such-user")).resolves.toBeUndefined();
    expect(await rowsOf("no-such-user")).toHaveLength(0);
  });
});

describe("the database keeps it to one open row", () => {
  it("refuses a second open row for a user", async () => {
    const u = await makeUser();
    await db.insert(conversionCheckpointsTable).values({ userId: u, code: "C4_surplus", snapshot: {} });
    await expect(db.insert(conversionCheckpointsTable).values({ userId: u, code: "C5_investable", snapshot: {} })).rejects.toThrow();
  });
});

describe("/me/checkpoint", () => {
  async function userWithOpen(code = "C2_goal_slot") {
    const u = await makeUser();
    const [row] = await db.insert(conversionCheckpointsTable).values({ userId: u, code, snapshot: { limit: 1 } }).returning();
    return { u, row };
  }

  it("returns the open one with copy key and snapshot, and records it as shown", async () => {
    const { u, row } = await userWithOpen();
    expect(row.shownAt).toBeNull();
    const res = await request(app).get("/api/me/checkpoint").set(asUser(u)).expect(200);
    expect(res.body).toMatchObject({ id: row.id, code: "C2_goal_slot", copyKey: "C2_goal_slot", snapshot: { limit: 1 } });
    const [after] = await rowsOf(u);
    expect(after.shownAt).not.toBeNull();
  });

  it("returns null with none open, and entitlements agree", async () => {
    const u = await makeUser();
    expect((await request(app).get("/api/me/checkpoint").set(asUser(u)).expect(200)).body).toBeNull();
    expect(await openCode(u)).toBeNull();
  });

  it("dismiss closes it and starts the cool-down", async () => {
    const { u, row } = await userWithOpen();
    await request(app).post(`/api/me/checkpoint/${row.id}/dismiss`).set(asUser(u)).expect(204);
    expect(await openCode(u)).toBeNull();
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(201);
    await request(app).post("/api/goals").set(asUser(u)).send(goal).expect(403);
    expect((await rowsOf(u)).filter((r) => r.code === "C2_goal_slot")).toHaveLength(1);
    expect(await openCode(u)).not.toBe("C2_goal_slot");
  });

  it("accept creates exactly one lead with the right source and links it", async () => {
    const { u, row } = await userWithOpen();
    const res = await request(app).post(`/api/me/checkpoint/${row.id}/accept`).set(asUser(u)).expect(200);
    const leads = await leadsOf(u);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ source: "C2_goal_slot", status: "unassigned" });
    expect(res.body.leadId).toBe(leads[0].id);
    const [after] = await rowsOf(u);
    expect(after).toMatchObject({ leadId: leads[0].id });
    expect(after.acceptedAt).not.toBeNull();
  });

  it("accept re-touches an existing lead rather than adding one", async () => {
    const { u, row } = await userWithOpen("C4_surplus");
    await request(app).post("/api/leads/from-interest").set(asUser(u)).send({ source: "C7_direct" }).expect(201);
    await request(app).post(`/api/me/checkpoint/${row.id}/accept`).set(asUser(u)).expect(200);
    const leads = await leadsOf(u);
    expect(leads).toHaveLength(1);
    expect(leads[0].source).toBe("C4_surplus");
  });

  it("accepting twice is refused and still leaves one lead", async () => {
    const { u, row } = await userWithOpen();
    await request(app).post(`/api/me/checkpoint/${row.id}/accept`).set(asUser(u)).expect(200);
    await request(app).post(`/api/me/checkpoint/${row.id}/accept`).set(asUser(u)).expect(404);
    expect(await leadsOf(u)).toHaveLength(1);
  });

  it("a Track B client's accept records the choice with no lead", async () => {
    const u = await makeUser("investment_client");
    await db.insert(clientProfilesTable).values({ userId: u });
    const [row] = await db.insert(conversionCheckpointsTable).values({ userId: u, code: "C4_surplus", snapshot: {} }).returning();
    const res = await request(app).post(`/api/me/checkpoint/${row.id}/accept`).set(asUser(u)).expect(200);
    expect(res.body.leadId).toBeNull();
    expect(await leadsOf(u)).toHaveLength(0);
  });

  it("C1 has nothing to accept and makes no lead", async () => {
    const { u, row } = await userWithOpen("C1_score_ready");
    await request(app).post(`/api/me/checkpoint/${row.id}/accept`).set(asUser(u)).expect(409);
    expect(await leadsOf(u)).toHaveLength(0);
  });

  it("another user's checkpoint and a malformed id are not found", async () => {
    const { row } = await userWithOpen();
    const other = await makeUser();
    await request(app).post(`/api/me/checkpoint/${row.id}/dismiss`).set(asUser(other)).expect(404);
    await request(app).post(`/api/me/checkpoint/${row.id}/accept`).set(asUser(other)).expect(404);
    await request(app).post("/api/me/checkpoint/not-a-uuid/dismiss").set(asUser(other)).expect(404);
  });

  it("requires auth", async () => {
    await request(app).get("/api/me/checkpoint").expect(401);
  });
});

describe("GET /advisor/leads/:id/checkpoints", () => {
  it("shows the assigned advisor what fired, and refuses anyone else", async () => {
    const advisor = await makeUser("advisor");
    const other = await makeUser("advisor");
    const u = await makeUser();
    await db.insert(leadsTable).values({ email: `${u}@test.local`, userId: u, status: "active", assignedAdvisorId: advisor });
    await db.insert(conversionCheckpointsTable).values({ userId: u, code: "C4_surplus", snapshot: { monthlySurplus: 500 } });
    const res = await request(app).get(`/api/advisor/leads/${u}/checkpoints`).set(asUser(advisor)).expect(200);
    expect(res.body[0]).toMatchObject({ code: "C4_surplus", snapshot: { monthlySurplus: 500 } });
    await request(app).get(`/api/advisor/leads/${u}/checkpoints`).set(asUser(other)).expect(403);
    await request(app).get(`/api/advisor/leads/${u}/checkpoints`).set(asUser(u)).expect(403);
  });
});
