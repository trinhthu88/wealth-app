import { afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { grantMembership } from "./helpers/membership";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db, profilesTable, clientProfilesTable, leadsTable, healthScoresTable, clientBudgetMonthsTable,
  conversationsTable, messagesTable, documentsTable, financialGoalsTable, advisorAssignmentsTable,
} = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");
const { setCompedMembership } = await import("../../lib/membershipStore");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const created: string[] = [];
let counter = 0;

async function makeUser(role: "free_user" | "investment_client" | "advisor" | "super_admin" = "free_user", fullName = "Lee Nguyen") {
  const id = `conv-${++counter}-${RUN_ID}`;
  created.push(id);
  await db.insert(profilesTable).values({ id, email: `${id}@test.local`, fullName, role });
  return id;
}
const asUser = (id: string) => ({ "x-test-user-id": id });
const interest = (id: string, source = "C7_direct") =>
  request(app).post("/api/leads/from-interest").set(asUser(id)).send({ source });
const leadsOf = (id: string) => db.select().from(leadsTable).where(eq(leadsTable.userId, id));
const entitlements = async (id: string) => (await request(app).get("/api/me/entitlements").set(asUser(id)).expect(200)).body;

afterAll(async () => {
  const convs = await db.select({ id: conversationsTable.id }).from(conversationsTable).where(inArray(conversationsTable.clientId, created));
  if (convs.length) await db.delete(messagesTable).where(inArray(messagesTable.conversationId, convs.map((c) => c.id)));
  await db.delete(conversationsTable).where(inArray(conversationsTable.clientId, created));
  await db.delete(documentsTable).where(inArray(documentsTable.userId, created));
  await db.delete(financialGoalsTable).where(inArray(financialGoalsTable.userId, created));
  await db.delete(advisorAssignmentsTable).where(inArray(advisorAssignmentsTable.clientUserId, created));
  await db.delete(healthScoresTable).where(inArray(healthScoresTable.userId, created));
  await db.delete(clientBudgetMonthsTable).where(inArray(clientBudgetMonthsTable.userId, created));
  await db.delete(leadsTable).where(inArray(leadsTable.userId, created));
  await db.delete(clientProfilesTable).where(inArray(clientProfilesTable.userId, created));
  await db.delete(profilesTable).where(inArray(profilesTable.id, created));
});

describe("POST /leads/from-interest is idempotent per user", () => {
  it("rejects a source that is not a checkpoint code", async () => {
    const u = await makeUser();
    await request(app).post("/api/leads/from-interest").set(asUser(u)).send({ source: "smart_upgrade_card" }).expect(400);
    await request(app).post("/api/leads/from-interest").set(asUser(u)).send({}).expect(400);
    expect(await leadsOf(u)).toHaveLength(0);
  });

  it("creates one row, then re-touches it with the new source", async () => {
    const u = await makeUser();
    const first = await interest(u, "C7_direct").expect(201);
    await db.update(leadsTable).set({ updatedAt: new Date("2020-01-01") }).where(eq(leadsTable.id, first.body.id));
    const second = await interest(u, "C2_goal_slot").expect(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.source).toBe("C2_goal_slot");
    const [row] = await leadsOf(u);
    expect(row.updatedAt.getFullYear()).toBeGreaterThan(2020);
    expect(await leadsOf(u)).toHaveLength(1);
  });

  it("creates one row from simultaneous clicks", async () => {
    const u = await makeUser();
    const responses = await Promise.all(Array.from({ length: 6 }, () => interest(u)));
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 200)).toHaveLength(5);
    expect(await leadsOf(u)).toHaveLength(1);
  });

  it("keeps an active lead's advisor and status when re-touched", async () => {
    const advisor = await makeUser("advisor");
    const u = await makeUser();
    await db.insert(leadsTable).values({ email: "x@test.local", userId: u, status: "active", assignedAdvisorId: advisor });
    const res = await interest(u, "C5_investable").expect(200);
    expect(res.body).toMatchObject({ status: "active", assignedAdvisorId: advisor, source: "C5_investable" });
  });

  it("returns a cold lead to the queue, without its old advisor", async () => {
    const advisor = await makeUser("advisor");
    const u = await makeUser();
    await db.insert(leadsTable).values({ email: "x@test.local", userId: u, status: "cold", assignedAdvisorId: advisor });
    const res = await interest(u).expect(200);
    expect(res.body).toMatchObject({ status: "unassigned", assignedAdvisorId: null });
    expect(await leadsOf(u)).toHaveLength(1);
  });
});

