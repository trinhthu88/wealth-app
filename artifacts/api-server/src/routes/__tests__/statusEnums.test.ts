import { describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");

describe("shared status enum validation", () => {
  it("rejects legacy goal pacing values at the API boundary", async () => {
    const response = await request(app)
      .post("/api/goals")
      .set({ "x-test-user-id": "enum-test-user" })
      .send({ title: "Goal", goalType: "custom", status: "on_track" })
      .expect(400);

    expect(response.body.error).toBe("Invalid goal lifecycle status");
  });

  it("rejects unknown client lifecycle values before touching the database", async () => {
    const response = await request(app)
      .put("/api/client-profile/me")
      .set({ "x-test-user-id": "enum-test-user" })
      .send({ status: "prospect" })
      .expect(400);

    expect(response.body.error).toBe("Invalid client status");
  });

  it("rejects unknown lead lifecycle values before inserting a lead", async () => {
    const response = await request(app)
      .post("/api/leads")
      .send({ email: "enum-test@example.test", status: "prospect" })
      .expect(400);

    expect(response.body.error).toBe("Invalid lead status");
  });
});
