import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
  db, profilesTable, clientProfilesTable, leadsTable, advisedPlansTable, advisorAssignmentsTable, clientHoldingsTable,
} = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const id = (name: string) => `p5-${name}-${RUN_ID}`;
const advisorId = id("advisor");
const created: string[] = [advisorId];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const tsx = path.join(repoRoot, "scripts/node_modules/.bin/tsx");

/** Run a Phase 5 backfill script scoped to the given fixture users only. */
function runBackfill(script: string, userIds: string[]): string {
  if (userIds.length === 0) throw new Error("backfill tests must scope to fixture users");
  return execFileSync(tsx, [path.join(repoRoot, "scripts/src", `${script}.ts`), ...userIds.map((u) => `--user=${u}`)], {
    env: process.env, encoding: "utf8",
  });
}

async function makeProfile(name: string, values: Partial<typeof profilesTable.$inferInsert> = {}) {
  const userId = id(name);
  created.push(userId);
  await db.insert(profilesTable).values({ id: userId, email: `${userId}@test.local`, role: "free_user", ...values });
  return userId;
}

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

beforeAll(async () => {
  await db.insert(profilesTable).values({ id: advisorId, email: `${advisorId}@test.local`, role: "advisor" });
});

afterAll(async () => {
  await db.delete(advisorAssignmentsTable).where(inArray(advisorAssignmentsTable.clientUserId, created));
  await db.delete(clientHoldingsTable).where(inArray(clientHoldingsTable.userId, created));
  await db.delete(advisedPlansTable).where(inArray(advisedPlansTable.userId, created));
  await db.delete(leadsTable).where(inArray(leadsTable.userId, created));
  await db.delete(clientProfilesTable).where(inArray(clientProfilesTable.userId, created));
  await db.delete(profilesTable).where(inArray(profilesTable.id, created));
});

describe("a client_profiles row is not an investment client", () => {
  it("promotes a free user with a risk-only client_profiles row; they appear in the advisor list only after promotion", async () => {
    const userId = await makeProfile("risk-only-lead");
    await db.insert(clientProfilesTable).values({ userId, riskProfile: "balanced", riskProfileSource: "self" });
    const [lead] = await db.insert(leadsTable).values({
      email: `${userId}@test.local`, userId, status: "active", assignedAdvisorId: advisorId,
    }).returning();

    // Before promotion the advisor works the lead through the lead pointer,
    // even though a preferences-only client_profiles row exists.
    await request(app).get(`/api/advisor/clients/${userId}/advised-plans`).set(asUser(advisorId)).expect(200);
    const before = await request(app).get("/api/advisor/clients").set(asUser(advisorId)).expect(200);
    expect(before.body.map((c: any) => c.id)).not.toContain(userId);

    await request(app).put(`/api/leads/${lead.id}`).set(asUser(advisorId)).send({ status: "client" }).expect(200);

    const rows = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].advisorId).toBe(advisorId);
    expect(rows[0].status).toBe("active");
    expect(rows[0].riskProfile).toBe("balanced"); // preferences kept on the same row

    const after = await request(app).get("/api/advisor/clients").set(asUser(advisorId)).expect(200);
    expect(after.body.map((c: any) => c.id)).toContain(userId);
  });

  it("keeps a free user whose row points at the advisor out of the advisor's client list", async () => {
    const userId = await makeProfile("free-with-advisor");
    await db.insert(clientProfilesTable).values({ userId, advisorId });
    const res = await request(app).get("/api/advisor/clients").set(asUser(advisorId)).expect(200);
    expect(res.body.map((c: any) => c.id)).not.toContain(userId);
  });
});

describe("risk profile ownership", () => {
  it("PUT /profiles/me writes the stored vocabulary to client_profiles with source self", async () => {
    const userId = await makeProfile("free-quiz");
    const res = await request(app).put("/api/profiles/me").set(asUser(userId)).send({ riskProfile: "Moderate" }).expect(200);
    expect(res.body.riskProfile).toBe("balanced");
    expect(res.body.riskProfileSource).toBe("self");

    const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
    expect(cp.riskProfile).toBe("balanced");
    expect(cp.riskProfileSource).toBe("self");
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
    expect(profile.riskProfile).toBeNull(); // deprecated copy is no longer written

    const me = await request(app).get("/api/profiles/me").set(asUser(userId)).expect(200);
    expect(me.body.riskProfile).toBe("balanced");
  });

  it("rejects a risk value outside the vocabulary", async () => {
    const userId = await makeProfile("bad-risk");
    const res = await request(app).put("/api/profiles/me").set(asUser(userId)).send({ riskProfile: "yolo" }).expect(400);
    expect(res.body.error).toBe("Invalid risk profile");
  });
});

