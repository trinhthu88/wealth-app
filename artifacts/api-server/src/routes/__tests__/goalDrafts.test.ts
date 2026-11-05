import { afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));
vi.mock("@workspace/integrations-anthropic-ai", () => { throw new Error("not configured in tests"); });

const { default: app } = await import("../../app");
const {
  db, profilesTable, financialGoalsTable, goalProgressSnapshotsTable, goalHoldingLinksTable,
  membershipsTable, clientProfilesTable, leadsTable, conversionCheckpointsTable, userEngagementTable,
} = await import("@workspace/db");
const { inArray, eq } = await import("drizzle-orm");
const { setCompedMembership } = await import("../../lib/membershipStore");
const { toolGetGoalProgress } = await import("../sol");

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const created: string[] = [];
let counter = 0;

async function makeFreeUser() {
  const id = `draft-goal-${++counter}-${runId}`;
  created.push(id);
  await db.insert(profilesTable).values({
    id,
    email: `${id}@test.local`,
    fullName: "Draft Goal Test",
    role: "free_user",
  });
  return id;
}

const asUser = (id: string) => ({ "x-test-user-id": id });
const goal = (title: string) => ({
  title,
  goalType: "house",
  targetAmount: "200000",
  targetDate: "2030-01-01",
  currency: "USD",
  status: "active",
});

afterAll(async () => {
  const goals = await db.select({ id: financialGoalsTable.id }).from(financialGoalsTable)
    .where(inArray(financialGoalsTable.userId, created));
  if (goals.length) {
    await db.delete(goalProgressSnapshotsTable).where(inArray(goalProgressSnapshotsTable.goalId, goals.map(g => g.id)));
  }
  await db.delete(goalHoldingLinksTable).where(inArray(goalHoldingLinksTable.userId, created));
  await db.delete(conversionCheckpointsTable).where(inArray(conversionCheckpointsTable.userId, created));
  await db.delete(userEngagementTable).where(inArray(userEngagementTable.userId, created));
  await db.delete(leadsTable).where(inArray(leadsTable.userId, created));
  await db.delete(membershipsTable).where(inArray(membershipsTable.userId, created));
  await db.delete(clientProfilesTable).where(inArray(clientProfilesTable.userId, created));
  await db.delete(financialGoalsTable).where(inArray(financialGoalsTable.userId, created));
  await db.delete(profilesTable).where(inArray(profilesTable.id, created));
});

describe("free goal drafts", () => {
  it("saves a cap-refused goal as a draft without exposing it in active goals", async () => {
    const userId = await makeFreeUser();
    await request(app).post("/api/goals").set(asUser(userId)).send(goal("First")).expect(201);

    const refused = await request(app).post("/api/goals").set(asUser(userId)).send(goal("Second")).expect(403);
    expect(refused.body).toMatchObject({ code: "LIMIT", capability: "goals", draftSaved: true });
    expect(refused.body.draftGoalId).toEqual(expect.any(String));

    const visibleGoals = await request(app).get("/api/goals").set(asUser(userId)).expect(200);
    expect(visibleGoals.body).toHaveLength(1);
    expect(visibleGoals.body[0].status).toBe("active");

    const drafts = await request(app).get("/api/goals/drafts").set(asUser(userId)).expect(200);
    expect(drafts.body).toHaveLength(1);
    expect(drafts.body[0]).toMatchObject({ id: refused.body.draftGoalId, title: "Second" });
    expect(drafts.body[0]).not.toHaveProperty("pacing");
    expect(drafts.body).not.toHaveProperty("funding");
  });

  it("refuses draft status in client input and activates saved drafts when membership starts", async () => {
    const userId = await makeFreeUser();
    await request(app).post("/api/goals").set(asUser(userId)).send({ ...goal("Invalid"), status: "draft" }).expect(400);
    await request(app).post("/api/goals").set(asUser(userId)).send(goal("First")).expect(201);
    await request(app).post("/api/goals").set(asUser(userId)).send(goal("Second")).expect(403);

    const result = await setCompedMembership(userId, "comp", "Phase 9 goal draft test");
    expect(result.ok).toBe(true);
    const rows = await db.select({ title: financialGoalsTable.title, status: financialGoalsTable.status })
      .from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId));
    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.status === "active")).toBe(true);
    expect(await request(app).get("/api/goals/drafts").set(asUser(userId)).expect(200).then(res => res.body)).toEqual([]);
  });

  it("keeps drafts out of the client score and Sol goal-progress tool", async () => {
    const userId = await makeFreeUser();
    const first = await request(app).post("/api/goals").set(asUser(userId)).send(goal("First")).expect(201);
    await request(app).post("/api/goals").set(asUser(userId)).send(goal("Draft")).expect(403);
    await request(app).patch(`/api/goals/${first.body.id}/status`)
      .set(asUser(userId)).send({ status: "completed" }).expect(200);

    const score = await request(app).get("/api/client/health-score").set(asUser(userId)).expect(200);
    expect(score.body).toBeNull();
    expect(await toolGetGoalProgress(userId, {})).toEqual({ goals: [] });

    const draft = await db.select({ id: financialGoalsTable.id }).from(financialGoalsTable)
      .where(eq(financialGoalsTable.userId, userId));
    const draftId = draft.find(row => row.id !== first.body.id)?.id;
    expect(draftId).toBeDefined();
    expect(await toolGetGoalProgress(userId, { goalId: draftId })).toEqual({ goals: [] });
  });
});
