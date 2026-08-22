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
const superAdminId = `super_admin_test_${RUN_ID}`;
const advisorAId = `advisor_a_test_${RUN_ID}`;
const advisorBId = `advisor_b_test_${RUN_ID}`;

function asUser(id: string) {
  return { "x-test-user-id": id };
}

let unassignedLeadId: string;
let coldLeadId: string;

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: superAdminId, email: `super-${RUN_ID}@test.local`, fullName: "Super Admin", role: "super_admin" },
    { id: advisorAId, email: `advisor-a-${RUN_ID}@test.local`, fullName: "Advisor A", role: "advisor" },
    { id: advisorBId, email: `advisor-b-${RUN_ID}@test.local`, fullName: "Advisor B", role: "advisor" },
  ]);

  const [unassigned] = await db.insert(leadsTable).values({
    email: `lead-unassigned-${RUN_ID}@test.local`, status: "unassigned",
  }).returning();
  unassignedLeadId = unassigned.id;

  const [cold] = await db.insert(leadsTable).values({
    email: `lead-cold-${RUN_ID}@test.local`, status: "cold", assignedAdvisorId: advisorAId,
  }).returning();
  coldLeadId = cold.id;
});

afterAll(async () => {
  await db.delete(leadsTable).where(eq(leadsTable.id, unassignedLeadId));
  await db.delete(leadsTable).where(eq(leadsTable.id, coldLeadId));
  await db.delete(profilesTable).where(eq(profilesTable.id, superAdminId));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorAId));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorBId));
});

describe("PUT /leads/:id/assign", () => {
  it("is forbidden for an advisor (super_admin only)", async () => {
    await request(app)
      .put(`/api/leads/${unassignedLeadId}/assign`)
      .set(asUser(advisorAId))
      .send({ advisorId: advisorAId })
      .expect(403);
  });

  it("requires advisorId", async () => {
    await request(app)
      .put(`/api/leads/${unassignedLeadId}/assign`)
      .set(asUser(superAdminId))
      .send({})
      .expect(400);
  });

  it("assigns an unassigned lead and transitions it to active", async () => {
    const res = await request(app)
      .put(`/api/leads/${unassignedLeadId}/assign`)
      .set(asUser(superAdminId))
      .send({ advisorId: advisorAId })
      .expect(200);

    expect(res.body.assignedAdvisorId).toBe(advisorAId);
    expect(res.body.status).toBe("active");
  });

  it("reassigning a lead that isn't unassigned changes the advisor without touching status", async () => {
    const res = await request(app)
      .put(`/api/leads/${coldLeadId}/assign`)
      .set(asUser(superAdminId))
      .send({ advisorId: advisorBId })
      .expect(200);

    expect(res.body.assignedAdvisorId).toBe(advisorBId);
    expect(res.body.status).toBe("cold");
  });

  it("404s for a nonexistent lead", async () => {
    await request(app)
      .put(`/api/leads/00000000-0000-0000-0000-000000000000/assign`)
      .set(asUser(superAdminId))
      .send({ advisorId: advisorAId })
      .expect(404);
  });
});
