import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db, profilesTable, clientProfilesTable, leadsTable, advisedPlansTable, advisedPlanStatementsTable,
  clientPackagesTable, packageTransactionsTable, portfolioSnapshotsTable, blogPostsTable, financialGoalsTable,
} = await import("@workspace/db");
const { eq, inArray, like } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const asUser = (id: string) => ({ "x-test-user-id": id });
const adminId = `p6-admin-${RUN_ID}`;
const advisorA = `p6-advisor-a-${RUN_ID}`;
const advisorB = `p6-advisor-b-${RUN_ID}`;
const clientA = `p6-client-a-${RUN_ID}`;
const clientB = `p6-client-b-${RUN_ID}`;
const freeUser = `p6-free-${RUN_ID}`;
const everyone = [adminId, advisorA, advisorB, clientA, clientB, freeUser];
const leadEmailPrefix = `p6-${RUN_ID}`;

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: adminId, email: `${adminId}@test.local`, role: "super_admin" },
    { id: advisorA, email: `${advisorA}@test.local`, role: "advisor" },
    { id: advisorB, email: `${advisorB}@test.local`, role: "advisor" },
    { id: clientA, email: `${clientA}@test.local`, role: "investment_client" },
    { id: clientB, email: `${clientB}@test.local`, role: "investment_client" },
    { id: freeUser, email: `${freeUser}@test.local`, role: "free_user" },
  ]);
  await db.insert(clientProfilesTable).values([
    { userId: clientA, advisorId: advisorA },
    { userId: clientB, advisorId: advisorB },
  ]);
});

afterAll(async () => {
  const packages = await db.select({ id: clientPackagesTable.id }).from(clientPackagesTable).where(inArray(clientPackagesTable.userId, everyone));
  if (packages.length) {
    const ids = packages.map((p) => p.id);
    await db.delete(packageTransactionsTable).where(inArray(packageTransactionsTable.clientPackageId, ids));
    await db.delete(portfolioSnapshotsTable).where(inArray(portfolioSnapshotsTable.clientPackageId, ids));
    await db.delete(clientPackagesTable).where(inArray(clientPackagesTable.id, ids));
  }
  await db.delete(advisedPlanStatementsTable).where(inArray(advisedPlanStatementsTable.userId, everyone));
  await db.delete(advisedPlansTable).where(inArray(advisedPlansTable.userId, everyone));
  await db.delete(financialGoalsTable).where(inArray(financialGoalsTable.userId, everyone));
  await db.delete(blogPostsTable).where(like(blogPostsTable.slug, `${leadEmailPrefix}%`));
  await db.delete(leadsTable).where(like(leadsTable.email, `${leadEmailPrefix}%`));
  await db.delete(clientProfilesTable).where(inArray(clientProfilesTable.userId, everyone));
  await db.delete(profilesTable).where(inArray(profilesTable.id, everyone));
});

describe("F-2: statement routes check the plan belongs to the client", () => {
  const statement = { periodStart: "2026-01-01", periodEnd: "2026-03-31", openingValue: 100, closingValue: 110 };
  const makePlan = async (advisor: string, client: string) =>
    (await request(app).post(`/api/advisor/clients/${client}/advised-plans`).set(asUser(advisor))
      .send({ providerName: "Acme", productName: "Growth" }).expect(201)).body.id as string;
  const statementsOf = (planId: string) =>
    db.select().from(advisedPlanStatementsTable).where(eq(advisedPlanStatementsTable.advisedPlanId, planId));

  it("404s an advisor naming their own client with someone else's plan, and writes nothing", async () => {
    const otherPlan = await makePlan(advisorB, clientB);
    await request(app).post(`/api/advisor/clients/${clientB}/advised-plans/${otherPlan}/statements`).set(asUser(advisorB)).send(statement).expect(201);

    await request(app).get(`/api/advisor/clients/${clientA}/advised-plans/${otherPlan}/statements`).set(asUser(advisorA)).expect(404);
    await request(app).post(`/api/advisor/clients/${clientA}/advised-plans/${otherPlan}/statements`).set(asUser(advisorA)).send(statement).expect(404);
    expect(await statementsOf(otherPlan)).toHaveLength(1);
  });

  it("404s an unknown or malformed plan id rather than a 500", async () => {
    await request(app).get(`/api/advisor/clients/${clientA}/advised-plans/00000000-0000-4000-8000-000000000000/statements`).set(asUser(advisorA)).expect(404);
    await request(app).get(`/api/advisor/clients/${clientA}/advised-plans/not-a-uuid/statements`).set(asUser(advisorA)).expect(404);
  });

  it("still works for the plan's own client, including for a super admin", async () => {
    const plan = await makePlan(advisorA, clientA);
    await request(app).post(`/api/advisor/clients/${clientA}/advised-plans/${plan}/statements`).set(asUser(advisorA)).send(statement).expect(201);
    const own = await request(app).get(`/api/advisor/clients/${clientA}/advised-plans/${plan}/statements`).set(asUser(advisorA)).expect(200);
    expect(own.body).toHaveLength(1);
    await request(app).get(`/api/advisor/clients/${clientA}/advised-plans/${plan}/statements`).set(asUser(adminId)).expect(200);
    await request(app).get(`/api/advisor/clients/${clientB}/advised-plans/${plan}/statements`).set(asUser(adminId)).expect(404);
  });
});

