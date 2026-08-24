import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db, profilesTable, leadsTable, clientProfilesTable, advisedPlansTable,
  clientBudgetMonthsTable, clientHoldingsTable, clientHoldingTransactionsTable,
} = await import("@workspace/db");
const { eq, and } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const advisorA = `advisor-a-test-${RUN_ID}`;
const advisorB = `advisor-b-test-${RUN_ID}`;
const leadUserId = `lead-user-test-${RUN_ID}`;
const clientUserId = `client-user-test-${RUN_ID}`;

function asUser(id: string) {
  return { "x-test-user-id": id };
}

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: advisorA, email: `advisor-a-${RUN_ID}@test.local`, fullName: "Advisor A", role: "advisor" },
    { id: advisorB, email: `advisor-b-${RUN_ID}@test.local`, fullName: "Advisor B", role: "advisor" },
    { id: leadUserId, email: `lead-user-${RUN_ID}@test.local`, fullName: "Lead User", role: "free_user" },
    { id: clientUserId, email: `client-user-${RUN_ID}@test.local`, fullName: "Client User", role: "investment_client" },
  ]);
  await db.insert(leadsTable).values({
    email: `lead-user-${RUN_ID}@test.local`, userId: leadUserId, status: "active", assignedAdvisorId: advisorA,
  });
  await db.insert(clientProfilesTable).values({ userId: clientUserId, advisorId: advisorA });
});

afterAll(async () => {
  await db.delete(advisedPlansTable).where(eq(advisedPlansTable.userId, leadUserId));
  await db.delete(advisedPlansTable).where(eq(advisedPlansTable.userId, clientUserId));
  await db.delete(leadsTable).where(eq(leadsTable.userId, leadUserId));
  await db.delete(clientProfilesTable).where(eq(clientProfilesTable.userId, clientUserId));
  await db.delete(profilesTable).where(eq(profilesTable.id, leadUserId));
  await db.delete(profilesTable).where(eq(profilesTable.id, clientUserId));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorA));
  await db.delete(profilesTable).where(eq(profilesTable.id, advisorB));
});

describe("advised-plan routes serve a lead and a client identically", () => {
  for (const [label, userId] of [["lead", leadUserId], ["client", clientUserId]] as const) {
    it(`403s an advisor who doesn't own this ${label}`, async () => {
      await request(app)
        .post(`/api/advisor/clients/${userId}/advised-plans`)
        .set(asUser(advisorB))
        .send({ providerName: "Acme", productName: "Growth Plan" })
        .expect(403);
    });

    it(`lets the assigned advisor create a scenario plan for this ${label}`, async () => {
      const res = await request(app)
        .post(`/api/advisor/clients/${userId}/advised-plans`)
        .set(asUser(advisorA))
        .send({ providerName: "Acme", productName: "Growth Plan" })
        .expect(201);
      expect(res.body.status).toBe("scenario");
      expect(res.body.policyNumber).toBeNull();
    });

    it(`lists the ${label}'s plans for the assigned advisor`, async () => {
      const res = await request(app)
        .get(`/api/advisor/clients/${userId}/advised-plans`)
        .set(asUser(advisorA))
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });
  }
});

describe("PUT /advised-plans/:id/status", () => {
  let scenarioPlanId: string;

  beforeAll(async () => {
    const [plan] = await db.insert(advisedPlansTable).values({
      userId: leadUserId, advisorId: advisorA, providerName: "Acme", productName: "Retirement Plan", status: "scenario",
    }).returning();
    scenarioPlanId = plan.id;
  });

  it("blocks flipping to inforce with no policyNumber", async () => {
    const res = await request(app)
      .put(`/api/advised-plans/${scenarioPlanId}/status`)
      .set(asUser(advisorA))
      .send({ status: "inforce" })
      .expect(400);
    expect(res.body.error).toMatch(/policyNumber/);
  });

  it("404s an advisor who doesn't own the plan (enumeration-safe)", async () => {
    await request(app)
      .put(`/api/advised-plans/${scenarioPlanId}/status`)
      .set(asUser(advisorB))
      .send({ status: "inforce", policyNumber: "POL-123" })
      .expect(404);
  });

  it("allows flipping to inforce when policyNumber is supplied in the same request", async () => {
    const res = await request(app)
      .put(`/api/advised-plans/${scenarioPlanId}/status`)
      .set(asUser(advisorA))
      .send({ status: "inforce", policyNumber: "POL-123" })
      .expect(200);
    expect(res.body.status).toBe("inforce");
    expect(res.body.policyNumber).toBe("POL-123");
  });
});

