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
const userId = `user_test_${RUN_ID}`;

function asUser(id: string) {
  return { "x-test-user-id": id };
}

beforeAll(async () => {
  await db.insert(profilesTable).values({
    id: userId, email: `interest-${RUN_ID}@test.local`, fullName: "Interest Test User", role: "free_user",
  });
});

afterAll(async () => {
  await db.delete(leadsTable).where(eq(leadsTable.userId, userId));
  await db.delete(profilesTable).where(eq(profilesTable.id, userId));
});

describe("POST /leads/from-interest", () => {
  it("requires a source", async () => {
    await request(app).post("/api/leads/from-interest").set(asUser(userId)).send({}).expect(400);
  });

  it("creates a lead pulling email/name from the caller's own profile", async () => {
    const res = await request(app)
      .post("/api/leads/from-interest")
      .set(asUser(userId))
      .send({ source: "smart_upgrade_card" })
      .expect(201);

    expect(res.body.userId).toBe(userId);
    expect(res.body.email).toBe(`interest-${RUN_ID}@test.local`);
    expect(res.body.firstName).toBe("Interest Test User");
    expect(res.body.source).toBe("smart_upgrade_card");
    expect(res.body.status).toBe("unassigned");
  });

  it("dedupes a second CTA click into the same lead row, just touching source", async () => {
    const before = await db.select().from(leadsTable).where(eq(leadsTable.userId, userId));
    expect(before).toHaveLength(1);

    const res = await request(app)
      .post("/api/leads/from-interest")
      .set(asUser(userId))
      .send({ source: "goal_scenario_cta" })
      .expect(200);

    expect(res.body.id).toBe(before[0].id);
    expect(res.body.source).toBe("goal_scenario_cta");

    const after = await db.select().from(leadsTable).where(eq(leadsTable.userId, userId));
    expect(after).toHaveLength(1);
  });

  it("creates a fresh lead if the existing one has since churned", async () => {
    await db.update(leadsTable).set({ status: "churned" }).where(eq(leadsTable.userId, userId));

    const res = await request(app)
      .post("/api/leads/from-interest")
      .set(asUser(userId))
      .send({ source: "smart_upgrade_card" })
      .expect(201);

    expect(res.body.status).toBe("unassigned");

    const rows = await db.select().from(leadsTable).where(eq(leadsTable.userId, userId));
    expect(rows).toHaveLength(2);
  });
});