describe("F-7: lead writes are scoped to the assigned advisor", () => {
  const makeLead = async (assignedAdvisorId: string | null) =>
    (await db.insert(leadsTable).values({ email: `${leadEmailPrefix}-f7-${Math.random()}@test.local`, status: "active", assignedAdvisorId, notes: "original" }).returning())[0];

  it("PUT /leads/:id 404s another advisor's lead, and an unassigned one, and changes nothing", async () => {
    for (const lead of [await makeLead(advisorB), await makeLead(null)]) {
      await request(app).put(`/api/leads/${lead.id}`).set(asUser(advisorA)).send({ notes: "hijacked" }).expect(404);
      const [row] = await db.select().from(leadsTable).where(eq(leadsTable.id, lead.id));
      expect(row.notes).toBe("original");
    }
  });

  it("POST /leads/:id/convert 404s another advisor's lead", async () => {
    const lead = await makeLead(advisorB);
    await request(app).post(`/api/leads/${lead.id}/convert`).set(asUser(advisorA)).send({ password: "x" }).expect(404);
    const [row] = await db.select().from(leadsTable).where(eq(leadsTable.id, lead.id));
    expect(row.convertedUserId).toBeNull();
  });

  it("the assigned advisor and a super admin can still write", async () => {
    const lead = await makeLead(advisorA);
    await request(app).put(`/api/leads/${lead.id}`).set(asUser(advisorA)).send({ notes: "mine" }).expect(200);
    await request(app).put(`/api/leads/${lead.id}`).set(asUser(adminId)).send({ notes: "admin" }).expect(200);
  });
});

describe("F-6: the public lead route", () => {
  const email = (tag: string) => `${leadEmailPrefix}-${tag}@test.local`;
  // A fresh address per test, so tests don't share a rate-limit bucket.
  let ipCounter = 0;
  const post = (body: unknown, ip = `203.0.113.${++ipCounter}`) =>
    request(app).post("/api/leads").set("X-Forwarded-For", ip).send(body as object);

  it("ignores status and notes: a visitor can't set them", async () => {
    const res = await post({ email: email("strip"), status: "client", notes: "VIP, call now", assignedAdvisorId: advisorA, userId: freeUser }).expect(201);
    expect(res.body).toMatchObject({ status: "unassigned", notes: null, assignedAdvisorId: null, userId: null });
  });

  it("refuses a missing or malformed email and writes nothing", async () => {
    await post({}).expect(400);
    await post({ email: "not-an-email" }).expect(400);
    await post({ email: { $ne: "" } }).expect(400);
    await post({ email: email("score"), healthScore: 1000 }).expect(400);
  });

  it("keeps the funnel's own fields", async () => {
    const res = await post({ email: email("quiz"), firstName: "Lee", source: "quiz", quizResult: "balanced", healthScore: 70 }).expect(201);
    expect(res.body).toMatchObject({ firstName: "Lee", source: "quiz", quizResult: "balanced", healthScore: 70 });
  });

  it("limits each IP, and another IP is unaffected", async () => {
    const ip = "198.51.100.10";
    for (let i = 0; i < 10; i++) await post({ email: email(`rate-${i}`) }, ip).expect(201);
    const blocked = await post({ email: email("rate-over") }, ip).expect(429);
    expect(blocked.body.error).toMatch(/Too many/);
    const rows = await db.select().from(leadsTable).where(eq(leadsTable.email, email("rate-over")));
    expect(rows).toHaveLength(0);
    await post({ email: email("rate-other") }, "198.51.100.11").expect(201);
  });

  it("can't be dodged by forging extra X-Forwarded-For entries", async () => {
    const ip = "198.51.100.20";
    for (let i = 0; i < 10; i++) await post({ email: email(`forge-${i}`) }, `10.0.0.${i}, ${ip}`).expect(201);
    await post({ email: email("forge-over") }, `10.9.9.9, ${ip}`).expect(429);
  });
});

