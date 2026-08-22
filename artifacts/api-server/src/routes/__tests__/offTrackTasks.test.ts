import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db, profilesTable, financialGoalsTable, clientProfilesTable, advisorTasksTable,
} = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clientId = `user_test_${RUN_ID}`;
const advisorId = `advisor_test_${RUN_ID}`;

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

let offTrackGoalId: string;
let onTrackGoalId: string;
let recoveringGoalId: string;

beforeAll(async () => {
  await db.insert(profilesTable).values({
    id: clientId, email: `off-track-${RUN_ID}@test.local`, fullName: "Off Track Test User", role: "investment_client",
  });
  await db.insert(clientProfilesTable).values({ userId: clientId, advisorId });

  // Created 12 months ago, target date today → fully elapsed (expectedPct 100%),
  // barely funded → actualPct ~1%. Comfortably below the off_track threshold
  // (actualPct < expectedPct * 0.6) regardless of exact rounding.
  const createdAt = new Date();
  createdAt.setMonth(createdAt.getMonth() - 12);
  const today = new Date().toISOString().slice(0, 10);

  const [offTrack] = await db.insert(financialGoalsTable).values({
    userId: clientId, title: "House deposit", goalType: "home_purchase",
    targetAmount: "100000", currentAmount: "1000", targetDate: today, createdAt,
  }).returning();
  offTrackGoalId = offTrack.id;

  const [onTrack] = await db.insert(financialGoalsTable).values({
    userId: clientId, title: "Retirement", goalType: "retirement",
    targetAmount: "100000", currentAmount: "95000", targetDate: today, createdAt,
  }).returning();
  onTrackGoalId = onTrack.id;

  const [recovering] = await db.insert(financialGoalsTable).values({
    userId: clientId, title: "Education fund", goalType: "education",
    targetAmount: "100000", currentAmount: "1000", targetDate: today, createdAt,
  }).returning();
  recoveringGoalId = recovering.id;
});

async function setCurrentAmount(goalId: string, amount: string) {
  await db.update(financialGoalsTable).set({ currentAmount: amount }).where(eq(financialGoalsTable.id, goalId));
}

afterAll(async () => {
  await db.delete(advisorTasksTable).where(eq(advisorTasksTable.clientId, clientId));
  await db.delete(financialGoalsTable).where(eq(financialGoalsTable.userId, clientId));
  await db.delete(clientProfilesTable).where(eq(clientProfilesTable.userId, clientId));
  await db.delete(profilesTable).where(eq(profilesTable.id, clientId));
});

describe("POST /client/goals/:id/ensure-off-track-task", () => {
  it("does nothing for a goal that isn't off-track", async () => {
    const res = await request(app)
      .post(`/api/client/goals/${onTrackGoalId}/ensure-off-track-task`)
      .set(asUser(clientId))
      .expect(200);
    expect(res.body.created).toBe(false);
    expect(res.body.status).not.toBe("off_track");
  });

  it("creates exactly one advisor task the first time a goal is found off-track", async () => {
    const res = await request(app)
      .post(`/api/client/goals/${offTrackGoalId}/ensure-off-track-task`)
      .set(asUser(clientId))
      .expect(200);
    expect(res.body).toEqual({ created: true, status: "off_track" });

    const rows = await db.select().from(advisorTasksTable).where(eq(advisorTasksTable.goalId, offTrackGoalId));
    expect(rows).toHaveLength(1);
    expect(rows[0].advisorId).toBe(advisorId);
    expect(rows[0].clientId).toBe(clientId);
    expect(rows[0].status).toBe("todo");
  });

  it("does not create a duplicate task on repeated views while still off-track", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post(`/api/client/goals/${offTrackGoalId}/ensure-off-track-task`)
        .set(asUser(clientId))
        .expect(200);
      expect(res.body).toEqual({ created: false, status: "off_track" });
    }

    const rows = await db.select().from(advisorTasksTable).where(eq(advisorTasksTable.goalId, offTrackGoalId));
    expect(rows).toHaveLength(1);
  });

  it("opens a new task for a new off-track episode once the prior one is resolved", async () => {
    await db.update(advisorTasksTable).set({ status: "done" }).where(eq(advisorTasksTable.goalId, offTrackGoalId));

    const res = await request(app)
      .post(`/api/client/goals/${offTrackGoalId}/ensure-off-track-task`)
      .set(asUser(clientId))
      .expect(200);
    expect(res.body).toEqual({ created: true, status: "off_track" });

    const rows = await db.select().from(advisorTasksTable).where(eq(advisorTasksTable.goalId, offTrackGoalId));
    expect(rows).toHaveLength(2);
    expect(rows.filter(r => r.status === "todo")).toHaveLength(1);
  });

  it("auto-resolves a stale open task once the goal recovers, so it can't block a later relapse", async () => {
    // Episode 1: off-track, task opens.
    const opened = await request(app)
      .post(`/api/client/goals/${recoveringGoalId}/ensure-off-track-task`)
      .set(asUser(clientId)).expect(200);
    expect(opened.body).toEqual({ created: true, status: "off_track" });

    // Recovers — nobody (no advisor) ever marked the task done.
    await setCurrentAmount(recoveringGoalId, "95000");
    const recovered = await request(app)
      .post(`/api/client/goals/${recoveringGoalId}/ensure-off-track-task`)
      .set(asUser(clientId)).expect(200);
    expect(recovered.body.created).toBe(false);
    expect(recovered.body.status).not.toBe("off_track");

    const afterRecovery = await db.select().from(advisorTasksTable).where(eq(advisorTasksTable.goalId, recoveringGoalId));
    expect(afterRecovery).toHaveLength(1);
    expect(afterRecovery[0].status).toBe("done"); // auto-closed, not left open

    // Relapse — a genuinely new episode. The now-closed task must not block it.
    await setCurrentAmount(recoveringGoalId, "1000");
    const relapsed = await request(app)
      .post(`/api/client/goals/${recoveringGoalId}/ensure-off-track-task`)
      .set(asUser(clientId)).expect(200);
    expect(relapsed.body).toEqual({ created: true, status: "off_track" });

    const afterRelapse = await db.select().from(advisorTasksTable).where(eq(advisorTasksTable.goalId, recoveringGoalId));
    expect(afterRelapse).toHaveLength(2);
    expect(afterRelapse.filter(r => r.status === "todo")).toHaveLength(1);
  });
});
