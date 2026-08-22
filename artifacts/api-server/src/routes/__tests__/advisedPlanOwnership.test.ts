import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db, profilesTable, leadsTable, clientProfilesTable, advisedPlansTable,
} = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const advisorA = `advisor-a-test-${RUN_ID}`;
const advisorB = `advisor-b-test-${RUN_ID}`;
const leadUserId = `lead-user-test-${RUN_ID}`;
const clientUserId = `client-user-test-${RUN_ID}`;

function asUser(id: string) {
  return { "x-test-user-id": id };
}

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: advisorA, email: `advisor-a-${RUN_ID}@test.local`, fullName: "Advisor A", role: "advisor" },
    { id: advisorB, email: `advisor-b-${RUN_ID}@test.local`, fullName: "Advisor B", role: "advisor" },
    { id: leadUserId, email: `lead-user-${RUN_ID}@test.local`, fullName: "Lead User", role: "free_user" },
    { id: clientUserId, email: `client-user-${RUN_ID}@test.local`, fullName: "Client User", role: "investment_client" },
  ]);
  await db.insert(leadsTable).values({
    email: `lead-user-${RUN_ID}@test.local`, userId: leadUserId, status: "active", assignedAdvisorId: advisorA,
  });
  await db.insert(clientProfilesTable).values({ userId: clientUserId, advisorId: advisorA });
});

afterAll(async () => {
  await db.delete(advisedPlansTable).where(eq(advisedPlansTable.userId, leadUserId));
  await db.delete(advisedPlansTable).where(eq(advisedPlansTable.userId, clientUserId));
  await db.delete(leadsTable).where(eq(leadsTable.userId, leadUserId));
  await db.delete(clientProfilesTable).where(eq(clientProfilesTable.userId, clientUserId));
  await db.delete(profilesTable).where(eq(profilesTable.id, leadUserId));
  await db.delete(profilesTable).where(eq(profilesTable.id, clientUserId));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorA));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorB));
});

describe("advised-plan routes serve a lead and a client identically", () => {
  for (const [label, userId] of [["lead", leadUserId], ["client", clientUserId]] as const) {
    it(`403s an advisor who doesn't own this ${label}`, async () => {
      await request(app)
        .post(`/api/advisor/clients/${userId}/advised-plans`)
        .set(asUser(advisorB))
        .send({ providerName: "Acme", productName: "Growth Plan" })
        .expect(403);
    });

    it(`lets the assigned advisor create a scenario plan for this ${label}`, async () => {
      const res = await request(app)
        .post(`/api/advisor/clients/${userId}/advised-plans`)
        .set(asUser(advisorA))
        .send({ providerName: "Acme", productName: "Growth Plan" })
        .expect(201);
      expect(res.body.status).toBe("scenario");
      expect(res.body.policyNumber).toBeNull();
    });

    it(`lists the ${label}'s plans for the assigned advisor`, async () => {
      const res = await request(app)
        .get(`/api/advisor/clients/${userId}/advised-plans`)
        .set(asUser(advisorA))
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });
  }
});

describe("PUT /advised-plans/:id/status", () => {
  let scenarioPlanId: string;

  beforeAll(async () => {
    const [plan] = await db.insert(advisedPlansTable).values({
      userId: leadUserId, advisorId: advisorA, providerName: "Acme", productName: "Retirement Plan", status: "scenario",
    }).returning();
    scenarioPlanId = plan.id;
  });

  it("blocks flipping to inforce with no policyNumber", async () => {
    const res = await request(app)
      .put(`/api/advised-plans/${scenarioPlanId}/status`)
      .set(asUser(advisorA))
      .send({ status: "inforce" })
      .expect(400);
    expect(res.body.error).toMatch(/policyNumber/);
  });

  it("404s an advisor who doesn't own the plan (enumeration-safe)", async () => {
    await request(app)
      .put(`/api/advised-plans/${scenarioPlanId}/status`)
      .set(asUser(advisorB))
      .send({ status: "inforce", policyNumber: "POL-123" })
      .expect(404);
  });

  it("allows flipping to inforce when policyNumber is supplied in the same request", async () => {
    const res = await request(app)
      .put(`/api/advised-plans/${scenarioPlanId}/status`)
      .set(asUser(advisorA))
      .send({ status: "inforce", policyNumber: "POL-123" })
      .expect(200);
    expect(res.body.status).toBe("inforce");
    expect(res.body.policyNumber).toBe("POL-123");
  });
});

describe("PUT /advised-plans/:id/contribution", () => {
  let planId: string;

  beforeAll(async () => {
    const [plan] = await db.insert(advisedPlansTable).values({
      userId: clientUserId, advisorId: advisorA, providerName: "Acme", productName: "RSP Plan",
      planType: "rsp", status: "inforce", annualPremium: "1200",
    }).returning();
    planId = plan.id;
  });

  afterAll(async () => {
    await db.delete(advisedPlansTable).where(eq(advisedPlansTable.id, planId));
  });

  it("404s an advisor who doesn't own the plan", async () => {
    await request(app)
      .put(`/api/advised-plans/${planId}/contribution`)
      .set(asUser(advisorB))
      .send({ annualPremium: 2400 })
      .expect(404);
  });

  it("updates annualPremium without touching status or policyNumber", async () => {
    const res = await request(app)
      .put(`/api/advised-plans/${planId}/contribution`)
      .set(asUser(advisorA))
      .send({ annualPremium: 2400 })
      .expect(200);
    expect(res.body.annualPremium).toBe("2400");
    expect(res.body.status).toBe("inforce");
    expect(res.body.policyNumber).toBeNull();
  });

  it("sync-contributions reflects the updated premium on its next live read", async () => {
    const res = await request(app)
      .post("/api/client/budget/sync-contributions")
      .set(asUser(clientUserId))
      .expect(200);
    const contribution = res.body.contributions.find((c: any) => c.source_id === planId);
    expect(contribution).toBeTruthy();
    expect(contribution.amount).toBe(200); // 2400 / 12
  });
});