describe("F-6: the authenticated route the advisor page uses", () => {
  const email = (tag: string) => `${leadEmailPrefix}-staff-${tag}@test.local`;

  it("needs a staff login", async () => {
    await request(app).post("/api/advisor/leads").send({ email: email("anon") }).expect(401);
    await request(app).post("/api/advisor/leads").set(asUser(freeUser)).send({ email: email("free") }).expect(403);
  });

  it("keeps status and notes, and refuses an unknown status or bad email", async () => {
    const res = await request(app).post("/api/advisor/leads").set(asUser(advisorA))
      .send({ email: email("full"), firstName: "Mai", source: "Referral", status: "cold", notes: "Met at an event" }).expect(201);
    expect(res.body).toMatchObject({ firstName: "Mai", source: "Referral", status: "cold", notes: "Met at an event" });
    await request(app).post("/api/advisor/leads").set(asUser(advisorA)).send({ email: email("bad"), status: "prospect" }).expect(400);
    await request(app).post("/api/advisor/leads").set(asUser(advisorA)).send({ email: "nope" }).expect(400);
  });

  it("a lead an advisor adds appears on their list and stays theirs to edit", async () => {
    const res = await request(app).post("/api/advisor/leads").set(asUser(advisorA)).send({ email: email("mine"), status: "unassigned" }).expect(201);
    expect(res.body).toMatchObject({ assignedAdvisorId: advisorA, status: "active" });
    const list = await request(app).get("/api/leads").set(asUser(advisorA)).expect(200);
    expect(list.body.map((l: any) => l.id)).toContain(res.body.id);
    await request(app).put(`/api/leads/${res.body.id}`).set(asUser(advisorA)).send({ notes: "ok" }).expect(200);
  });

  it("stores a form's blank optional fields as null, as the leads page expects", async () => {
    const res = await request(app).post("/api/advisor/leads").set(asUser(advisorA))
      .send({ email: email("blank"), firstName: "", source: "  ", notes: "" }).expect(201);
    expect(res.body).toMatchObject({ firstName: null, source: null, notes: null });
  });

  it("a lead a super admin adds goes to the assignment queue", async () => {
    const res = await request(app).post("/api/advisor/leads").set(asUser(adminId)).send({ email: email("queue") }).expect(201);
    expect(res.body).toMatchObject({ assignedAdvisorId: null, status: "unassigned" });
  });
});

describe("F-8: package rows belong to the package owner", () => {
  const makePackage = async () =>
    (await db.insert(clientPackagesTable).values({ userId: clientA, nickname: "Core", type: "custom" }).returning())[0];

  it("POST transactions ignores body.userId, and works without one", async () => {
    const pkg = await makePackage();
    const forged = await request(app).post(`/api/packages/${pkg.id}/transactions`).set(asUser(advisorA))
      .send({ userId: clientB, transactionDate: "2026-01-15", transactionType: "buy", amountUsd: "100" }).expect(201);
    expect(forged.body.userId).toBe(clientA);
    const omitted = await request(app).post(`/api/packages/${pkg.id}/transactions`).set(asUser(advisorA))
      .send({ transactionDate: "2026-01-16", transactionType: "buy", amountUsd: "100" }).expect(201);
    expect(omitted.body.userId).toBe(clientA);
  });

  it("POST snapshots ignores body.userId", async () => {
    const pkg = await makePackage();
    const res = await request(app).post(`/api/packages/${pkg.id}/snapshots`).set(asUser(advisorA))
      .send({ userId: clientB, snapshotDate: "2026-01-31", totalInvestedUsd: "100", totalValueUsd: "110", totalReturnPercent: "10" }).expect(200);
    expect(res.body.userId).toBe(clientA);
  });

  it("another advisor still can't write to the package", async () => {
    const pkg = await makePackage();
    await request(app).post(`/api/packages/${pkg.id}/transactions`).set(asUser(advisorB))
      .send({ transactionDate: "2026-01-15", transactionType: "buy", amountUsd: "100" }).expect(404);
  });
});

describe("F-9: GET /blog/:slug", () => {
  const post = async (status: string) => {
    const slug = `${leadEmailPrefix}-${status}`;
    await db.insert(blogPostsTable).values({ title: status, slug, status });
    return slug;
  };

  it("serves a published post and 404s a draft", async () => {
    await request(app).get(`/api/blog/${await post("published")}`).expect(200);
    await request(app).get(`/api/blog/${await post("draft")}`).expect(404);
  });
});

describe("PATCH /goals/:id/status reopening a goal", () => {
  const makeGoal = async (userId: string, status: string) =>
    (await db.insert(financialGoalsTable).values({ userId, title: `Goal ${status}`, goalType: "other", status }).returning())[0];

  it("is refused at the cap with the same LIMIT answer the holdings restore gives", async () => {
    const finished = await makeGoal(freeUser, "completed");
    const active = await makeGoal(freeUser, "active");
    const res = await request(app).patch(`/api/goals/${finished.id}/status`).set(asUser(freeUser)).send({ status: "active" }).expect(403);
    expect(res.body).toMatchObject({ code: "LIMIT", capability: "goals", limit: 1 });
    const [row] = await db.select().from(financialGoalsTable).where(eq(financialGoalsTable.id, finished.id));
    expect(row.status).toBe("completed");

    // With the slot free, the same reopen passes.
    await request(app).patch(`/api/goals/${active.id}/status`).set(asUser(freeUser)).send({ status: "completed" }).expect(200);
    await request(app).patch(`/api/goals/${finished.id}/status`).set(asUser(freeUser)).send({ status: "active" }).expect(200);
  });

  it("finishing a goal is never capped", async () => {
    const goal = await makeGoal(freeUser, "active");
    await request(app).patch(`/api/goals/${goal.id}/status`).set(asUser(freeUser)).send({ status: "completed" }).expect(200);
  });
});