describe("client self-service cannot change advisor/admin-owned fields", () => {
  it("ignores status on PUT /client-profile/me", async () => {
    const userId = await makeProfile("self-status", { role: "investment_client" });
    await db.insert(clientProfilesTable).values({ userId, status: "active" });
    const res = await request(app).put("/api/client-profile/me").set(asUser(userId))
      .send({ status: "churned", riskProfile: "growth" }).expect(200);
    expect(res.body.status).toBe("active");
    expect(res.body.riskProfile).toBe("growth");
    expect(res.body.riskProfileSource).toBe("self");
  });

  it("does not let PUT /client/holdings/:id change the holding's owner", async () => {
    const owner = await makeProfile("holding-owner", { role: "investment_client" });
    const other = await makeProfile("holding-other", { role: "investment_client" });
    const [holding] = await db.insert(clientHoldingsTable).values({ userId: owner, holdingType: "cash", label: "Savings" }).returning();

    const res = await request(app).put(`/api/client/holdings/${holding.id}`).set(asUser(owner))
      .send({ userId: other, id: "00000000-0000-0000-0000-000000000000", label: "Renamed" }).expect(200);
    expect(res.body.label).toBe("Renamed");

    const [row] = await db.select().from(clientHoldingsTable).where(eq(clientHoldingsTable.id, holding.id));
    expect(row.userId).toBe(owner);
  });
});