describe("a linked lead's person fields come through the userId join", () => {
  it("stores no name copy and reads the current profile, email and score", async () => {
    const admin = await makeUser("super_admin");
    const u = await makeUser("free_user", "Original Name");
    const lead = (await interest(u).expect(201)).body;
    const [row] = await db.select().from(leadsTable).where(eq(leadsTable.id, lead.id));
    expect(row.firstName).toBeNull();
    expect(row.healthScore).toBeNull();

    await db.update(profilesTable).set({ fullName: "New Name", email: `new-${u}@test.local` }).where(eq(profilesTable.id, u));
    await db.insert(healthScoresTable).values({ userId: u, scoreDate: "2026-01-01", overallScore: 40 });
    await db.insert(healthScoresTable).values({ userId: u, scoreDate: "2026-02-01", overallScore: 64 });

    const detail = await request(app).get(`/api/leads/${lead.id}`).set(asUser(admin)).expect(200);
    expect(detail.body).toMatchObject({ firstName: "New Name", email: `new-${u}@test.local`, healthScore: 64 });
    const list = await request(app).get("/api/leads").set(asUser(admin)).expect(200);
    expect(list.body.find((l: any) => l.id === lead.id)).toMatchObject({ firstName: "New Name", healthScore: 64 });
  });

  it("leaves an anonymous lead's own fields alone", async () => {
    const admin = await makeUser("super_admin");
    const [anon] = await db.insert(leadsTable).values({ email: `anon-${RUN_ID}@test.local`, firstName: "Quiz", healthScore: 12 }).returning();
    const detail = await request(app).get(`/api/leads/${anon.id}`).set(asUser(admin)).expect(200);
    expect(detail.body).toMatchObject({ firstName: "Quiz", healthScore: 12 });
    await db.delete(leadsTable).where(eq(leadsTable.id, anon.id));
  });
});

