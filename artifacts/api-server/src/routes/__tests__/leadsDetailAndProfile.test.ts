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
const advisorId = `advisor-test-${RUN_ID}`;

function asUser(id: string) {
  return { "x-test-user-id": id };
}

let leadId: string;

beforeAll(async () => {
  await db.insert(profilesTable).values({
    id: advisorId, email: `advisor-${RUN_ID}@test.local`, fullName: "Advisor", role: "advisor",
  });
  const [lead] = await db.insert(leadsTable).values({
    email: `lead-${RUN_ID}@test.local`, firstName: "Lead Name", status: "unassigned",
  }).returning();
  leadId = lead.id;
});

afterAll(async () => {
  await db.delete(leadsTable).where(eq(leadsTable.id, leadId));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorId));
});

describe("GET /leads/:id", () => {
  it("401s an unauthenticated caller", async () => {
    await request(app).get(`/api/leads/${leadId}`).expect(401);
  });

  it("returns the lead for any advisor (unscoped, matching GET /leads)", async () => {
    const res = await request(app).get(`/api/leads/${leadId}`).set(asUser(advisorId)).expect(200);
    expect(res.body.id).toBe(leadId);
    expect(res.body.firstName).toBe("Lead Name");
  });

  it("404s for a nonexistent lead", async () => {
    await request(app).get("/api/leads/00000000-0000-0000-0000-000000000000").set(asUser(advisorId)).expect(404);
  });
});

describe("PUT /leads/:id — advisor-editable subset only", () => {
  it("updates status and notes", async () => {
    const res = await request(app)
      .put(`/api/leads/${leadId}`)
      .set(asUser(advisorId))
      .send({ status: "active", notes: "Called, left voicemail" })
      .expect(200);
    expect(res.body.status).toBe("active");
    expect(res.body.notes).toBe("Called, left voicemail");
  });

  it("ignores email/firstName/source/assignedAdvisorId/userId even if sent", async () => {
    const res = await request(app)
      .put(`/api/leads/${leadId}`)
      .set(asUser(advisorId))
      .send({
        status: "cold", email: "rogue@test.local", firstName: "Rogue Name",
        source: "rogue_source", assignedAdvisorId: "someone-else", userId: "someone-else",
      })
      .expect(200);

    expect(res.body.status).toBe("cold");
    expect(res.body.email).toBe(`lead-${RUN_ID}@test.local`);
    expect(res.body.firstName).toBe("Lead Name");
    expect(res.body.assignedAdvisorId).toBeNull();
    expect(res.body.userId).toBeNull();

    const [row] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
    expect(row.email).toBe(`lead-${RUN_ID}@test.local`);
    expect(row.assignedAdvisorId).toBeNull();
  });
});
