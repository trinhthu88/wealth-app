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
const advisorId = `advisor-test-${RUN_ID}`;

function asUser(id: string) {
  return { "x-test-user-id": id };
}

async function cleanupUser(userId: string) {
  await db.delete(advisedPlansTable).where(eq(advisedPlansTable.userId, userId));
  await db.delete(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
  await db.delete(leadsTable).where(eq(leadsTable.userId, userId));
  await db.delete(profilesTable).where(eq(profilesTable.id, userId));
}

beforeAll(async () => {
  await db.insert(profilesTable).values({
    id: advisorId, email: `advisor-${RUN_ID}@test.local`, fullName: "Advisor", role: "advisor",
  });
});

afterAll(async () => {
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorId));
});

describe("lead promotion (PUT /leads/:id → status: client)", () => {
  it("rejects promoting an anonymous lead (no linked userId)", async () => {
    const [lead] = await db.insert(leadsTable).values({
      email: `anon-${RUN_ID}@test.local`, status: "active", assignedAdvisorId: advisorId,
    }).returning();

    const res = await request(app).put(`/api/leads/${lead.id}`).set(asUser(advisorId)).send({ status: "client" }).expect(409);
    expect(res.body.error).toMatch(/no linked account/i);

    const [row] = await db.select().from(leadsTable).where(eq(leadsTable.id, lead.id));
    expect(row.status).toBe("active"); // unchanged

    await db.delete(leadsTable).where(eq(leadsTable.id, lead.id));
  });

  it("rejects promoting an unassigned lead", async () => {
    const userId = `lead-user-unassigned-${RUN_ID}`;
    await db.insert(profilesTable).values({ id: userId, email: `${userId}@test.local`, fullName: "Unassigned Lead", role: "free_user" });
    const [lead] = await db.insert(leadsTable).values({
      email: `${userId}@test.local`, userId, status: "unassigned",
    }).returning();

    const res = await request(app).put(`/api/leads/${lead.id}`).set(asUser(advisorId)).send({ status: "client" }).expect(409);
    expect(res.body.error).toMatch(/assign this lead/i);

    await cleanupUser(userId);
  });

  it("promotes track_b (no in-force plan): flips role, creates client_profiles active/track_b, stamps convertedUserId", async () => {
    const userId = `lead-user-trackb-${RUN_ID}`;
    await db.insert(profilesTable).values({ id: userId, email: `${userId}@test.local`, fullName: "Track B Lead", role: "free_user" });
    const [lead] = await db.insert(leadsTable).values({
      email: `${userId}@test.local`, userId, status: "active", assignedAdvisorId: advisorId,
    }).returning();

    const res = await request(app).put(`/api/leads/${lead.id}`).set(asUser(advisorId)).send({ status: "client" }).expect(200);
    expect(res.body.status).toBe("client");
    expect(res.body.convertedUserId).toBe(userId);

    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
    expect(profile.role).toBe("investment_client");

    const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
    expect(cp.status).toBe("active");
    expect(cp.clientTrack).toBe("track_b");
    expect(cp.advisorId).toBe(advisorId);

    await cleanupUser(userId);
  });

  it("promotes track_a when the lead has an in-force advised plan", async () => {
    const userId = `lead-user-tracka-${RUN_ID}`;
    await db.insert(profilesTable).values({ id: userId, email: `${userId}@test.local`, fullName: "Track A Lead", role: "free_user" });
    const [lead] = await db.insert(leadsTable).values({
      email: `${userId}@test.local`, userId, status: "active", assignedAdvisorId: advisorId,
    }).returning();
    await db.insert(advisedPlansTable).values({
      userId, advisorId, providerName: "Acme", productName: "Growth Plan", status: "inforce", policyNumber: "POL-1",
    });

    const res = await request(app).put(`/api/leads/${lead.id}`).set(asUser(advisorId)).send({ status: "client" }).expect(200);
    expect(res.body.status).toBe("client");

    const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
    expect(cp.clientTrack).toBe("track_a");

    await cleanupUser(userId);
  });

  it("doesn't clobber an existing convertedUserId or re-run promotion when status is already client", async () => {
    const userId = `lead-user-idempotent-${RUN_ID}`;
    await db.insert(profilesTable).values({ id: userId, email: `${userId}@test.local`, fullName: "Idempotent Lead", role: "investment_client" });
    await db.insert(clientProfilesTable).values({ userId, advisorId, status: "active", clientTrack: "track_b" });
    const [lead] = await db.insert(leadsTable).values({
      email: `${userId}@test.local`, userId, status: "client", assignedAdvisorId: advisorId, convertedUserId: userId,
    }).returning();

    // Editing notes while already "client" should not re-trigger promotion or touch convertedUserId.
    const res = await request(app).put(`/api/leads/${lead.id}`).set(asUser(advisorId)).send({ notes: "Reviewed portfolio" }).expect(200);
    expect(res.body.convertedUserId).toBe(userId);
    expect(res.body.notes).toBe("Reviewed portfolio");

    await cleanupUser(userId);
  });

  it("upserts client_profiles if one already exists from a prior partial state", async () => {
    const userId = `lead-user-partial-${RUN_ID}`;
    await db.insert(profilesTable).values({ id: userId, email: `${userId}@test.local`, fullName: "Partial Lead", role: "free_user" });
    // Pre-existing client_profiles row (e.g. from an earlier direct-creation path), but role never flipped.
    await db.insert(clientProfilesTable).values({ userId, advisorId: null, status: "churned", clientTrack: "track_b" });
    const [lead] = await db.insert(leadsTable).values({
      email: `${userId}@test.local`, userId, status: "active", assignedAdvisorId: advisorId,
    }).returning();

    await request(app).put(`/api/leads/${lead.id}`).set(asUser(advisorId)).send({ status: "client" }).expect(200);

    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
    expect(profile.role).toBe("investment_client");

    const rows = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
    expect(rows).toHaveLength(1); // updated, not duplicated
    expect(rows[0].status).toBe("active");
    expect(rows[0].advisorId).toBe(advisorId);

    await cleanupUser(userId);
  });

  it("a promoted lead appears in GET /advisor/clients for the assigned advisor", async () => {
    const userId = `lead-user-listcheck-${RUN_ID}`;
    await db.insert(profilesTable).values({ id: userId, email: `${userId}@test.local`, fullName: "List Check Lead", role: "free_user" });
    const [lead] = await db.insert(leadsTable).values({
      email: `${userId}@test.local`, userId, status: "active", assignedAdvisorId: advisorId,
    }).returning();

    await request(app).put(`/api/leads/${lead.id}`).set(asUser(advisorId)).send({ status: "client" }).expect(200);

    const res = await request(app).get("/api/advisor/clients").set(asUser(advisorId)).expect(200);
    expect(res.body.some((c: any) => c.id === userId)).toBe(true);

    await cleanupUser(userId);
  });
});