describe("PUT /advised-plans/:id/contribution", () => {
  let planId: string;

  beforeAll(async () => {
    const [plan] = await db.insert(advisedPlansTable).values({
      userId: clientUserId, advisorId: advisorA, providerName: "Acme", productName: "RSP Plan",
      planType: "rsp", status: "inforce", annualPremium: "1200",
    }).returning();
    planId = plan.id;
  });

  afterAll(async () => {
    await db.delete(advisedPlansTable).where(eq(advisedPlansTable.id, planId));
  });

  it("404s an advisor who doesn't own the plan", async () => {
    await request(app)
      .put(`/api/advised-plans/${planId}/contribution`)
      .set(asUser(advisorB))
      .send({ annualPremium: 2400 })
      .expect(404);
  });

  it("updates annualPremium without touching status or policyNumber", async () => {
    const res = await request(app)
      .put(`/api/advised-plans/${planId}/contribution`)
      .set(asUser(advisorA))
      .send({ annualPremium: 2400 })
      .expect(200);
    expect(res.body.annualPremium).toBe("2400");
    expect(res.body.status).toBe("inforce");
    expect(res.body.policyNumber).toBeNull();
  });

  it("sync-contributions reflects the updated premium on its next live read", async () => {
    const res = await request(app)
      .post("/api/client/budget/sync-contributions")
      .set(asUser(clientUserId))
      .expect(200);
    const contribution = res.body.contributions.find((c: any) => c.source_id === planId);
    expect(contribution).toBeTruthy();
    expect(contribution.amount).toBe(200); // 2400 / 12
  });

  it("preserves a manual contribution already saved for the current month when sync-contributions runs again", async () => {
    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
    const [before] = await db.select().from(clientBudgetMonthsTable)
      .where(and(eq(clientBudgetMonthsTable.userId, clientUserId), eq(clientBudgetMonthsTable.month, currentMonth)));
    expect(before).toBeTruthy(); // created by the sync-contributions call in the previous test

    await db.update(clientBudgetMonthsTable)
      .set({
        investmentContributions: [
          ...(before!.investmentContributions as any[]),
          { label: "Brokerage top-up", amount: 50, source_id: "manual", source_type: "manual" },
        ],
      })
      .where(eq(clientBudgetMonthsTable.id, before!.id));

    await request(app)
      .post("/api/client/budget/sync-contributions")
      .set(asUser(clientUserId))
      .expect(200);

    const [after] = await db.select().from(clientBudgetMonthsTable)
      .where(and(eq(clientBudgetMonthsTable.userId, clientUserId), eq(clientBudgetMonthsTable.month, currentMonth)));
    const contribs = after!.investmentContributions as any[];

    const manualEntry = contribs.find(c => c.source_type === "manual");
    expect(manualEntry).toBeTruthy();
    expect(manualEntry.amount).toBe(50);

    const advisedEntry = contribs.find(c => c.source_id === planId);
    expect(advisedEntry).toBeTruthy();
    expect(advisedEntry.amount).toBe(200);
  });
});

