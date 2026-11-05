import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// An in-memory Clerk: users by email, with a switch that makes the instance refuse passwords.
const clerkUsers = new Map<string, { id: string; password: string | null }>();
let passwordsAllowed = true;
let nextId = 0;
const passwordError = () => Object.assign(new Error("password not allowed"), { errors: [{ code: "form_password_not_allowed", message: "Passwords are not enabled" }] });

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
  clerkClient: {
    users: {
      getUserList: async ({ emailAddress }: { emailAddress: string[] }) => {
        const user = clerkUsers.get(emailAddress[0]);
        return { data: user ? [{ id: user.id }] : [], totalCount: user ? 1 : 0 };
      },
      createUser: async ({ emailAddress, password }: { emailAddress: string[]; password?: string }) => {
        if (password && !passwordsAllowed) throw passwordError();
        const id = `demo_clerk_${Date.now()}_${nextId++}`;
        clerkUsers.set(emailAddress[0], { id, password: password ?? null });
        return { id };
      },
      updateUser: async (id: string, { password }: { password?: string }) => {
        if (password && !passwordsAllowed) throw passwordError();
        for (const [email, u] of clerkUsers) if (u.id === id) clerkUsers.set(email, { id, password: password ?? null });
        return { id };
      },
      getUser: async () => ({ primaryEmailAddressId: null, emailAddresses: [] }),
    },
  },
}));

const { default: app } = await import("../../app");
const schema = await import("@workspace/db");
const { db, profilesTable, clientProfilesTable, financialGoalsTable, clientHoldingsTable, clientBudgetMonthsTable, membershipsTable, advisedPlansTable } = schema;
const { eq, inArray } = await import("drizzle-orm");

const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const admin = `demo-test-admin-${RUN}`;
const notAdmin = `demo-test-advisor-${RUN}`;
const asUser = (id: string) => ({ "x-test-user-id": id });

async function demoUserIds(): Promise<string[]> {
  return [...clerkUsers.values()].map((u) => u.id);
}

async function cleanupDemoUsers() {
  const ids = await demoUserIds();
  if (ids.length === 0) return;
  const byUser = [
    "conversionCheckpointsTable", "userEngagementTable", "leadsTable", "advisorTasksTable", "netWorthSnapshotsTable",
    "assetsTable", "liabilitiesTable", "financialGoalsTable", "clientBudgetMonthsTable", "clientHoldingsTable",
    "membershipsTable", "healthScoresTable",
  ] as const;
  const s = schema as any;
  for (const conv of await db.select().from(s.conversationsTable).where(inArray(s.conversationsTable.clientId, ids))) {
    await db.delete(s.messagesTable).where(eq(s.messagesTable.conversationId, (conv as any).id));
  }
  await db.delete(s.conversationsTable).where(inArray(s.conversationsTable.clientId, ids));
  await db.delete(s.advisorTasksTable).where(inArray(s.advisorTasksTable.advisorId, ids));
  for (const name of byUser) {
    const table = s[name];
    if (table?.userId) await db.delete(table).where(inArray(table.userId, ids));
  }
  for (const name of ["advisedPlanHoldingsTable", "advisedPlanStatementsTable", "advisedPlansTable", "clientProfilesTable"]) {
    await db.delete(s[name]).where(inArray(s[name].userId, ids));
  }
  await db.delete(profilesTable).where(inArray(profilesTable.id, ids));
  clerkUsers.clear();
}

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: admin, email: `${admin}@test.local`, role: "super_admin" },
    { id: notAdmin, email: `${notAdmin}@test.local`, role: "advisor" },
  ]);
});

beforeEach(() => {
  passwordsAllowed = true;
  process.env.DEMO_ACCOUNTS_ENABLED = "true";
  process.env.DEMO_ACCOUNTS_EMAIL = `owner-${RUN}@example.com`;
});

afterAll(async () => {
  await cleanupDemoUsers();
  await db.delete(profilesTable).where(inArray(profilesTable.id, [admin, notAdmin]));
  delete process.env.DEMO_ACCOUNTS_ENABLED;
  delete process.env.DEMO_ACCOUNTS_EMAIL;
});

