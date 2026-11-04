import { afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db, profilesTable, clientProfilesTable, leadsTable, userEngagementTable, healthScoresTable, conversionCheckpointsTable,
  financialGoalsTable, clientBudgetMonthsTable, budgetEntriesTable, pathwayProgressTable, assetsTable, liabilitiesTable,
  goalProgressSnapshotsTable,
} = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");
const { awardMilestones, dailyCheckin, getEngagement, nextStreak, weekStart } = await import("../../lib/engagement");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const created: string[] = [];
let counter = 0;
async function makeUser(role: "free_user" | "investment_client" | "advisor" = "free_user", values = {}) {
  const id = `eng-${++counter}-${RUN_ID}`;
  created.push(id);
  await db.insert(profilesTable).values({ id, email: `${id}@test.local`, fullName: "Test User", role, ...values });
  return id;
}
const asUser = (id: string) => ({ "x-test-user-id": id });

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const tsx = path.join(repoRoot, "scripts/node_modules/.bin/tsx");
const runScript = (script: string, args: string[]) => execFileSync(tsx, [path.join(repoRoot, "scripts/src", `${script}.ts`), ...args], { env: process.env, encoding: "utf8" });

afterAll(async () => {
  const t = inArray;
  await db.delete(conversionCheckpointsTable).where(t(conversionCheckpointsTable.userId, created));
  await db.delete(userEngagementTable).where(t(userEngagementTable.userId, created));
  await db.delete(healthScoresTable).where(t(healthScoresTable.userId, created));
  await db.delete(leadsTable).where(t(leadsTable.userId, created));
  await db.delete(budgetEntriesTable).where(t(budgetEntriesTable.userId, created));
  await db.delete(pathwayProgressTable).where(t(pathwayProgressTable.userId, created));
  await db.delete(clientBudgetMonthsTable).where(t(clientBudgetMonthsTable.userId, created));
  await db.delete(assetsTable).where(t(assetsTable.userId, created));
  await db.delete(liabilitiesTable).where(t(liabilitiesTable.userId, created));
  await db.delete(goalProgressSnapshotsTable).where(t(goalProgressSnapshotsTable.userId, created));
  await db.delete(financialGoalsTable).where(t(financialGoalsTable.userId, created));
  await db.delete(clientProfilesTable).where(t(clientProfilesTable.userId, created));
  await db.delete(profilesTable).where(t(profilesTable.id, created));
});

describe("streak", () => {
  const monday = new Date("2026-06-15T09:00:00Z");
  const sunday = new Date("2026-06-21T23:00:00Z");
  it("weeks start on Monday, including from a Sunday", () => {
    expect(weekStart(monday).toISOString().slice(0, 10)).toBe("2026-06-15");
    expect(weekStart(sunday).toISOString().slice(0, 10)).toBe("2026-06-15");
  });
  it("starts at one", () => {
    expect(nextStreak(0, null, monday)).toBe(1);
  });
  it("holds within a week", () => {
    expect(nextStreak(3, monday, sunday)).toBe(3);
  });
  it("grows the next week, even across a Sunday-to-Monday boundary", () => {
    expect(nextStreak(3, sunday, new Date("2026-06-22T00:30:00Z"))).toBe(4);
  });
  it("restarts after a missed week", () => {
    expect(nextStreak(9, monday, new Date("2026-06-29T09:00:00Z"))).toBe(1);
  });
});

describe("milestones", () => {
  const none = {
    goalsCount: 0, onboardingComplete: false, streakWeeks: 0, netWorth: 0, effectiveSavingsRate: 0,
    goalOnTrack: false, healthScore: 0, budgetMonthsCount: 0,
  };
  it.each([
    ["goal_setter", { goalsCount: 1 }], ["plan_starter", { onboardingComplete: true }], ["streak_4", { streakWeeks: 4 }],
    ["net_worth_pos", { netWorth: 1 }], ["saver_20", { effectiveSavingsRate: 20 }], ["goal_on_track", { goalOnTrack: true }],
    ["score_70", { healthScore: 70 }], ["budget_3months", { budgetMonthsCount: 3 }],
  ])("%s", (key, facts) => {
    expect(awardMilestones([], { ...none, ...facts })).toContain(key);
    expect(awardMilestones([], none)).not.toContain(key);
  });
  it("keeps one already earned, even when the fact no longer holds", () => {
    expect(awardMilestones(["score_80"], none)).toEqual(["score_80"]);
  });
});