describe("onboarding stage, date of birth, currency and derived track", () => {
  it("basics stores DOB as the 1st of the month and currency on profiles, and sets stage profile; complete never steps back", async () => {
    const userId = await makeProfile("onboarding", { role: "investment_client" });

    await request(app).put("/api/client/profile/basics").set(asUser(userId))
      .send({ fullName: "Onboarding Client", countryCode: "VN", isExpat: true, preferredCurrency: "EUR", dateOfBirth: "1990-07" })
      .expect(200);
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
    expect(profile.dateOfBirth).toBe("1990-07-01");
    expect(profile.preferredCurrency).toBe("EUR");
    let [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
    expect(cp.onboardingStage).toBe("profile");

    await request(app).post("/api/client/onboarding/complete").set(asUser(userId))
      .send({ firstFocus: "know_my_money" }).expect(200);
    await request(app).put("/api/client/profile/basics").set(asUser(userId))
      .send({ fullName: "Onboarding Client", countryCode: "VN", dateOfBirth: "1990-07-23" }).expect(200);
    [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
    expect(cp.onboardingStage).toBe("complete");
    expect(cp.firstFocus).toBe("know_my_money");

    const track = await request(app).get("/api/client/profile/track").set(asUser(userId)).expect(200);
    expect(track.body.onboardingStage).toBe("complete");
    expect(track.body.preferredCurrency).toBe("EUR");
  });

  it("rejects an invalid or future date of birth", async () => {
    const userId = await makeProfile("bad-dob", { role: "investment_client" });
    await request(app).put("/api/client/profile/basics").set(asUser(userId)).send({ dateOfBirth: "1990-13" }).expect(400);
    await request(app).put("/api/client/profile/basics").set(asUser(userId)).send({ dateOfBirth: "2999-01" }).expect(400);
  });

  it("derives track from visible advised plans and never writes client_track", async () => {
    const userId = await makeProfile("track", { role: "investment_client" });
    await db.insert(clientProfilesTable).values({ userId, advisorId });

    let res = await request(app).get("/api/client/profile/track").set(asUser(userId)).expect(200);
    expect(res.body.track).toBe("self_managed");
    expect(res.body.hasPendingAdvisorSetup).toBe(false);

    const [plan] = await db.insert(advisedPlansTable).values({
      userId, advisorId, providerName: "Acme", productName: "Hidden Plan", isVisibleToClient: false,
    }).returning();
    res = await request(app).get("/api/client/profile/track").set(asUser(userId)).expect(200);
    expect(res.body.track).toBe("self_managed");
    expect(res.body.hasPendingAdvisorSetup).toBe(true);

    await db.update(advisedPlansTable).set({ isVisibleToClient: true }).where(eq(advisedPlansTable.id, plan.id));
    res = await request(app).get("/api/client/profile/track").set(asUser(userId)).expect(200);
    expect(res.body.track).toBe("advised");

    await request(app).post(`/api/advisor/clients/${userId}/advised-plans`).set(asUser(advisorId))
      .send({ providerName: "Acme", productName: "Second Plan" }).expect(201);
    const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
    expect(cp.clientTrack).toBe("track_b"); // column default, untouched
  });
});

describe("Phase 5 backfill rules (scripts scoped to fixture users)", () => {
  it("currency: copies client_profiles currency only where profiles still holds the USD default", async () => {
    const defaulted = await makeProfile("cur-default");
    const chosen = await makeProfile("cur-chosen", { preferredCurrency: "GBP" });
    await db.insert(clientProfilesTable).values([
      { userId: defaulted, preferredDisplayCurrency: "EUR" },
      { userId: chosen, preferredDisplayCurrency: "EUR" },
    ]);
    runBackfill("p5-backfill-currency", [defaulted, chosen]);
    const rows = await db.select().from(profilesTable).where(inArray(profilesTable.id, [defaulted, chosen]));
    expect(rows.find((r) => r.id === defaulted)?.preferredCurrency).toBe("EUR");
    expect(rows.find((r) => r.id === chosen)?.preferredCurrency).toBe("GBP");
  });

  it("risk normalization: lowercases and maps moderate/aggressive", async () => {
    const a = await makeProfile("norm-a", { riskProfile: "Aggressive" });
    const b = await makeProfile("norm-b", { riskProfile: "moderate" });
    const c = await makeProfile("norm-c", { riskProfile: "Conservative" });
    runBackfill("p5-normalize-risk-profile", [a, b, c]);
    const rows = await db.select().from(profilesTable).where(inArray(profilesTable.id, [a, b, c]));
    expect(Object.fromEntries(rows.map((r) => [r.id, r.riskProfile]))).toEqual({ [a]: "growth", [b]: "balanced", [c]: "conservative" });
  });

  it("risk backfill: creates or fills client_profiles with source self, never overwrites an existing value", async () => {
    const noRow = await makeProfile("risk-norow", { riskProfile: "growth" });
    const emptyRow = await makeProfile("risk-empty", { riskProfile: "conservative" });
    const kept = await makeProfile("risk-kept", { riskProfile: "growth" });
    await db.insert(clientProfilesTable).values([
      { userId: emptyRow },
      { userId: kept, riskProfile: "balanced" },
    ]);
    runBackfill("p5-backfill-risk-profile", [noRow, emptyRow, kept]);
    const rows = await db.select().from(clientProfilesTable).where(inArray(clientProfilesTable.userId, [noRow, emptyRow, kept]));
    const byUser = Object.fromEntries(rows.map((r) => [r.userId, r]));
    expect(byUser[noRow]).toMatchObject({ riskProfile: "growth", riskProfileSource: "self" });
    expect(byUser[emptyRow]).toMatchObject({ riskProfile: "conservative", riskProfileSource: "self" });
    expect(byUser[kept]).toMatchObject({ riskProfile: "balanced", riskProfileSource: null });
  });

  it("onboarding stage: track complete → complete, basics saved → profile, else not_started", async () => {
    const done = await makeProfile("stage-done");
    const basics = await makeProfile("stage-basics", { countryCode: "SG" });
    const fresh = await makeProfile("stage-fresh");
    await db.insert(clientProfilesTable).values([
      { userId: done, onboardingTrackComplete: true },
      { userId: basics },
      { userId: fresh },
    ]);
    runBackfill("p5-backfill-onboarding-stage", [done, basics, fresh]);
    const rows = await db.select().from(clientProfilesTable).where(inArray(clientProfilesTable.userId, [done, basics, fresh]));
    expect(Object.fromEntries(rows.map((r) => [r.userId, r.onboardingStage]))).toEqual({
      [done]: "complete", [basics]: "profile", [fresh]: "not_started",
    });
  });
});