describe("demo accounts", () => {
  it("is off unless both settings are present", async () => {
    delete process.env.DEMO_ACCOUNTS_ENABLED;
    const status = await request(app).get("/api/admin/demo-accounts").set(asUser(admin));
    expect(status.body).toEqual({ enabled: false, accounts: [] });
    await request(app).post("/api/admin/demo-accounts").set(asUser(admin)).expect(404);

    process.env.DEMO_ACCOUNTS_ENABLED = "true";
    process.env.DEMO_ACCOUNTS_EMAIL = "not-an-email";
    await request(app).post("/api/admin/demo-accounts").set(asUser(admin)).expect(404);
  });

  it("is for super admins only", async () => {
    await request(app).post("/api/admin/demo-accounts").set(asUser(notAdmin)).expect(403);
    await request(app).post("/api/admin/demo-accounts").expect(401);
  });

  it("creates four accounts, each on the right tier, and re-running keeps their data", async () => {
    const res = await request(app).post("/api/admin/demo-accounts").set(asUser(admin)).expect(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    const byKey = Object.fromEntries(res.body.accounts.map((a: any) => [a.key, a]));
    expect(Object.keys(byKey).sort()).toEqual(["advisor", "free", "trackA", "trackB"]);
    for (const a of res.body.accounts) {
      expect(a.created).toBe(true);
      expect(a.password).toMatch(/.{16,}/);
      expect(a.email).toBe(`owner-${RUN}+tala-demo-${a.key.toLowerCase()}@example.com`);
    }

    const idOf = (key: string) => clerkUsers.get(byKey[key].email)!.id;
    const roles = await db.select({ id: profilesTable.id, role: profilesTable.role }).from(profilesTable)
      .where(inArray(profilesTable.id, ["advisor", "free", "trackB", "trackA"].map(idOf)));
    expect(Object.fromEntries(roles.map((r) => [r.id, r.role]))).toEqual({
      [idOf("advisor")]: "advisor", [idOf("free")]: "free_user", [idOf("trackB")]: "investment_client", [idOf("trackA")]: "investment_client",
    });

    const tiers: Record<string, string> = {};
    for (const key of ["free", "trackB", "trackA"]) {
      const ent = await request(app).get("/api/me/entitlements").set(asUser(idOf(key))).expect(200);
      tiers[key] = ent.body.tier;
    }
    expect(tiers).toEqual({ free: "free", trackB: "track_b", trackA: "track_a" });

    // The free user sits at the free goal cap, inside the holdings cap.
    const freeGoals = await db.select().from(financialGoalsTable).where(eq(financialGoalsTable.userId, idOf("free")));
    const freeHoldings = await db.select().from(clientHoldingsTable).where(eq(clientHoldingsTable.userId, idOf("free")));
    expect(freeGoals).toHaveLength(1);
    expect(freeHoldings.length).toBeLessThanOrEqual(5);

    for (const key of ["trackB", "trackA"]) {
      const [m] = await db.select().from(membershipsTable).where(eq(membershipsTable.userId, idOf(key)));
      expect(m).toMatchObject({ status: "active", source: "comped" });
      const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, idOf(key)));
      expect(cp.advisorId).toBe(idOf("advisor"));
    }
    const plans = await db.select().from(advisedPlansTable).where(eq(advisedPlansTable.userId, idOf("trackA")));
    expect(plans.map((p) => p.status)).toEqual(["inforce"]);

    const before = await db.select().from(clientBudgetMonthsTable).where(inArray(clientBudgetMonthsTable.userId, [idOf("free"), idOf("trackB"), idOf("trackA")]));
    const again = await request(app).post("/api/admin/demo-accounts").set(asUser(admin)).expect(200);
    for (const a of again.body.accounts) {
      expect(a.created).toBe(false);
      expect(a.password).not.toBe(byKey[a.key].password);
    }
    const after = await db.select().from(clientBudgetMonthsTable).where(inArray(clientBudgetMonthsTable.userId, [idOf("free"), idOf("trackB"), idOf("trackA")]));
    expect(after).toHaveLength(before.length);

    const status = await request(app).get("/api/admin/demo-accounts").set(asUser(admin)).expect(200);
    expect(status.body.accounts.every((a: any) => a.exists)).toBe(true);
    await cleanupDemoUsers();
  });

  it("falls back to email codes when the Clerk instance has passwords turned off", async () => {
    passwordsAllowed = false;
    const res = await request(app).post("/api/admin/demo-accounts").set(asUser(admin)).expect(200);
    expect(res.body.accounts.map((a: any) => a.password)).toEqual([null, null, null, null]);
    await cleanupDemoUsers();
  });
});
