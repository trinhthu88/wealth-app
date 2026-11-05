import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const { tokenMatches } = await import("../productionTasks");

const TOKEN = "t".repeat(40);
const saved = { token: process.env.PRODUCTION_TASKS_TOKEN, tasks: process.env.PRODUCTION_TASKS };
afterEach(() => {
  process.env.PRODUCTION_TASKS_TOKEN = saved.token;
  process.env.PRODUCTION_TASKS = saved.tasks;
});

describe("POST /api/internal/production-tasks", () => {
  it("does not exist without the secret, with a short secret, or with the wrong token", async () => {
    delete process.env.PRODUCTION_TASKS_TOKEN;
    await request(app).post("/api/internal/production-tasks").set("x-production-token", TOKEN).expect(404);
    process.env.PRODUCTION_TASKS_TOKEN = "short";
    await request(app).post("/api/internal/production-tasks").set("x-production-token", "short").expect(404);
    process.env.PRODUCTION_TASKS_TOKEN = TOKEN;
    await request(app).post("/api/internal/production-tasks").expect(404);
    await request(app).post("/api/internal/production-tasks").set("x-production-token", "x".repeat(40)).expect(404);
    await request(app).post("/api/internal/production-tasks").set("x-production-token", TOKEN + "x").expect(404);
  });

  it("runs the job runner with the right token and streams its end", async () => {
    process.env.PRODUCTION_TASKS_TOKEN = TOKEN;
    process.env.PRODUCTION_TASKS = ""; // the runner then does nothing and exits 0
    const res = await request(app).post("/api/internal/production-tasks").set("x-production-token", TOKEN).expect(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.text).toContain("Finished.");
  });

  it("compares tokens of different lengths without throwing", () => {
    expect(tokenMatches(undefined, TOKEN)).toBe(false);
    expect(tokenMatches("a", TOKEN)).toBe(false);
    expect(tokenMatches(TOKEN, TOKEN)).toBe(true);
  });
});
