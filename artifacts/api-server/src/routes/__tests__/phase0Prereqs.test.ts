import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

type ClerkAccount = { email: string; status?: string } | "none" | "error";
const clerkAccounts = new Map<string, ClerkAccount>();

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
  clerkClient: {
    users: {
      getUser: async (userId: string) => {
        const account = clerkAccounts.get(userId);
        if (!account || account === "error") throw new Error("Clerk unavailable");
        if (account === "none") return { primaryEmailAddressId: null, emailAddresses: [] };
        return {
          primaryEmailAddressId: "primary",
          emailAddresses: [
            { id: "secondary", emailAddress: `other-${account.email}`, verification: { status: "verified" } },
            { id: "primary", emailAddress: account.email, verification: { status: account.status ?? "verified" } },
          ],
        };
      },
    },
  },
}));

const { default: app } = await import("../../app");
const { db, profilesTable, clientProfilesTable, budgetTransactionsTable } = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const id = (name: string) => `p0-${name}-${RUN_ID}`;
const ADMIN_EMAIL = `admin-${RUN_ID}@test.local`;
const created: string[] = [];
const originalSuperAdminEmail = process.env.SUPER_ADMIN_EMAIL;

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

function newUser(name: string, account: ClerkAccount = { email: `${id(name)}@test.local` }) {
  const userId = id(name);
  created.push(userId);
  clerkAccounts.set(userId, account);
  return userId;
}

async function roleOf(userId: string) {
  const [row] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
  return row?.role;
}

beforeAll(() => {
  process.env.SUPER_ADMIN_EMAIL = ADMIN_EMAIL;
});

afterEach(() => {
  process.env.SUPER_ADMIN_EMAIL = ADMIN_EMAIL;
});

afterAll(async () => {
  if (originalSuperAdminEmail === undefined) delete process.env.SUPER_ADMIN_EMAIL;
  else process.env.SUPER_ADMIN_EMAIL = originalSuperAdminEmail;
  await db.delete(budgetTransactionsTable).where(inArray(budgetTransactionsTable.userId, created));
  await db.delete(clientProfilesTable).where(inArray(clientProfilesTable.userId, created));
  await db.delete(profilesTable).where(inArray(profilesTable.id, created));
});

describe("POST /profiles/me/upsert takes identity from Clerk (F-1)", () => {
  it("does not grant super_admin to a new user whose body email matches the env var", async () => {
    const userId = newUser("attacker-new");
    const res = await request(app).post("/api/profiles/me/upsert").set(asUser(userId))
      .send({ email: ADMIN_EMAIL }).expect(200);
    expect(res.body.role).toBe("free_user");
    expect(res.body.email).toBe(`${userId}@test.local`);
    expect(await roleOf(userId)).toBe("free_user");
  });

  it("does not grant super_admin to an existing user whose body email matches the env var", async () => {
    const userId = newUser("attacker-existing");
    await db.insert(profilesTable).values({ id: userId, email: `${userId}@test.local`, role: "free_user" });
    const res = await request(app).post("/api/profiles/me/upsert").set(asUser(userId))
      .send({ email: ADMIN_EMAIL.toUpperCase() }).expect(200);
    expect(res.body.role).toBe("free_user");
    expect(res.body.email).toBe(`${userId}@test.local`);
  });

  it("grants super_admin when the verified Clerk primary email matches, with no body email", async () => {
    const userId = newUser("real-admin", { email: ADMIN_EMAIL.toUpperCase() });
    const res = await request(app).post("/api/profiles/me/upsert").set(asUser(userId))
      .send({ fullName: "Real Admin" }).expect(200);
    expect(res.body.role).toBe("super_admin");
    expect(res.body.fullName).toBe("Real Admin");
  });

  it("promotes an existing profile when the verified Clerk primary email matches", async () => {
    const userId = newUser("real-admin-existing", { email: ADMIN_EMAIL });
    await db.insert(profilesTable).values({ id: userId, email: `old-${userId}@test.local`, role: "free_user" });
    const res = await request(app).post("/api/profiles/me/upsert").set(asUser(userId)).send({}).expect(200);
    expect(res.body.role).toBe("super_admin");
    expect(res.body.email).toBe(ADMIN_EMAIL);
  });

  it("does not grant super_admin when the matching Clerk address is unverified", async () => {
    const userId = newUser("unverified", { email: ADMIN_EMAIL, status: "unverified" });
    const res = await request(app).post("/api/profiles/me/upsert").set(asUser(userId)).send({}).expect(200);
    expect(res.body.role).toBe("free_user");
  });

  it("ignores a secondary Clerk address that matches", async () => {
    const userId = newUser("secondary", { email: `x${ADMIN_EMAIL}` });
    process.env.SUPER_ADMIN_EMAIL = `other-x${ADMIN_EMAIL}`;
    const res = await request(app).post("/api/profiles/me/upsert").set(asUser(userId)).send({}).expect(200);
    expect(res.body.role).toBe("free_user");
  });

  it("does not grant super_admin when the env var is unset", async () => {
    delete process.env.SUPER_ADMIN_EMAIL;
    const userId = newUser("no-env", { email: ADMIN_EMAIL });
    const res = await request(app).post("/api/profiles/me/upsert").set(asUser(userId)).send({}).expect(200);
    expect(res.body.role).toBe("free_user");
  });

  it("answers 400 and writes nothing when the Clerk account has no primary email", async () => {
    const userId = newUser("no-email", "none");
    await request(app).post("/api/profiles/me/upsert").set(asUser(userId))
      .send({ email: ADMIN_EMAIL }).expect(400);
    expect(await roleOf(userId)).toBeUndefined();
  });

  it("answers 502 and writes nothing when Clerk cannot be reached", async () => {
    const userId = newUser("clerk-down", "error");
    await request(app).post("/api/profiles/me/upsert").set(asUser(userId))
      .send({ email: ADMIN_EMAIL }).expect(502);
    expect(await roleOf(userId)).toBeUndefined();
  });
});

