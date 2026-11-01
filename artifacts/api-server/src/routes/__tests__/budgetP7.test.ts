import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db, profilesTable, clientProfilesTable, budgetEntriesTable, budgetTransactionsTable,
  clientBudgetMonthsTable, healthScoresTable,
} = await import("@workspace/db");
const { eq, and, inArray } = await import("drizzle-orm");
const { scoreEffectiveSavingsRate } = await import("../healthscore");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const freeBudgetUser = `p7-free-budget-${RUN_ID}`;
const migrationUser = `p7-migration-${RUN_ID}`;
const freeScoreUser = `p7-free-score-${RUN_ID}`;
const investmentBudgetUser = `p7-investment-budget-${RUN_ID}`;
const advisorA = `p7-advisor-a-${RUN_ID}`;
const advisorB = `p7-advisor-b-${RUN_ID}`;
const superAdmin = `p7-super-admin-${RUN_ID}`;
const advisorClient = `p7-advisor-client-${RUN_ID}`;
const userIds = [
  freeBudgetUser, migrationUser, freeScoreUser, investmentBudgetUser,
  advisorA, advisorB, superAdmin, advisorClient,
];
const allBudgetUserIds = [freeBudgetUser, migrationUser, freeScoreUser, investmentBudgetUser, advisorClient];

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

function runMigration(mode: "--dry-run" | "--apply", userId: string): string {
  const root = resolve(process.cwd(), "../..");
  return execFileSync("pnpm", [
    "--filter", "@workspace/scripts", "exec", "tsx", "src/migrate-free-budget-entries.ts",
    mode, `--user=${userId}`,
  ], { cwd: root, encoding: "utf8", env: process.env });
}

function reportFrom(output: string) {
  const line = output.split("\n").find((entry) => entry.includes("Free budget migration"));
  if (!line) throw new Error(`Migration report missing:\n${output}`);
  const json = line.match(/\{.*\}/)?.[0];
  if (!json) throw new Error(`Migration report JSON missing:\n${output}`);
  return JSON.parse(json);
}

beforeAll(async () => {
  await db.insert(profilesTable).values([
    { id: freeBudgetUser, email: `${freeBudgetUser}@test.local`, fullName: "Free Budget", role: "free_user" },
    { id: migrationUser, email: `${migrationUser}@test.local`, fullName: "Migration", role: "free_user" },
    { id: freeScoreUser, email: `${freeScoreUser}@test.local`, fullName: "Free Score", role: "free_user", totalSavings: "0", totalInvestments: "0", savingsRatePercent: "0", investmentRatePercent: "0" },
    { id: investmentBudgetUser, email: `${investmentBudgetUser}@test.local`, fullName: "Investment Budget", role: "investment_client" },
    { id: advisorA, email: `${advisorA}@test.local`, fullName: "Advisor A", role: "advisor" },
    { id: advisorB, email: `${advisorB}@test.local`, fullName: "Advisor B", role: "advisor" },
    { id: superAdmin, email: `${superAdmin}@test.local`, fullName: "Super Admin", role: "super_admin" },
    { id: advisorClient, email: `${advisorClient}@test.local`, fullName: "Advisor Client", role: "investment_client" },
  ]);
  await db.insert(clientProfilesTable).values({
    userId: advisorClient,
    advisorId: advisorA,
  });
});

afterAll(async () => {
  await db.delete(healthScoresTable).where(inArray(healthScoresTable.userId, userIds));
  await db.delete(clientBudgetMonthsTable).where(inArray(clientBudgetMonthsTable.userId, allBudgetUserIds));
  await db.delete(budgetEntriesTable).where(inArray(budgetEntriesTable.userId, allBudgetUserIds));
  await db.delete(budgetTransactionsTable).where(inArray(budgetTransactionsTable.userId, allBudgetUserIds));
  await db.delete(clientProfilesTable).where(inArray(clientProfilesTable.userId, userIds));
  await db.delete(profilesTable).where(inArray(profilesTable.id, userIds));
});

