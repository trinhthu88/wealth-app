import { and, asc, eq, sql } from "drizzle-orm";
import { db, clientHoldingsTable, clientHoldingTransactionsTable } from "@workspace/db";

// Structurally compatible with both `db` and a `db.transaction(async (tx) => ...)`
// callback's `tx` for the query-builder methods used here.
type Dbc = typeof db;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Inserts a ledger row and, for a cash holding, applies its balance effect
 * immediately (currentBalance +amount for "in", -amount for "out"). Used for
 * client-entered manual transactions — always creates a new row, never merges
 * with an existing one (unlike upsertMonthlyHoldingLedgerEntry below).
 */
export async function recordHoldingTransaction(dbc: Dbc, params: {
  holdingId: string;
  userId: string;
  type: "in" | "out";
  amount: number;
  source: "manual" | "budget_contribution" | "surplus_sweep";
  sourceMonth?: string | null;
  description?: string | null;
  transactionDate?: string;
}) {
  const [holding] = await dbc.select().from(clientHoldingsTable)
    .where(and(eq(clientHoldingsTable.id, params.holdingId), eq(clientHoldingsTable.userId, params.userId)));
  if (!holding) throw new Error("Holding not found");

  const [row] = await dbc.insert(clientHoldingTransactionsTable).values({
    holdingId: params.holdingId,
    userId: params.userId,
    type: params.type,
    amount: String(params.amount),
    source: params.source,
    sourceMonth: params.sourceMonth ?? null,
    description: params.description ?? null,
    transactionDate: params.transactionDate ?? todayStr(),
  }).returning();

  if (holding.holdingType === "cash") {
    const delta = params.type === "in" ? params.amount : -params.amount;
    await dbc.update(clientHoldingsTable)
      .set({ currentBalance: sql`${clientHoldingsTable.currentBalance} + ${delta}`, updatedAt: new Date() })
      .where(eq(clientHoldingsTable.id, params.holdingId));
  }

  return row;
}

/**
 * Idempotent upsert keyed on (holdingId, sourceMonth, source) — the caller
 * passes the ABSOLUTE amount that should exist for that key, not a delta, so
 * re-saving a budget month for the same values is a no-op and re-saving with
 * a changed amount adjusts the holding's cash balance by only the difference.
 * amount <= 0 removes the row entirely and reverses its prior balance effect.
 */
export async function upsertMonthlyHoldingLedgerEntry(dbc: Dbc, params: {
  holdingId: string;
  userId: string;
  source: "budget_contribution" | "surplus_sweep";
  sourceMonth: string;
  amount: number;
  description?: string | null;
}) {
  const [holding] = await dbc.select().from(clientHoldingsTable)
    .where(and(eq(clientHoldingsTable.id, params.holdingId), eq(clientHoldingsTable.userId, params.userId)));
  if (!holding) throw new Error("Holding not found");

  const [existing] = await dbc.select().from(clientHoldingTransactionsTable).where(and(
    eq(clientHoldingTransactionsTable.holdingId, params.holdingId),
    eq(clientHoldingTransactionsTable.sourceMonth, params.sourceMonth),
    eq(clientHoldingTransactionsTable.source, params.source),
  ));
  const oldAmount = existing ? parseFloat(existing.amount) : 0;

  if (params.amount <= 0) {
    if (existing) {
      await dbc.delete(clientHoldingTransactionsTable).where(eq(clientHoldingTransactionsTable.id, existing.id));
      if (holding.holdingType === "cash" && oldAmount !== 0) {
        await dbc.update(clientHoldingsTable)
          .set({ currentBalance: sql`${clientHoldingsTable.currentBalance} - ${oldAmount}`, updatedAt: new Date() })
          .where(eq(clientHoldingsTable.id, params.holdingId));
      }
    }
    return null;
  }

  const delta = params.amount - oldAmount;
  let row;
  if (existing) {
    [row] = await dbc.update(clientHoldingTransactionsTable)
      .set({ amount: String(params.amount), description: params.description ?? existing.description })
      .where(eq(clientHoldingTransactionsTable.id, existing.id))
      .returning();
  } else {
    [row] = await dbc.insert(clientHoldingTransactionsTable).values({
      holdingId: params.holdingId,
      userId: params.userId,
      type: "in",
      amount: String(params.amount),
      source: params.source,
      sourceMonth: params.sourceMonth,
      description: params.description ?? null,
      transactionDate: params.sourceMonth,
    }).returning();
  }

  if (holding.holdingType === "cash" && delta !== 0) {
    await dbc.update(clientHoldingsTable)
      .set({ currentBalance: sql`${clientHoldingsTable.currentBalance} + ${delta}`, updatedAt: new Date() })
      .where(eq(clientHoldingsTable.id, params.holdingId));
  }

  return row;
}

/**
 * The cash holding unattributed surplus (and, transitively, any other
 * auto-sweep) should land in: the oldest active cash holding, or a freshly
 * created "Surplus (auto)" one if the client has none yet.
 */
export async function getOrCreateDefaultCashHolding(dbc: Dbc, userId: string) {
  const [existing] = await dbc.select().from(clientHoldingsTable)
    .where(and(
      eq(clientHoldingsTable.userId, userId),
      eq(clientHoldingsTable.holdingType, "cash"),
      eq(clientHoldingsTable.isActive, true),
    ))
    .orderBy(asc(clientHoldingsTable.createdAt))
    .limit(1);
  if (existing) return existing;

  const [created] = await dbc.insert(clientHoldingsTable).values({
    userId,
    holdingType: "cash",
    label: "Surplus (auto)",
    currency: "USD",
    currentBalance: "0",
    isActive: true,
  }).returning();
  return created;
}
