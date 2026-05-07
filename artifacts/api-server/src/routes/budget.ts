import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, budgetEntriesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

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
  if (!periodMonth) {
    res.status(400).json({ error: "periodMonth required" });
    return;
  }
  const incomeNum = parseFloat(income ?? "0");
  const expenses = [housing, food, transport, utilities, entertainment, other]
    .map(v => parseFloat(v ?? "0")).reduce((a, b) => a + b, 0);
  const savings = incomeNum - expenses;
  const savingsRate = incomeNum > 0 ? (savings / incomeNum) * 100 : 0;
  const needs = parseFloat(housing ?? "0") + parseFloat(food ?? "0") + parseFloat(transport ?? "0") + parseFloat(utilities ?? "0");
  const wants = parseFloat(entertainment ?? "0") + parseFloat(other ?? "0");
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
  const incomeNum = parseFloat(income ?? "0");
  const expenses = [housing, food, transport, utilities, entertainment, other]
    .map(v => parseFloat(v ?? "0")).reduce((a, b) => a + b, 0);
  const savings = incomeNum - expenses;
  const savingsRate = incomeNum > 0 ? (savings / incomeNum) * 100 : 0;
  const needs = parseFloat(housing ?? "0") + parseFloat(food ?? "0") + parseFloat(transport ?? "0") + parseFloat(utilities ?? "0");
  const wants = parseFloat(entertainment ?? "0") + parseFloat(other ?? "0");
  const [updated] = await db.update(budgetEntriesTable).set({
    periodMonth, currency, income: income?.toString(), housing: housing?.toString(), food: food?.toString(),
    transport: transport?.toString(), utilities: utilities?.toString(), entertainment: entertainment?.toString(),
    other: other?.toString(), needsActual: needs.toString(), wantsActual: wants.toString(),
    savingsActual: savings.toString(), savingsRatePercent: savingsRate.toFixed(2), notes, updatedAt: new Date(),
  }).where(and(eq(budgetEntriesTable.id, rawId), eq(budgetEntriesTable.userId, userId))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
