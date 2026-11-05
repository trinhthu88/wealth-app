import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const { db, profilesTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const ADMIN_ID = `enum-test-admin-${Date.now()}`;
beforeAll(async () => {
  await db.insert(profilesTable).values({ id: ADMIN_ID, email: `${ADMIN_ID}@test.local`, role: "super_admin" });
});
afterAll(async () => {
  await db.delete(profilesTable).where(eq(profilesTable.id, ADMIN_ID));
});

describe("shared status enum validation", () => {
  it("rejects legacy goal pacing values at the API boundary", async () => {
    const response = await request(app)
      .post("/api/goals")
      .set({ "x-test-user-id": "enum-test-user" })
      .send({ title: "Goal", goalType: "custom", status: "on_track" })
      .expect(400);

    expect(response.body.error).toBe("Invalid goal payload");
  });

  it("rejects unknown client lifecycle values on the admin user route", async () => {
    // Client status is advisor/admin-only; PUT /client-profile/me ignores it
    // entirely (covered in profileFieldsP5.test.ts).
    const response = await request(app)
      .post("/api/admin/users")
      .set({ "x-test-user-id": ADMIN_ID })
      .send({ email: "enum-status@example.test", password: "x", role: "investment_client", status: "prospect" })
      .expect(400);

    expect(response.body.error).toBe("Invalid client status");
  });

  it("rejects unknown lead lifecycle values before inserting a lead", async () => {
    const response = await request(app)
      .post("/api/advisor/leads")
      .set("x-test-user-id", ADMIN_ID)
      .send({ email: "enum-test@example.test", status: "prospect" })
      .expect(400);

    expect(response.body.error).toMatch(/lead status/);
  });
});
