import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const { db, profilesTable, leadsTable, documentsTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const advisorA = `advisor-a-test-${RUN_ID}`;
const advisorB = `advisor-b-test-${RUN_ID}`;
const leadUserId = `lead-user-test-${RUN_ID}`;

function asUser(id: string) {
  return { "x-test-user-id": id };
}

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: advisorA, email: `advisor-a-${RUN_ID}@test.local`, fullName: "Advisor A", role: "advisor" },
    { id: advisorB, email: `advisor-b-${RUN_ID}@test.local`, fullName: "Advisor B", role: "advisor" },
    { id: leadUserId, email: `lead-user-${RUN_ID}@test.local`, fullName: "Lead User", role: "free_user" },
  ]);
  await db.insert(leadsTable).values({
    email: `lead-user-${RUN_ID}@test.local`, userId: leadUserId, status: "active", assignedAdvisorId: advisorA,
  });
});

afterAll(async () => {
  await db.delete(documentsTable).where(eq(documentsTable.userId, leadUserId));
  await db.delete(leadsTable).where(eq(leadsTable.userId, leadUserId));
  await db.delete(profilesTable).where(eq(profilesTable.id, leadUserId));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorA));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorB));
});

describe("advisor documents for a lead", () => {
  it("403s an advisor who isn't assigned to this lead", async () => {
    await request(app)
      .post(`/api/advisor/leads/${leadUserId}/documents`)
      .set(asUser(advisorB))
      .send({ title: "Passport.pdf", category: "kyc", fileUrl: "https://example.com/passport.pdf" })
      .expect(403);
  });

  it("lets the assigned advisor upload a document, tagged as admin-uploaded", async () => {
    const res = await request(app)
      .post(`/api/advisor/leads/${leadUserId}/documents`)
      .set(asUser(advisorA))
      .send({ title: "Passport.pdf", category: "kyc", fileUrl: "https://example.com/passport.pdf" })
      .expect(201);

    expect(res.body.userId).toBe(leadUserId);
    expect(res.body.uploadedBy).toBe(advisorA);
    expect(res.body.category).toBe("kyc");
    expect(res.body.isAdminUploaded).toBe(true);
  });

  it("lists the lead's documents for the assigned advisor", async () => {
    const res = await request(app)
      .get(`/api/advisor/leads/${leadUserId}/documents`)
      .set(asUser(advisorA))
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Passport.pdf");
  });

  it("403s a different advisor trying to list the lead's documents", async () => {
    await request(app).get(`/api/advisor/leads/${leadUserId}/documents`).set(asUser(advisorB)).expect(403);
  });
});