describe("check-in on GET /me/entitlements", () => {
  const get = (u: string) => request(app).get("/api/me/entitlements").set(asUser(u)).expect(200);

  it("records a check-in once a day", async () => {
    const u = await makeUser();
    await get(u);
    const first = await getEngagement(u);
    expect(first.streakWeeks).toBe(1);
    expect(first.lastCheckinAt).not.toBeNull();
    await get(u);
    const second = await getEngagement(u);
    expect(second.lastCheckinAt).toEqual(first.lastCheckinAt);
    expect(second.streakWeeks).toBe(1);
  });

  it("concurrent requests make one check-in", async () => {
    const u = await makeUser();
    await Promise.all(Array.from({ length: 5 }, () => get(u)));
    expect((await getEngagement(u)).streakWeeks).toBe(1);
  });

  it("grows the streak a week later and awards the milestone", async () => {
    const u = await makeUser();
    await db.insert(userEngagementTable).values({ userId: u, streakWeeks: 3, lastCheckinAt: new Date(Date.now() - 7 * 86_400_000) });
    await get(u);
    const e = await getEngagement(u);
    expect(e.streakWeeks).toBe(4);
    expect(e.milestones).toContain("streak_4");
  });

  it("does not track staff", async () => {
    const advisor = await makeUser("advisor");
    await get(advisor);
    expect(await db.select().from(userEngagementTable).where(eq(userEngagementTable.userId, advisor))).toHaveLength(0);
  });

  it("C6 fires from the table when the streak reaches four weeks at a score of 70", async () => {
    const u = await makeUser();
    await db.insert(healthScoresTable).values({ userId: u, scoreDate: "2026-01-01", overallScore: 75 });
    await db.insert(userEngagementTable).values({ userId: u, streakWeeks: 3, lastCheckinAt: new Date(Date.now() - 7 * 86_400_000) });
    const res = await get(u);
    expect(res.body.openCheckpoint).toMatchObject({ code: "C6_engaged", snapshot: { variant: "engaged_high", streakWeeks: 4, score: 75 } });
  });

  it("C6 fires for a user 90 days in with a low score, and not at 89 days", async () => {
    const stuck = await makeUser("free_user", { createdAt: new Date(Date.now() - 90 * 86_400_000) });
    await db.insert(healthScoresTable).values({ userId: stuck, scoreDate: "2026-01-01", overallScore: 40 });
    expect((await get(stuck)).body.openCheckpoint).toMatchObject({ code: "C6_engaged", snapshot: { variant: "engaged_low" } });

    const early = await makeUser("free_user", { createdAt: new Date(Date.now() - 89 * 86_400_000) });
    await db.insert(healthScoresTable).values({ userId: early, scoreDate: "2026-01-01", overallScore: 40 });
    expect((await get(early)).body.openCheckpoint).toBeNull();
  });

  it("a failing check-in does not fail entitlements", async () => {
    const u = await makeUser();
    const spy = vi.spyOn(db, "transaction").mockImplementationOnce(() => { throw new Error("database down"); });
    await expect(dailyCheckin(u)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe("engagement routes", () => {
  it("GET /me/engagement returns the caller's own, with zeroes before any check-in", async () => {
    const u = await makeUser();
    const res = await request(app).get("/api/me/engagement").set(asUser(u)).expect(200);
    expect(res.body).toEqual({ streakWeeks: 0, lastCheckinAt: null, milestones: [], lastTipWeek: null });
  });

  it("GET /advisor/leads/:id/engagement is scoped to the assigned advisor", async () => {
    const advisor = await makeUser("advisor");
    const other = await makeUser("advisor");
    const u = await makeUser();
    await db.insert(leadsTable).values({ email: `${u}@test.local`, userId: u, status: "active", assignedAdvisorId: advisor });
    await db.insert(userEngagementTable).values({ userId: u, streakWeeks: 5, milestones: ["streak_4"] });
    const res = await request(app).get(`/api/advisor/leads/${u}/engagement`).set(asUser(advisor)).expect(200);
    expect(res.body).toMatchObject({ streakWeeks: 5, milestones: ["streak_4"] });
    await request(app).get(`/api/advisor/leads/${u}/engagement`).set(asUser(other)).expect(403);
  });
});

describe("retired routes", () => {
  it("keeps pathway progress available only to free users", async () => {
    const freeUser = await makeUser("free_user");
    await request(app).get("/api/pathway").set(asUser(freeUser)).expect(200).expect([]);
    const saved = await request(app)
      .put("/api/pathway/1")
      .set(asUser(freeUser))
      .send({ stepName: "about", status: "completed", formData: { age: 30 } })
      .expect(201);
    expect(saved.body).toMatchObject({
      userId: freeUser,
      stepNumber: 1,
      stepName: "about",
      status: "completed",
      formData: { age: 30 },
    });
    const progress = await request(app).get("/api/pathway").set(asUser(freeUser)).expect(200);
    expect(progress.body).toHaveLength(1);
    expect(progress.body[0]).toMatchObject({ stepNumber: 1, stepName: "about" });

    const investmentClient = await makeUser("investment_client");
    await request(app).get("/api/pathway").set(asUser(investmentClient)).expect(403);
    await request(app)
      .put("/api/pathway/1")
      .set(asUser(investmentClient))
      .send({ stepName: "about", status: "completed" })
      .expect(403);
  });
});

describe("migrate-free-tier-to-client", () => {
  const steps = (u: string) => [
    { stepNumber: 1, stepName: "about", status: "completed", formData: { age: 30, isExpat: true, currency: "SGD" } },
    { stepNumber: 2, stepName: "income", status: "completed", formData: { income: 5000 } },
    { stepNumber: 3, stepName: "expenses", status: "completed", formData: { housing: 1000, food: 500, other: 100 } },
    { stepNumber: 4, stepName: "goal", status: "completed", formData: { goalTitle: "Emergency fund", goalType: "emergency_fund", goalTarget: 10000, goalYear: "2031", goalMonth: "Jan" } },
    { stepNumber: 5, stepName: "net worth", status: "completed", formData: { savings: 10000, investments: 1000, debts: 3000 } },
    { stepNumber: 6, stepName: "risk", status: "completed", formData: { riskProfile: "Aggressive" } },
  ].map((s) => ({ ...s, userId: u }));
  const run = (u: string, ...flags: string[]) => runScript("migrate-free-tier-to-client", [`--user=${u}`, ...flags]);
  const snapshot = async (u: string) => ({
    months: await db.select().from(clientBudgetMonthsTable).where(eq(clientBudgetMonthsTable.userId, u)),
    goals: await db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, u)),
    assets: await db.select().from(assetsTable).where(eq(assetsTable.userId, u)),
    liabilities: await db.select().from(liabilitiesTable).where(eq(liabilitiesTable.userId, u)),
    cp: await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, u)),
    profile: (await db.select().from(profilesTable).where(eq(profilesTable.id, u)))[0],
  });

  it("writes nothing without --apply, and logs what it would do", async () => {
    const u = await makeUser();
    await db.insert(pathwayProgressTable).values(steps(u));
    const out = run(u);
    expect(out).toContain('"goals":1');
    const s = await snapshot(u);
    expect(s.goals).toHaveLength(0);
    expect(s.months).toHaveLength(0);
  }, 60_000);

  it("fills every empty owner from the wizard, without inventing a date of birth", async () => {
    const u = await makeUser();
    await db.insert(pathwayProgressTable).values(steps(u));
    run(u, "--apply");
    const s = await snapshot(u);
    expect(s.goals).toHaveLength(1);
    expect(s.goals[0]).toMatchObject({ title: "Emergency fund", goalType: "emergency_fund", targetDate: "2031-01-01" });
    expect(Number(s.goals[0].targetAmount)).toBe(10000);
    expect(s.months).toHaveLength(1);
    expect(Number(s.months[0].totalIncome)).toBe(5000);
    expect(Number(s.months[0].totalExpenses)).toBe(1600);
    expect(Number(s.months[0].netSurplus)).toBe(3400);
    expect(s.assets.map((a) => a.name).sort()).toEqual(["Investments", "Savings"]);
    expect(Number(s.liabilities[0].balanceUsd)).toBe(3000);
    expect(s.cp[0].riskProfile).toBe("growth");
    expect(s.profile).toMatchObject({ isExpat: true, preferredCurrency: "SGD", dateOfBirth: null });
  }, 60_000);

  it("is idempotent", async () => {
    const u = await makeUser();
    await db.insert(pathwayProgressTable).values(steps(u));
    run(u, "--apply");
    const before = await snapshot(u);
    const out = run(u, "--apply");
    expect(out).toContain('"budgetMonths":0');
    expect(out).toContain('"goals":0');
    expect(out).toContain('"assets":0');
    const after = await snapshot(u);
    expect(after.goals.map((g) => g.id)).toEqual(before.goals.map((g) => g.id));
    expect(after.months.map((m) => m.id)).toEqual(before.months.map((m) => m.id));
    expect(after.assets).toHaveLength(before.assets.length);
    expect(after.liabilities).toHaveLength(before.liabilities.length);
  }, 90_000);

  it("never overwrites what the user already has", async () => {
    const u = await makeUser("free_user", { preferredCurrency: "VND" });
    await db.insert(pathwayProgressTable).values(steps(u));
    await db.insert(financialGoalsTable).values({ userId: u, title: "Mine", goalType: "house" });
    await db.insert(clientBudgetMonthsTable).values({ userId: u, month: "2026-01-01", totalIncome: "42" });
    await db.insert(assetsTable).values({ userId: u, name: "Flat", category: "property", valueUsd: "9" });
    await db.insert(clientProfilesTable).values({ userId: u, riskProfile: "conservative", riskProfileSource: "self" });
    run(u, "--apply");
    const s = await snapshot(u);
    expect(s.goals.map((g) => g.title)).toEqual(["Mine"]);
    expect(s.months.map((m) => Number(m.totalIncome))).toEqual([42]);
    expect(s.assets.map((a) => a.name)).toEqual(["Flat"]);
    expect(s.cp[0].riskProfile).toBe("conservative");
    expect(s.profile.preferredCurrency).toBe("VND");
  }, 60_000);

  it("copies budget_entries, and leaves the source in place", async () => {
    const u = await makeUser();
    await db.insert(budgetEntriesTable).values({ userId: u, periodMonth: "2026-02-01", income: "3000", housing: "1000", savingsActual: "2000" });
    run(u, "--apply");
    const s = await snapshot(u);
    expect(s.months.map((m) => m.month)).toEqual(["2026-02-01"]);
    expect(Number(s.months[0].totalIncome)).toBe(3000);
    expect(await db.select().from(budgetEntriesTable).where(eq(budgetEntriesTable.userId, u))).toHaveLength(1);
  }, 60_000);

  it("skips a client, whose owner rows are already theirs", async () => {
    const u = await makeUser("investment_client");
    await db.insert(pathwayProgressTable).values(steps(u));
    run(u, "--apply");
    expect((await snapshot(u)).goals).toHaveLength(0);
  }, 60_000);
});

describe("funnel-report", () => {
  it("prints cohorts, checkpoints and leads", async () => {
    const u = await makeUser();
    await db.insert(healthScoresTable).values({ userId: u, scoreDate: new Date().toISOString().slice(0, 10), overallScore: 60 });
    await db.insert(conversionCheckpointsTable).values({ userId: u, code: "C4_surplus", snapshot: {}, shownAt: new Date(), acceptedAt: new Date() });
    await db.insert(leadsTable).values({ email: `${u}@test.local`, userId: u, source: "C4_surplus", status: "client" });
    const out = runScript("funnel-report", ["--weeks=1"]);
    expect(out).toMatch(/Week of \d{4}-\d{2}-\d{2}: \d+ sign-ups, \d+ activated/);
    expect(out).toMatch(/C4_surplus: fired \d+, shown \d+, accepted \d+/);
    expect(out).toMatch(/leads from C4_surplus: \d+, promoted within 30 days \d+/);
  }, 60_000);
});