describe("advised-plan activation backfills RSP contributions into budget history", () => {
  const budgetUserId = `budget-user-test-${RUN_ID}`;
  const now = new Date();

  function monthsAgoDate(n: number) {
    return new Date(now.getFullYear(), now.getMonth() - n, 1).toISOString().slice(0, 10);
  }
  function monthsAgoMonth(n: number) {
    return monthsAgoDate(n).slice(0, 7) + "-01";
  }

  beforeAll(async () => {
    await db.insert(profilesTable).values({
      id: budgetUserId, email: `budget-user-${RUN_ID}@test.local`, fullName: "Budget User", role: "investment_client",
    });
    await db.insert(clientProfilesTable).values({ userId: budgetUserId, advisorId: advisorA });
  });

  afterAll(async () => {
    await db.delete(clientHoldingTransactionsTable).where(eq(clientHoldingTransactionsTable.userId, budgetUserId));
    await db.delete(clientHoldingsTable).where(eq(clientHoldingsTable.userId, budgetUserId));
    await db.delete(clientBudgetMonthsTable).where(eq(clientBudgetMonthsTable.userId, budgetUserId));
    await db.delete(advisedPlansTable).where(eq(advisedPlansTable.userId, budgetUserId));
    await db.delete(clientProfilesTable).where(eq(clientProfilesTable.userId, budgetUserId));
    await db.delete(profilesTable).where(eq(profilesTable.id, budgetUserId));
  });

  it("backfills every month from effectiveDate to now, preserving existing income and non-advised_plan entries", async () => {
    const midMonth = monthsAgoMonth(2);
    await db.insert(clientBudgetMonthsTable).values({
      userId: budgetUserId, month: midMonth,
      primaryIncome: "5000", totalIncome: "5000", totalExpenses: "0",
      investmentContributions: [{ label: "Old manual", amount: 100, source_id: "manual", source_type: "manual" }],
      totalInvestments: "100", netSurplus: "4900", savingsRatePct: "98",
    });

    const [plan] = await db.insert(advisedPlansTable).values({
      userId: budgetUserId, advisorId: advisorA, providerName: "Acme", productName: "RSP Growth",
      planType: "rsp", status: "scenario", annualPremium: "1200", effectiveDate: monthsAgoDate(3),
    }).returning();

    await request(app)
      .put(`/api/advised-plans/${plan.id}/status`)
      .set(asUser(advisorA))
      .send({ status: "inforce", policyNumber: "POL-BF-1" })
      .expect(200);

    const rows = await db.select().from(clientBudgetMonthsTable)
      .where(eq(clientBudgetMonthsTable.userId, budgetUserId));
    const byMonth = Object.fromEntries(rows.map(r => [r.month, r]));

    for (const n of [3, 2, 1, 0]) {
      const row = byMonth[monthsAgoMonth(n)];
      expect(row, `expected a budget row for ${monthsAgoMonth(n)}`).toBeTruthy();
      const advised = (row!.investmentContributions as any[]).find(c => c.source_id === plan.id);
      expect(advised).toBeTruthy();
      expect(advised.amount).toBe(100); // 1200 / 12
    }

    const midRow = byMonth[midMonth]!;
    expect(parseFloat(midRow.totalIncome)).toBe(5000); // untouched by the backfill
    const manualEntry = (midRow.investmentContributions as any[]).find(c => c.source_type === "manual");
    expect(manualEntry).toBeTruthy();
    expect(manualEntry.amount).toBe(100); // survives the merge
  });

  it("propagates an annualPremium change while inforce into a previously backfilled month", async () => {
    const [plan] = await db.insert(advisedPlansTable).values({
      userId: budgetUserId, advisorId: advisorA, providerName: "Acme", productName: "RSP Top-up",
      planType: "rsp", status: "scenario", annualPremium: "600", effectiveDate: monthsAgoDate(1),
    }).returning();

    await request(app)
      .put(`/api/advised-plans/${plan.id}/status`)
      .set(asUser(advisorA))
      .send({ status: "inforce", policyNumber: "POL-BF-2" })
      .expect(200);

    await request(app)
      .put(`/api/advised-plans/${plan.id}/contribution`)
      .set(asUser(advisorA))
      .send({ annualPremium: 1200 })
      .expect(200);

    const pastMonth = monthsAgoMonth(1);
    const [row] = await db.select().from(clientBudgetMonthsTable)
      .where(and(eq(clientBudgetMonthsTable.userId, budgetUserId), eq(clientBudgetMonthsTable.month, pastMonth)));
    const entry = (row!.investmentContributions as any[]).find(c => c.source_id === plan.id);
    expect(entry).toBeTruthy();
    expect(entry.amount).toBe(100); // 1200 / 12 — the new rate, in a PAST month
  });

  it("never touches budget history for a plan edited while still in scenario status", async () => {
    const [plan] = await db.insert(advisedPlansTable).values({
      userId: budgetUserId, advisorId: advisorA, providerName: "Acme", productName: "RSP Draft",
      planType: "rsp", status: "scenario", annualPremium: "600", effectiveDate: monthsAgoDate(2),
    }).returning();

    await request(app)
      .put(`/api/advised-plans/${plan.id}/contribution`)
      .set(asUser(advisorA))
      .send({ annualPremium: 900 })
      .expect(200);

    const rows = await db.select().from(clientBudgetMonthsTable)
      .where(eq(clientBudgetMonthsTable.userId, budgetUserId));
    const touched = rows.some(r => (r.investmentContributions as any[]).some(c => c.source_id === plan.id));
    expect(touched).toBe(false);
  });
});
