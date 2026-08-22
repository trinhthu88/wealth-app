import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const { db, profilesTable, clientProfilesTable, documentsTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const advisorA = `advisor-a-test-${RUN_ID}`;
const advisorB = `advisor-b-test-${RUN_ID}`;
const clientUserId = `client-user-test-${RUN_ID}`;

function asUser(id: string) {
  return { "x-test-user-id": id };
}

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: advisorA, email: `advisor-a-${RUN_ID}@test.local`, fullName: "Advisor A", role: "advisor" },
    { id: advisorB, email: `advisor-b-${RUN_ID}@test.local`, fullName: "Advisor B", role: "advisor" },
    { id: clientUserId, email: `client-user-${RUN_ID}@test.local`, fullName: "Client User", role: "investment_client" },
  ]);
  await db.insert(clientProfilesTable).values({ userId: clientUserId, advisorId: advisorA });
});

afterAll(async () => {
  await db.delete(documentsTable).where(eq(documentsTable.userId, clientUserId));
  await db.delete(clientProfilesTable).where(eq(clientProfilesTable.userId, clientUserId));
  await db.delete(profilesTable).where(eq(profilesTable.id, clientUserId));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorA));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorB));
});

describe("retired KYC verify/reject workflow", () => {
  it("no longer exposes the per-document verify endpoint", async () => {
    await request(app)
      .post(`/api/advisor/clients/${clientUserId}/kyc/00000000-0000-0000-0000-000000000000/verify`)
      .set(asUser(advisorA))
      .send({ status: "approved" })
      .expect(404);
  });

  it("no longer exposes the advisor kyc-documents list", async () => {
    await request(app).get(`/api/advisor/clients/${clientUserId}/kyc`).set(asUser(advisorA)).expect(404);
  });
});

describe("advisor documents for an already-promoted client", () => {
  it("403s an advisor who doesn't own this client", async () => {
    await request(app)
      .post(`/api/advisor/clients/${clientUserId}/documents`)
      .set(asUser(advisorB))
      .send({ title: "Passport.pdf", category: "kyc", fileUrl: "https://example.com/passport.pdf" })
      .expect(403);
  });

  it("lets the assigned advisor upload and list documents, tagged admin-uploaded", async () => {
    const created = await request(app)
      .post(`/api/advisor/clients/${clientUserId}/documents`)
      .set(asUser(advisorA))
      .send({ title: "Passport.pdf", category: "kyc", fileUrl: "https://example.com/passport.pdf" })
      .expect(201);
    expect(created.body.isAdminUploaded).toBe(true);

    const res = await request(app).get(`/api/advisor/clients/${clientUserId}/documents`).set(asUser(advisorA)).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe("kyc");
  });
});