describe("GET /client-profile/me never creates a row (F-5)", () => {
  it("answers 404 and inserts nothing when no row exists", async () => {
    const userId = newUser("no-client-profile");
    await db.insert(profilesTable).values({ id: userId, email: `${userId}@test.local`, role: "free_user" });
    await request(app).get("/api/client-profile/me").set(asUser(userId)).expect(404);
    const rows = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
    expect(rows).toHaveLength(0);
  });

  it("returns the row when one exists", async () => {
    const userId = newUser("has-client-profile");
    await db.insert(profilesTable).values({ id: userId, email: `${userId}@test.local`, role: "investment_client" });
    await db.insert(clientProfilesTable).values({ userId });
    const res = await request(app).get("/api/client-profile/me").set(asUser(userId)).expect(200);
    expect(res.body.userId).toBe(userId);
  });
});

describe("PUT /budget/transactions/:id (F-19)", () => {
  const validBody = {
    periodMonth: "2026-03",
    description: "Lunch",
    amount: "12.50",
    type: "expense",
    category: "food",
    transactionDate: "2026-03-14",
    isRecurring: true,
  };

  async function makeTransaction(userId: string) {
    const [tx] = await db.insert(budgetTransactionsTable).values({
      userId, periodMonth: "2026-03", description: "Coffee", amount: "4", transactionDate: "2026-03-14",
    }).returning();
    return tx;
  }

  it("updates the caller's own transaction and accepts a numeric amount", async () => {
    const userId = newUser("tx-owner");
    const tx = await makeTransaction(userId);
    const res = await request(app).put(`/api/budget/transactions/${tx.id}`).set(asUser(userId))
      .send({ ...validBody, amount: 12.5 }).expect(200);
    expect(res.body).toMatchObject({ description: "Lunch", category: "food", isRecurring: true, userId });
    expect(Number(res.body.amount)).toBe(12.5);
  });

  it("does not let the body reassign the owner", async () => {
    const userId = newUser("tx-owner-mass");
    const victim = newUser("tx-mass-target");
    const tx = await makeTransaction(userId);
    const res = await request(app).put(`/api/budget/transactions/${tx.id}`).set(asUser(userId))
      .send({ ...validBody, userId: victim }).expect(200);
    expect(res.body.userId).toBe(userId);
  });

  it("answers 404 and changes nothing for another user's transaction", async () => {
    const owner = newUser("tx-victim");
    const other = newUser("tx-other");
    const tx = await makeTransaction(owner);
    await request(app).put(`/api/budget/transactions/${tx.id}`).set(asUser(other)).send(validBody).expect(404);
    const [row] = await db.select().from(budgetTransactionsTable).where(eq(budgetTransactionsTable.id, tx.id));
    expect(row.description).toBe("Coffee");
  });

  it("answers 404 for a malformed id", async () => {
    const userId = newUser("tx-bad-id");
    await request(app).put("/api/budget/transactions/not-a-uuid").set(asUser(userId)).send(validBody).expect(404);
  });

  it.each([
    ["missing description", { description: undefined }],
    ["blank description", { description: "   " }],
    ["non-numeric amount", { amount: "abc" }],
    ["zero amount", { amount: 0 }],
    ["negative amount", { amount: "-5" }],
    ["unknown type", { type: "transfer" }],
    ["malformed month", { periodMonth: "2026-13" }],
    ["malformed date", { transactionDate: "14/03/2026" }],
    ["non-boolean isRecurring", { isRecurring: "yes" }],
  ])("answers 400 and changes nothing for %s", async (_label, override) => {
    const userId = newUser(`tx-invalid-${_label.replace(/\W+/g, "-")}`);
    const tx = await makeTransaction(userId);
    await request(app).put(`/api/budget/transactions/${tx.id}`).set(asUser(userId))
      .send({ ...validBody, ...override }).expect(400);
    const [row] = await db.select().from(budgetTransactionsTable).where(eq(budgetTransactionsTable.id, tx.id));
    expect(row.description).toBe("Coffee");
  });
});
