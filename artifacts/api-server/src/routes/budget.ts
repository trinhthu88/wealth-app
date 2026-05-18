import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, budgetEntriesTable, budgetTransactionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function calcBudgetFields(income: string | undefined, housing: string | undefined, food: string | undefined, transport: string | undefined, utilities: string | undefined, entertainment: string | undefined, other: string | undefined) {
  const incomeNum = parseFloat(income ?? "0");
  const expenses = [housing, food, transport, utilities, entertainment, other]
    .map(v => parseFloat(v ?? "0")).reduce((a, b) => a + b, 0);
  const savings = incomeNum - expenses;
  const savingsRate = incomeNum > 0 ? (savings / incomeNum) * 100 : 0;
  const needs = parseFloat(housing ?? "0") + parseFloat(food ?? "0") + parseFloat(transport ?? "0") + parseFloat(utilities ?? "0");
  const wants = parseFloat(entertainment ?? "0") + parseFloat(other ?? "0");
  return { savings, savingsRate, needs, wants };
}

// ── Budget entries ───────────────────────────────────────────────────────────

router.get("/budget", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const entries = await db.select().from(budgetEntriesTable)
    .where(eq(budgetEntriesTable.userId, userId))
    .orderBy(budgetEntriesTable.periodMonth);
  res.json(entries);
});

router.post("/budget", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { periodMonth, currency, income, housing, food, transport, utilities, entertainment, other, notes } = req.body;
  if (!periodMonth) { res.status(400).json({ error: "periodMonth required" }); return; }
  const { savings, savingsRate, needs, wants } = calcBudgetFields(income, housing, food, transport, utilities, entertainment, other);
  const [entry] = await db.insert(budgetEntriesTable).values({
    userId, periodMonth, currency: currency ?? "USD",
    income: income?.toString(), housing: housing?.toString(), food: food?.toString(),
    transport: transport?.toString(), utilities: utilities?.toString(),
    entertainment: entertainment?.toString(), other: other?.toString(),
    needsActual: needs.toString(), wantsActual: wants.toString(),
    savingsActual: savings.toString(), savingsRatePercent: savingsRate.toFixed(2), notes,
  }).returning();
  res.status(201).json(entry);
});

router.put("/budget/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { periodMonth, currency, income, housing, food, transport, utilities, entertainment, other, notes } = req.body;
  const { savings, savingsRate, needs, wants } = calcBudgetFields(income, housing, food, transport, utilities, entertainment, other);
  const [updated] = await db.update(budgetEntriesTable).set({
    periodMonth, currency, income: income?.toString(), housing: housing?.toString(), food: food?.toString(),
    transport: transport?.toString(), utilities: utilities?.toString(), entertainment: entertainment?.toString(),
    other: other?.toString(), needsActual: needs.toString(), wantsActual: wants.toString(),
    savingsActual: savings.toString(), savingsRatePercent: savingsRate.toFixed(2), notes, updatedAt: new Date(),
  }).where(and(eq(budgetEntriesTable.id, rawId), eq(budgetEntriesTable.userId, userId))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ── Budget transactions ──────────────────────────────────────────────────────

router.get("/budget/transactions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const month = req.query.month as string | undefined;
  let query = db.select().from(budgetTransactionsTable)
    .where(eq(budgetTransactionsTable.userId, userId))
    .$dynamic();
  if (month) {
    query = query.where(and(
      eq(budgetTransactionsTable.userId, userId),
      eq(budgetTransactionsTable.periodMonth, month),
    ));
  }
  const rows = await query.orderBy(desc(budgetTransactionsTable.transactionDate));
  res.json(rows);
});

router.post("/budget/transactions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { periodMonth, description, amount, type, category, transactionDate, isRecurring } = req.body;
  if (!periodMonth || !description || !amount || !transactionDate) {
    res.status(400).json({ error: "periodMonth, description, amount, transactionDate required" });
    return;
  }
  const [tx] = await db.insert(budgetTransactionsTable).values({
    userId, periodMonth, description,
    amount: String(amount), type: type ?? "expense",
    category: category ?? "other",
    transactionDate,
    isRecurring: isRecurring ?? false,
  }).returning();
  res.status(201).json(tx);
});

router.delete("/budget/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(budgetTransactionsTable)
    .where(and(eq(budgetTransactionsTable.id, rawId), eq(budgetTransactionsTable.userId, userId)));
  res.sendStatus(204);
});

// Copy recurring transactions from previous month into the given month
router.post("/budget/transactions/carry-forward", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { targetMonth } = req.body;
  if (!targetMonth) { res.status(400).json({ error: "targetMonth required" }); return; }

  // Derive previous month string
  const [y, m] = targetMonth.split("-").map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const recurring = await db.select().from(budgetTransactionsTable)
    .where(and(
      eq(budgetTransactionsTable.userId, userId),
      eq(budgetTransactionsTable.periodMonth, prevMonth),
      eq(budgetTransactionsTable.isRecurring, true),
    ));

  if (recurring.length === 0) { res.json({ copied: 0 }); return; }

  // Set transactionDate to 1st of targetMonth for all carried-forward items
  const targetDate = `${targetMonth}-01`;
  const inserted = await db.insert(budgetTransactionsTable)
    .values(recurring.map(r => ({
      userId,
      periodMonth: targetMonth,
      description: r.description,
      amount: r.amount,
      type: r.type,
      category: r.category,
      transactionDate: targetDate,
      isRecurring: true,
    }))).returning();

  res.json({ copied: inserted.length, transactions: inserted });
});

// Check if a month has recurring items from the previous month not yet carried forward
router.get("/budget/transactions/carry-forward-pending", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { month } = req.query as { month: string };
  if (!month) { res.status(400).json({ error: "month required" }); return; }

  const [y, m] = month.split("-").map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const [existingThisMonth, recurringPrev] = await Promise.all([
    db.select().from(budgetTransactionsTable)
      .where(and(eq(budgetTransactionsTable.userId, userId), eq(budgetTransactionsTable.periodMonth, month))),
    db.select().from(budgetTransactionsTable)
      .where(and(
        eq(budgetTransactionsTable.userId, userId),
        eq(budgetTransactionsTable.periodMonth, prevMonth),
        eq(budgetTransactionsTable.isRecurring, true),
      )),
  ]);

  const pending = existingThisMonth.length === 0 && recurringPrev.length > 0;
  res.json({ pending, count: recurringPrev.length, prevMonth, recurringItems: recurringPrev });
});

export default router;
