import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Simulate different logged-in Clerk users per-request via a test-only header,
// instead of depending on real Clerk session tokens.
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const { db, profilesTable, clientProfilesTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const advisorA = `test-advisor-a-${RUN_ID}`;
const advisorB = `test-advisor-b-${RUN_ID}`;
const superAdmin = `test-super-admin-${RUN_ID}`;
const freeUser = `test-free-user-${RUN_ID}`;
const client1 = `test-client-${RUN_ID}`;

const testUserIds = [advisorA, advisorB, superAdmin, freeUser, client1];

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: advisorA, email: `advisor-a-${RUN_ID}@test.local`, fullName: "Advisor A", role: "advisor" },
    { id: advisorB, email: `advisor-b-${RUN_ID}@test.local`, fullName: "Advisor B", role: "advisor" },
    { id: superAdmin, email: `super-admin-${RUN_ID}@test.local`, fullName: "Super Admin", role: "super_admin" },
    { id: freeUser, email: `free-user-${RUN_ID}@test.local`, fullName: "Free User", role: "free_user" },
    { id: client1, email: `client-${RUN_ID}@test.local`, fullName: "Client One", role: "investment_client" },
  ]);
  await db.insert(clientProfilesTable).values({
    userId: client1,
    advisorId: advisorA,
    riskProfile: "balanced",
    kycStatus: "not_started",
  });
});

afterAll(async () => {
  await db.delete(clientProfilesTable).where(eq(clientProfilesTable.userId, client1));
  for (const id of testUserIds) {
    await db.delete(profilesTable).where(eq(profilesTable.id, id));
  }
});

describe("advisor client-profile access control", () => {
  it("403s an advisor who does not own the client", async () => {
    await request(app)
      .get(`/api/advisor/clients/${client1}/client-profile`)
      .set(asUser(advisorB))
      .expect(403);

    await request(app)
      .put(`/api/advisor/clients/${client1}/client-profile`)
      .set(asUser(advisorB))
      .send({ riskProfile: "aggressive" })
      .expect(403);
  });

  it("403s a free_user regardless of ownership", async () => {
    await request(app)
      .get(`/api/advisor/clients/${client1}/client-profile`)
      .set(asUser(freeUser))
      .expect(403);

    await request(app)
      .put(`/api/advisor/clients/${client1}/client-profile`)
      .set(asUser(freeUser))
      .send({ riskProfile: "aggressive" })
      .expect(403);
  });

  it("allows the assigned advisor", async () => {
    await request(app)
      .get(`/api/advisor/clients/${client1}/client-profile`)
      .set(asUser(advisorA))
      .expect(200);

    const res = await request(app)
      .put(`/api/advisor/clients/${client1}/client-profile`)
      .set(asUser(advisorA))
      .send({ riskProfile: "aggressive" })
      .expect(200);
    expect(res.body.riskProfile).toBe("aggressive");
  });

  it("allows super_admin regardless of assignment", async () => {
    await request(app)
      .get(`/api/advisor/clients/${client1}/client-profile`)
      .set(asUser(superAdmin))
      .expect(200);

    await request(app)
      .put(`/api/advisor/clients/${client1}/client-profile`)
      .set(asUser(superAdmin))
      .send({ riskProfile: "conservative" })
      .expect(200);
  });

  it("401s an unauthenticated caller", async () => {
    await request(app).get(`/api/advisor/clients/${client1}/client-profile`).expect(401);
  });

  it("ignores mass-assigned advisorId/kycStatus/id on the update endpoint", async () => {
    const rogueAdvisorId = advisorB;
    const res = await request(app)
      .put(`/api/advisor/clients/${client1}/client-profile`)
      .set(asUser(advisorA))
      .send({ riskProfile: "balanced", advisorId: rogueAdvisorId, kycStatus: "verified", id: "00000000-0000-0000-0000-000000000000" })
      .expect(200);

    expect(res.body.advisorId).toBe(advisorA);
    expect(res.body.kycStatus).toBe("not_started");

    const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, client1));
    expect(cp.advisorId).toBe(advisorA);
    expect(cp.kycStatus).toBe("not_started");
  });
});
