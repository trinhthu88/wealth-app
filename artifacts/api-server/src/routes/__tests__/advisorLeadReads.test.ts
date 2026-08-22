import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db, profilesTable, leadsTable, financialGoalsTable, assetsTable, liabilitiesTable, clientHoldingsTable,
} = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const advisorA = `advisor-a-test-${RUN_ID}`;
const advisorB = `advisor-b-test-${RUN_ID}`;
const superAdmin = `super-admin-test-${RUN_ID}`;
const leadUserId = `lead-user-test-${RUN_ID}`;

function asUser(id: string) {
  return { "x-test-user-id": id };
}

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: advisorA, email: `advisor-a-${RUN_ID}@test.local`, fullName: "Advisor A", role: "advisor" },
    { id: advisorB, email: `advisor-b-${RUN_ID}@test.local`, fullName: "Advisor B", role: "advisor" },
    { id: superAdmin, email: `super-${RUN_ID}@test.local`, fullName: "Super Admin", role: "super_admin" },
    { id: leadUserId, email: `lead-user-${RUN_ID}@test.local`, fullName: "Lead User", role: "free_user" },
  ]);
  await db.insert(leadsTable).values({
    email: `lead-user-${RUN_ID}@test.local`, userId: leadUserId, status: "active", assignedAdvisorId: advisorA,
  });
  await db.insert(financialGoalsTable).values({
    userId: leadUserId, title: "House deposit", goalType: "home_purchase",
  });
  await db.insert(assetsTable).values({
    userId: leadUserId, name: "Savings account", category: "cash", valueUsd: "5000",
  });
  await db.insert(liabilitiesTable).values({
    userId: leadUserId, name: "Car loan", category: "auto_loan", balanceUsd: "8000",
  });
  await db.insert(clientHoldingsTable).values({
    userId: leadUserId, holdingType: "stock_etf", label: "Vanguard S&P 500",
  });
});

afterAll(async () => {
  await db.delete(financialGoalsTable).where(eq(financialGoalsTable.userId, leadUserId));
  await db.delete(assetsTable).where(eq(assetsTable.userId, leadUserId));
  await db.delete(liabilitiesTable).where(eq(liabilitiesTable.userId, leadUserId));
  await db.delete(clientHoldingsTable).where(eq(clientHoldingsTable.userId, leadUserId));
  await db.delete(leadsTable).where(eq(leadsTable.userId, leadUserId));
  await db.delete(profilesTable).where(eq(profilesTable.id, leadUserId));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorA));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorB));
  await db.delete(profilesTable).where(eq(profilesTable.id, superAdmin));
});

describe("advisor read access to a lead's existing data", () => {
  const routes = [
    { path: "goals", check: (body: any) => expect(body[0].title).toBe("House deposit") },
    { path: "networth", check: (body: any) => { expect(body.assets[0].name).toBe("Savings account"); expect(body.liabilities[0].name).toBe("Car loan"); } },
    { path: "holdings", check: (body: any) => expect(body[0].label).toBe("Vanguard S&P 500") },
  ];

  for (const { path, check } of routes) {
    describe(`GET /advisor/leads/:id/${path}`, () => {
      it("401s an unauthenticated caller", async () => {
        await request(app).get(`/api/advisor/leads/${leadUserId}/${path}`).expect(401);
      });

      it("403s an advisor who isn't assigned to this lead", async () => {
        await request(app).get(`/api/advisor/leads/${leadUserId}/${path}`).set(asUser(advisorB)).expect(403);
      });

      it("allows the assigned advisor and returns the lead's real data", async () => {
        const res = await request(app).get(`/api/advisor/leads/${leadUserId}/${path}`).set(asUser(advisorA)).expect(200);
        check(res.body);
      });

      it("allows super_admin regardless of assignment", async () => {
        await request(app).get(`/api/advisor/leads/${leadUserId}/${path}`).set(asUser(superAdmin)).expect(200);
      });
    });
  }
});
