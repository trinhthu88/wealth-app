import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, budgetTransactionsTable, clientBudgetMonthsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

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

function normalizeMonth(value: unknown): string | null {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(String(value ?? ""));
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

type SharedBudgetMonth = typeof clientBudgetMonthsTable.$inferSelect;

function toLegacyEntry(row: SharedBudgetMonth) {
  const income = row.primaryIncome ?? "0";
  const housing = row.housing ?? "0";
  const food = row.foodDining ?? "0";
  const transport = row.transport ?? "0";
  const utilities = row.utilities ?? "0";
  const entertainment = row.entertainment ?? "0";
  const other = row.otherExpenses ?? "0";
  const { needs, wants } = calcBudgetFields(
    income, housing, food, transport, utilities, entertainment, other,
  );
  return {
    id: row.id,
    userId: row.userId,
    periodMonth: row.month,
    currency: row.currency,
    income,
    housing,
    food,
    transport,
    utilities,
    entertainment,
    other,
    needsActual: String(needs),
    wantsActual: String(wants),
    savingsActual: row.netSurplus,
    savingsRatePercent: (parseFloat(row.savingsRatePct ?? "0") || 0).toFixed(2),
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Budget entries ───────────────────────────────────────────────────────────

router.get("/budget", requireAuth, requireRole("free_user"), async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const entries = await db.select().from(clientBudgetMonthsTable)
    .where(eq(clientBudgetMonthsTable.userId, userId))
    .orderBy(clientBudgetMonthsTable.month);
  res.json(entries.map(toLegacyEntry));
});

router.post("/budget", requireAuth, requireRole("free_user"), async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { periodMonth, currency, income, housing, food, transport, utilities, entertainment, other, notes } = req.body;
  const month = normalizeMonth(periodMonth);
  if (!month) { res.status(400).json({ error: "periodMonth must be a valid YYYY-MM or YYYY-MM-DD month" }); return; }
  const { savings, savingsRate } = calcBudgetFields(income, housing, food, transport, utilities, entertainment, other);
  const incomeValue = income?.toString() ?? "0";
  const housingValue = housing?.toString() ?? "0";
  const foodValue = food?.toString() ?? "0";
  const transportValue = transport?.toString() ?? "0";
  const utilitiesValue = utilities?.toString() ?? "0";
  const entertainmentValue = entertainment?.toString() ?? "0";
  const otherValue = other?.toString() ?? "0";
  const expenses = [housingValue, foodValue, transportValue, utilitiesValue, entertainmentValue, otherValue]
    .reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
  const [entry] = await db.insert(clientBudgetMonthsTable).values({
    userId,
    month,
    currency: currency ?? "USD",
    primaryIncome: incomeValue,
    secondaryIncome: "0",
    rentalIncome: "0",
    otherIncome: "0",
    housing: housingValue,
    utilities: utilitiesValue,
    transport: transportValue,
    insurance: "0",
    foodDining: foodValue,
    entertainment: entertainmentValue,
    shopping: "0",
    health: "0",
    education: "0",
    otherExpenses: otherValue,
    debtPayments: "0",
    investmentContributions: [],
    totalIncome: incomeValue,
    totalExpenses: String(expenses),
    totalInvestments: "0",
    netSurplus: String(savings),
    savingsRatePct: String(savingsRate),
    notes: notes ?? null,
  }).onConflictDoUpdate({
    target: [clientBudgetMonthsTable.userId, clientBudgetMonthsTable.month],
    set: {
      currency: currency ?? "USD",
      primaryIncome: incomeValue,
      secondaryIncome: "0",
      rentalIncome: "0",
      otherIncome: "0",
      housing: housingValue,
      utilities: utilitiesValue,
      transport: transportValue,
      insurance: "0",
      foodDining: foodValue,
      entertainment: entertainmentValue,
      shopping: "0",
      health: "0",
      education: "0",
      otherExpenses: otherValue,
      debtPayments: "0",
      investmentContributions: [],
      totalIncome: incomeValue,
      totalExpenses: String(expenses),
      totalInvestments: "0",
      netSurplus: String(savings),
      savingsRatePct: String(savingsRate),
      notes: notes ?? null,
      updatedAt: new Date(),
    },
  }).returning();
  res.status(201).json(toLegacyEntry(entry));
});

router.put("/budget/:id", requireAuth, requireRole("free_user"), async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { periodMonth, currency, income, housing, food, transport, utilities, entertainment, other, notes } = req.body;
  const month = normalizeMonth(periodMonth);
  if (!month) { res.status(400).json({ error: "periodMonth must be a valid YYYY-MM or YYYY-MM-DD month" }); return; }
  const { savings, savingsRate } = calcBudgetFields(income, housing, food, transport, utilities, entertainment, other);
  const incomeValue = income?.toString() ?? "0";
  const housingValue = housing?.toString() ?? "0";
  const foodValue = food?.toString() ?? "0";
  const transportValue = transport?.toString() ?? "0";
  const utilitiesValue = utilities?.toString() ?? "0";
  const entertainmentValue = entertainment?.toString() ?? "0";
  const otherValue = other?.toString() ?? "0";
  const expenses = [housingValue, foodValue, transportValue, utilitiesValue, entertainmentValue, otherValue]
    .reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
  const [updated] = await db.update(clientBudgetMonthsTable).set({
    month,
    currency: currency ?? "USD",
    primaryIncome: incomeValue,
    secondaryIncome: "0",
    rentalIncome: "0",
    otherIncome: "0",
    housing: housingValue,
    utilities: utilitiesValue,
    transport: transportValue,
    insurance: "0",
    foodDining: foodValue,
    entertainment: entertainmentValue,
    shopping: "0",
    health: "0",
    education: "0",
    otherExpenses: otherValue,
    debtPayments: "0",
    investmentContributions: [],
    totalIncome: incomeValue,
    totalExpenses: String(expenses),
    totalInvestments: "0",
    netSurplus: String(savings),
    savingsRatePct: String(savingsRate),
    notes: notes ?? null,
    updatedAt: new Date(),
  }).where(and(eq(clientBudgetMonthsTable.id, rawId), eq(clientBudgetMonthsTable.userId, userId))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toLegacyEntry(updated));
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

router.put("/budget/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { periodMonth, description, amount, type, category, transactionDate, isRecurring } = req.body;
  if (!periodMonth || !description || amount == null || !transactionDate) {
    res.status(400).json({ error: "periodMonth, description, amount, transactionDate required" });
    return;
  }
  const [tx] = await db.update(budgetTransactionsTable).set({
    periodMonth,
    description,
    amount: String(amount),
    type: type ?? "expense",
    category: category ?? "other",
    transactionDate,
    isRecurring: isRecurring ?? false,
  }).where(and(
    eq(budgetTransactionsTable.id, rawId),
    eq(budgetTransactionsTable.userId, userId),
  )).returning();
  if (!tx) { res.status(404).json({ error: "Not found" }); return; }
  res.json(tx);
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