describe("Phase 7 budget storage", () => {
  it("keeps the free budget route shape while writing monthly data to the shared table", async () => {
    const body = {
      periodMonth: "2026-03",
      currency: "USD",
      income: "5000",
      housing: "1200",
      food: "600",
      transport: "200",
      utilities: "150",
      entertainment: "250",
      other: "100",
    };
    const created = await request(app).post("/api/budget").set(asUser(freeBudgetUser)).send(body).expect(201);
    expect(created.body.income).toBe("5000");
    expect(created.body.savingsActual).toBe("2500");

    const shared = await db.select().from(clientBudgetMonthsTable)
      .where(and(
        eq(clientBudgetMonthsTable.userId, freeBudgetUser),
        eq(clientBudgetMonthsTable.month, "2026-03-01"),
      ));
    expect(shared).toHaveLength(1);
    expect(shared[0].primaryIncome).toBe("5000");

    const updated = await request(app).put(`/api/budget/${created.body.id}`)
      .set(asUser(freeBudgetUser))
      .send({ ...body, income: "5200" })
      .expect(200);
    expect(updated.body.income).toBe("5200");

    const tx = await request(app).post("/api/budget/transactions")
      .set(asUser(freeBudgetUser))
      .send({
        periodMonth: "2026-03",
        description: "Coffee",
        amount: "4",
        type: "expense",
        category: "food",
        transactionDate: "2026-03-14",
      })
      .expect(201);
    const editedTx = await request(app).put(`/api/budget/transactions/${tx.body.id}`)
      .set(asUser(freeBudgetUser))
      .send({
        periodMonth: "2026-03",
        description: "Coffee and lunch",
        amount: "12",
        type: "expense",
        category: "food",
        transactionDate: "2026-03-14",
        isRecurring: false,
      })
      .expect(200);
    expect(editedTx.body.amount).toBe("12");
    const transactions = await db.select().from(budgetTransactionsTable)
      .where(eq(budgetTransactionsTable.userId, freeBudgetUser));
    expect(transactions).toHaveLength(1);
  });

  it("dry-runs, copies once, skips shared-month conflicts, and is idempotent", async () => {
    const source = {
      userId: migrationUser,
      currency: "USD",
      income: "6000",
      housing: "1000",
      food: "500",
      transport: "200",
      utilities: "100",
      entertainment: "200",
      other: "100",
      savingsActual: "3900",
      savingsRatePercent: "65.00",
    };
    await db.insert(budgetEntriesTable).values([
      { ...source, periodMonth: "2026-01-01" },
      { ...source, periodMonth: "2026-01-01" },
      { ...source, periodMonth: "2026-02-01", income: "9000" },
    ]);
    await db.insert(clientBudgetMonthsTable).values({
      userId: migrationUser,
      month: "2026-02-01",
      currency: "USD",
      primaryIncome: "777",
      totalIncome: "777",
    });

    const dryRun = reportFrom(runMigration("--dry-run", migrationUser));
    expect(dryRun).toMatchObject({
      sourceRows: 3,
      sourceMonthKeys: 2,
      sourceDuplicateGroups: 1,
      sourceDuplicateExcessRows: 1,
      ambiguousSourceGroups: 0,
      sharedMonthConflictKeys: 1,
      monthKeysToCopy: 1,
      mode: "dry-run",
    });
    expect(await db.select().from(clientBudgetMonthsTable)
      .where(eq(clientBudgetMonthsTable.userId, migrationUser))).toHaveLength(1);

    const firstApply = runMigration("--apply", migrationUser);
    expect(firstApply).toContain("Inserted 1 shared budget month rows");
    const afterFirstRun = await db.select().from(clientBudgetMonthsTable)
      .where(eq(clientBudgetMonthsTable.userId, migrationUser));
    expect(afterFirstRun).toHaveLength(2);
    expect(afterFirstRun.find(row => row.month === "2026-02-01")?.primaryIncome).toBe("777");
    expect(afterFirstRun.find(row => row.month === "2026-01-01")?.primaryIncome).toBe("6000");

    const secondApply = runMigration("--apply", migrationUser);
    expect(secondApply).toContain("Inserted 0 shared budget month rows");
    expect(await db.select().from(clientBudgetMonthsTable)
      .where(eq(clientBudgetMonthsTable.userId, migrationUser))).toHaveLength(2);
  }, 30000);

  it("preserves a free user's budget figures and budget-driven health score through migration", async () => {
    const legacy = {
      userId: freeScoreUser,
      periodMonth: "2026-04-01",
      currency: "USD",
      income: "10000",
      housing: "1000",
      food: "500",
      transport: "200",
      utilities: "100",
      entertainment: "100",
      other: "100",
      savingsActual: "8000",
      savingsRatePercent: "80.00",
    };
    await db.insert(budgetEntriesTable).values(legacy);
    const oldExpenses = [legacy.housing, legacy.food, legacy.transport, legacy.utilities, legacy.entertainment, legacy.other]
      .reduce((sum, value) => sum + Number(value), 0);
    const oldIncome = Number(legacy.income);
    const oldCashSaved = Math.max(0, oldIncome - oldExpenses);
    const oldEffectiveSavingsRate = oldCashSaved / oldIncome * 100;

    runMigration("--apply", freeScoreUser);

    const budgets = await request(app).get("/api/budget").set(asUser(freeScoreUser)).expect(200);
    const migrated = budgets.body.find((entry: any) => entry.periodMonth.startsWith("2026-04"));
    expect(migrated).toMatchObject({
      income: legacy.income,
      housing: legacy.housing,
      food: legacy.food,
      transport: legacy.transport,
      utilities: legacy.utilities,
      entertainment: legacy.entertainment,
      other: legacy.other,
      savingsActual: legacy.savingsActual,
      savingsRatePercent: legacy.savingsRatePercent,
    });

    const score = await request(app).post("/api/health-score").set(asUser(freeScoreUser)).expect(201);
    expect(score.body.insights.effectiveSavingsRate).toBe(oldEffectiveSavingsRate);
    expect(score.body.budgetScore).toBe(scoreEffectiveSavingsRate(oldEffectiveSavingsRate));
    expect(score.body.overallScore).toBe(score.body.budgetScore);
  }, 30000);

  it("saves quick and detailed investment budget views to one shared month", async () => {
    const quick = {
      month: "2026-05-01",
      currency: "USD",
      primaryIncome: "2000",
      housing: "1000",
      foodDining: "250",
      transport: "150",
      utilities: "100",
      entertainment: "200",
      otherExpenses: "300",
      investmentContributions: [],
    };
    await request(app).post("/api/client/budget").set(asUser(investmentBudgetUser)).send(quick).expect(200);
    await request(app).post("/api/client/budget").set(asUser(investmentBudgetUser)).send({
      ...quick,
      secondaryIncome: "0",
      rentalIncome: "0",
      otherIncome: "0",
      insurance: "100",
      shopping: "50",
      health: "25",
      education: "25",
    }).expect(200);

    const rows = await db.select().from(clientBudgetMonthsTable).where(eq(clientBudgetMonthsTable.userId, investmentBudgetUser));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      month: "2026-05-01",
      primaryIncome: "2000",
      housing: "1000",
      foodDining: "250",
      insurance: "100",
      shopping: "50",
      health: "25",
      education: "25",
    });
  });
});

