import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Covers: holding-attributed budget contributions (self_holding) and
// unattributed-surplus auto-sweep, both writing into the new
// client_holding_transactions ledger and, for cash holdings, adjusting
// currentBalance — idempotently, so re-saving the same month never
// double-counts. Also covers the manual transaction CRUD routes directly.
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const {
  db, profilesTable, clientHoldingsTable, clientBudgetMonthsTable, clientHoldingTransactionsTable,
} = await import("@workspace/db");
const { eq, and } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userId = `holdings-budget-user-test-${RUN_ID}`;
const month = new Date().toISOString().slice(0, 7) + "-01";

function asUser(id: string) {
  return { "x-test-user-id": id };
}

async function ledgerRow(holdingId: string, source: string) {
  const [row] = await db.select().from(clientHoldingTransactionsTable)
    .where(and(
      eq(clientHoldingTransactionsTable.holdingId, holdingId),
      eq(clientHoldingTransactionsTable.sourceMonth, month),
      eq(clientHoldingTransactionsTable.source, source),
    ));
  return row;
}

beforeAll(async () => {
  await db.insert(profilesTable).values({
    id: userId, email: `holdings-budget-${RUN_ID}@test.local`, fullName: "Holdings Budget User", role: "investment_client",
  });
});

afterAll(async () => {
  await db.delete(clientHoldingTransactionsTable).where(eq(clientHoldingTransactionsTable.userId, userId));
  await db.delete(clientHoldingsTable).where(eq(clientHoldingsTable.userId, userId));
  await db.delete(clientBudgetMonthsTable).where(eq(clientBudgetMonthsTable.userId, userId));
  await db.delete(profilesTable).where(eq(profilesTable.id, userId));
});

describe("POST /client/budget attributes contributions to holdings and sweeps unattributed surplus", () => {
  let stockHoldingId: string;

  beforeAll(async () => {
    const [stock] = await db.insert(clientHoldingsTable).values({
      userId, holdingType: "stock_etf", label: "VTI", currency: "USD", isActive: true,
    }).returning();
    stockHoldingId = stock.id;
  });

  it("writes a budget_contribution ledger row for a self_holding entry (log-only for non-cash)", async () => {
    await request(app)
      .post("/api/client/budget")
      .set(asUser(userId))
      .send({
        month, primaryIncome: "5000",
        investmentContributions: [{ label: "VTI", amount: 300, source_id: stockHoldingId, source_type: "self_holding" }],
      })
      .expect(200);

    const row = await ledgerRow(stockHoldingId, "budget_contribution");
    expect(row).toBeTruthy();
    expect(parseFloat(row!.amount)).toBe(300);
  });

  it("creates a default cash holding and sweeps unattributed surplus into it", async () => {
    const res = await request(app)
      .post("/api/client/budget")
      .set(asUser(userId))
      .send({
        month, primaryIncome: "5000",
        investmentContributions: [{ label: "VTI", amount: 300, source_id: stockHoldingId, source_type: "self_holding" }],
      })
      .expect(200);
    expect(parseFloat(res.body.netSurplus)).toBe(4700); // 5000 - 300

    const [cash] = await db.select().from(clientHoldingsTable)
      .where(and(eq(clientHoldingsTable.userId, userId), eq(clientHoldingsTable.holdingType, "cash")));
    expect(cash).toBeTruthy();
    expect(cash.label).toBe("Surplus (auto)");
    expect(parseFloat(cash.currentBalance ?? "0")).toBe(4700);

    const sweepRow = await ledgerRow(cash.id, "surplus_sweep");
    expect(sweepRow).toBeTruthy();
    expect(parseFloat(sweepRow!.amount)).toBe(4700);
  });

  it("re-saving the same month with the same numbers does not double-credit the cash balance", async () => {
    await request(app)
      .post("/api/client/budget")
      .set(asUser(userId))
      .send({
        month, primaryIncome: "5000",
        investmentContributions: [{ label: "VTI", amount: 300, source_id: stockHoldingId, source_type: "self_holding" }],
      })
      .expect(200);

    const [cash] = await db.select().from(clientHoldingsTable)
      .where(and(eq(clientHoldingsTable.userId, userId), eq(clientHoldingsTable.holdingType, "cash")));
    expect(parseFloat(cash.currentBalance ?? "0")).toBe(4700); // unchanged, not 9400
  });

  it("lowering surplus on a re-save decreases the swept cash balance by the delta", async () => {
    await request(app)
      .post("/api/client/budget")
      .set(asUser(userId))
      .send({
        month, primaryIncome: "4000", // 700 less income => 700 less surplus
        investmentContributions: [{ label: "VTI", amount: 300, source_id: stockHoldingId, source_type: "self_holding" }],
      })
      .expect(200);

    const [cash] = await db.select().from(clientHoldingsTable)
      .where(and(eq(clientHoldingsTable.userId, userId), eq(clientHoldingsTable.holdingType, "cash")));
    expect(parseFloat(cash.currentBalance ?? "0")).toBe(3700); // 4000 income - 300 contribution
  });

  it("removing the self_holding contribution on a later save zeroes out its ledger row", async () => {
    await request(app)
      .post("/api/client/budget")
      .set(asUser(userId))
      .send({ month, primaryIncome: "4000", investmentContributions: [] })
      .expect(200);

    const row = await ledgerRow(stockHoldingId, "budget_contribution");
    expect(row).toBeFalsy();
  });
});

describe("Manual holding transactions", () => {
  let cashHoldingId: string;

  beforeAll(async () => {
    const [cash] = await db.insert(clientHoldingsTable).values({
      userId, holdingType: "cash", label: "Checking", currency: "USD", currentBalance: "1000", isActive: true,
    }).returning();
    cashHoldingId = cash.id;
  });

  it("a manual deposit bumps currentBalance and appears in the list", async () => {
    const res = await request(app)
      .post(`/api/client/holdings/${cashHoldingId}/transactions`)
      .set(asUser(userId))
      .send({ type: "in", amount: 250, description: "Bonus" })
      .expect(201);
    expect(res.body.source).toBe("manual");

    const [holding] = await db.select().from(clientHoldingsTable).where(eq(clientHoldingsTable.id, cashHoldingId));
    expect(parseFloat(holding.currentBalance ?? "0")).toBe(1250);

    const list = await request(app)
      .get(`/api/client/holdings/${cashHoldingId}/transactions`)
      .set(asUser(userId))
      .expect(200);
    expect(list.body.length).toBe(1);
    expect(list.body[0].description).toBe("Bonus");
  });

  it("deleting a manual transaction reverses its balance effect", async () => {
    const listRes = await request(app)
      .get(`/api/client/holdings/${cashHoldingId}/transactions`)
      .set(asUser(userId))
      .expect(200);
    const txId = listRes.body[0].id;

    await request(app)
      .delete(`/api/client/holdings/${cashHoldingId}/transactions/${txId}`)
      .set(asUser(userId))
      .expect(204);

    const [holding] = await db.select().from(clientHoldingsTable).where(eq(clientHoldingsTable.id, cashHoldingId));
    expect(parseFloat(holding.currentBalance ?? "0")).toBe(1000);
  });

  it("404s a transaction request for a holding the caller doesn't own", async () => {
    await request(app)
      .post(`/api/client/holdings/${cashHoldingId}/transactions`)
      .set(asUser("someone-else"))
      .send({ type: "in", amount: 10 })
      .expect(404);
  });
});