describe("lead status drives conversion state and the after_assign gate", () => {
  it("walks none → unassigned → active → cold, opening and closing messages", async () => {
    const admin = await makeUser("super_admin");
    const advisor = await makeUser("advisor", "Mai Tran");
    const u = await makeUser();

    let e = await entitlements(u);
    expect(e).toMatchObject({ leadStatus: null, leadSource: null, advisor: null });
    await request(app).get("/api/conversations").set(asUser(u)).expect(403);

    const lead = (await interest(u, "C2_goal_slot").expect(201)).body;
    e = await entitlements(u);
    expect(e).toMatchObject({ leadStatus: "unassigned", leadSource: "C2_goal_slot", advisor: null });
    expect(e.gates.messages).toBe("after_assign");
    await request(app).get("/api/conversations").set(asUser(u)).expect(403);

    await request(app).put(`/api/leads/${lead.id}/assign`).set(asUser(admin)).send({ advisorId: advisor }).expect(200);
    e = await entitlements(u);
    expect(e).toMatchObject({ leadStatus: "active", advisor: { id: advisor, name: "Mai Tran" } });
    expect(e.gates).toMatchObject({ messages: "full", documents: "full" });

    const conv = await request(app).post("/api/conversations").set(asUser(u)).send({}).expect(201);
    expect(conv.body.advisorId).toBe(advisor);
    await request(app).post(`/api/conversations/${conv.body.id}/messages`).set(asUser(u)).send({ content: "Hello" }).expect(201);
    const read = await request(app).get(`/api/conversations/${conv.body.id}/messages`).set(asUser(advisor)).expect(200);
    expect(read.body).toHaveLength(1);
    await request(app).get("/api/documents").set(asUser(u)).expect(200);

    await request(app).put(`/api/leads/${lead.id}`).set(asUser(admin)).send({ status: "cold" }).expect(200);
    e = await entitlements(u);
    expect(e).toMatchObject({ leadStatus: "cold", advisor: null });
    expect(e.gates.messages).toBe("after_assign");
    await request(app).get("/api/conversations").set(asUser(u)).expect(403);
    await request(app).post(`/api/conversations/${conv.body.id}/messages`).set(asUser(u)).send({ content: "Hi" }).expect(403);
    await request(app).get("/api/documents").set(asUser(u)).expect(403);
  });

  it("lifts every limit on promotion, with the same user and no data moved", async () => {
    const admin = await makeUser("super_admin");
    const advisor = await makeUser("advisor", "Mai Tran");
    const u = await makeUser();
    await request(app).post("/api/goals").set(asUser(u)).send({ title: "House", goalType: "house" }).expect(201);
    await request(app).post("/api/goals").set(asUser(u)).send({ title: "Second", goalType: "house" }).expect(403);

    const lead = (await interest(u).expect(201)).body;
    await request(app).put(`/api/leads/${lead.id}/assign`).set(asUser(admin)).send({ advisorId: advisor }).expect(200);
    await request(app).put(`/api/leads/${lead.id}`).set(asUser(advisor)).send({ status: "client" }).expect(200);

    // Promotion alone changes nothing until the membership is active.
    expect((await entitlements(u)).tier).toBe("free");
    const membership = await setCompedMembership(u, "comp", "conversion state test");
    expect(membership.ok).toBe(true);

    const e = await entitlements(u);
    expect(e).toMatchObject({ tier: "track_b", advisor: { id: advisor } });
    expect(e.gates).toMatchObject({ goals: "full", plan: "full", messages: "full" });
    const goals = await request(app).get("/api/goals").set(asUser(u)).expect(200);
    expect(goals.body.map((g: any) => g.title)).toEqual(["House", "Second"]);
    await request(app).post("/api/goals").set(asUser(u)).send({ title: "Second", goalType: "house" }).expect(201);
  });
});

describe("advisor lead routes", () => {
  async function assignedLead() {
    const advisor = await makeUser("advisor");
    const u = await makeUser();
    await db.insert(leadsTable).values({ email: `${u}@test.local`, userId: u, status: "active", assignedAdvisorId: advisor });
    return { advisor, u };
  }

  it("serve the assigned advisor the lead's score", async () => {
    const { advisor, u } = await assignedLead();
    await db.insert(healthScoresTable).values({ userId: u, scoreDate: "2026-02-01", overallScore: 64 });
    const res = await request(app).get(`/api/advisor/leads/${u}/score`).set(asUser(advisor)).expect(200);
    expect(res.body.latest.overallScore).toBe(64);
    expect(res.body.history).toHaveLength(1);
  });

  it("answer null when the lead has no score yet", async () => {
    const { advisor, u } = await assignedLead();
    const res = await request(app).get(`/api/advisor/leads/${u}/score`).set(asUser(advisor)).expect(200);
    expect(res.body).toEqual({ latest: null, history: [] });
  });

  it("serve the budget only once the lead has shared it", async () => {
    const { advisor, u } = await assignedLead();
    await db.insert(clientBudgetMonthsTable).values({ userId: u, month: "2026-02-01", totalIncome: "100", totalExpenses: "40", netSurplus: "60" });
    await request(app).get(`/api/advisor/leads/${u}/budget`).set(asUser(advisor)).expect(403);
    await request(app).put("/api/client-profile/me").set(asUser(u)).send({ shareBudgetWithAdvisor: true }).expect(200);
    const res = await request(app).get(`/api/advisor/leads/${u}/budget`).set(asUser(advisor)).expect(200);
    expect(res.body.shared).toBe(true);
    expect(res.body.months).toHaveLength(1);
  });

  it.each(["score", "budget"])("refuse %s to another advisor and to the lead", async (path) => {
    const { u } = await assignedLead();
    const other = await makeUser("advisor");
    await request(app).get(`/api/advisor/leads/${u}/${path}`).set(asUser(other)).expect(403);
    await request(app).get(`/api/advisor/leads/${u}/${path}`).set(asUser(u)).expect(403);
  });
});