describe("advisor-shared budget summary", () => {
  it("requires consent, returns only aggregate totals, and enforces current-advisor ownership", async () => {
    await db.insert(clientBudgetMonthsTable).values({
      userId: advisorClient,
      month: "2026-06-01",
      primaryIncome: "9000",
      housing: "1500",
      foodDining: "900",
      transport: "300",
      utilities: "200",
      entertainment: "300",
      otherExpenses: "300",
      totalIncome: "9000",
      totalExpenses: "3500",
      totalInvestments: "500",
      netSurplus: "5000",
      savingsRatePct: "55.56",
    });

    await request(app).get(`/api/advisor/clients/${advisorClient}/budget-summary`)
      .set(asUser(advisorA)).expect(403);

    await request(app).put("/api/client-profile/me").set(asUser(advisorClient))
      .send({ shareBudgetWithAdvisor: true }).expect(200);

    const response = await request(app).get(`/api/advisor/clients/${advisorClient}/budget-summary`)
      .set(asUser(advisorA)).expect(200);
    expect(response.body.shared).toBe(true);
    expect(response.body.months).toHaveLength(1);
    expect(Object.keys(response.body).sort()).toEqual(["months", "shared"]);
    expect(Object.keys(response.body.months[0]).sort()).toEqual([
      "income", "month", "savingsRatePct", "spending", "surplus",
    ]);
    expect(response.body.months[0]).toMatchObject({
      income: "9000",
      spending: "3500",
      surplus: "5000",
      savingsRatePct: "55.56",
    });

    await request(app).get(`/api/advisor/clients/${advisorClient}/budget-summary`)
      .set(asUser(advisorB)).expect(403);

    const adminResponse = await request(app).get(`/api/advisor/clients/${advisorClient}/budget-summary`)
      .set(asUser(superAdmin)).expect(200);
    expect(adminResponse.body.months).toHaveLength(1);
  });
});
