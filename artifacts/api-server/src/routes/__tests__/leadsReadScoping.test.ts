import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const { db, profilesTable, leadsTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const superAdminId = `super-admin-test-${RUN_ID}`;
const advisorAId = `advisor-a-test-${RUN_ID}`;
const advisorBId = `advisor-b-test-${RUN_ID}`;

function asUser(id: string) {
  return { "x-test-user-id": id };
}

let advisorALeadId: string;

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: superAdminId, email: `super-${RUN_ID}@test.local`, fullName: "Super Admin", role: "super_admin" },
    { id: advisorAId, email: `advisor-a-${RUN_ID}@test.local`, fullName: "Advisor A", role: "advisor" },
    { id: advisorBId, email: `advisor-b-${RUN_ID}@test.local`, fullName: "Advisor B", role: "advisor" },
  ]);

  const [lead] = await db.insert(leadsTable).values({
    email: `advisor-a-lead-${RUN_ID}@test.local`, status: "active", assignedAdvisorId: advisorAId,
  }).returning();
  advisorALeadId = lead.id;
});

afterAll(async () => {
  await db.delete(leadsTable).where(eq(leadsTable.id, advisorALeadId));
  await db.delete(profilesTable).where(eq(profilesTable.id, superAdminId));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorAId));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorBId));
});

describe("GET /leads", () => {
  it("scopes an advisor's list to their own assigned leads", async () => {
    const res = await request(app).get("/api/leads").set(asUser(advisorAId)).expect(200);
    expect(res.body.some((l: any) => l.id === advisorALeadId)).toBe(true);

    const resB = await request(app).get("/api/leads").set(asUser(advisorBId)).expect(200);
    expect(resB.body.some((l: any) => l.id === advisorALeadId)).toBe(false);
  });

  it("returns every lead to super_admin", async () => {
    const res = await request(app).get("/api/leads").set(asUser(superAdminId)).expect(200);
    expect(res.body.some((l: any) => l.id === advisorALeadId)).toBe(true);
  });
});

describe("GET /leads/:id", () => {
  it("allows the assigned advisor", async () => {
    const res = await request(app).get(`/api/leads/${advisorALeadId}`).set(asUser(advisorAId)).expect(200);
    expect(res.body.id).toBe(advisorALeadId);
  });

  it("404s for an advisor the lead isn't assigned to", async () => {
    await request(app).get(`/api/leads/${advisorALeadId}`).set(asUser(advisorBId)).expect(404);
  });

  it("allows super_admin regardless of assignment", async () => {
    await request(app).get(`/api/leads/${advisorALeadId}`).set(asUser(superAdminId)).expect(200);
  });
});
