import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, assetsTable, liabilitiesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/assets", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  res.json(await db.select().from(assetsTable).where(eq(assetsTable.userId, userId)));
});

router.post("/assets", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { name, category, valueUsd, currencyOriginal, valueOriginal, notes } = req.body;
  if (!name || !category || !valueUsd) { res.status(400).json({ error: "Missing required fields" }); return; }
  const [a] = await db.insert(assetsTable).values({
    userId, name, category, valueUsd: valueUsd.toString(),
    currencyOriginal: currencyOriginal ?? "USD", valueOriginal: valueOriginal?.toString() ?? null, notes,
  }).returning();
  res.status(201).json(a);
});

router.put("/assets/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, category, valueUsd, currencyOriginal, valueOriginal, notes } = req.body;
  const [updated] = await db.update(assetsTable).set({
    name, category, valueUsd: valueUsd?.toString(), currencyOriginal, valueOriginal: valueOriginal?.toString() ?? null, notes, updatedAt: new Date(),
  }).where(and(eq(assetsTable.id, rawId), eq(assetsTable.userId, userId))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/assets/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(assetsTable).where(and(eq(assetsTable.id, rawId), eq(assetsTable.userId, userId)));
  res.sendStatus(204);
});

// Upsert asset by name: deletes all existing rows with same name, then inserts fresh.
// This prevents duplicate rows from repeated pathway runs.
router.post("/assets/upsert-by-name", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { name, category, valueUsd, currencyOriginal } = req.body;
  if (!name || !category || !valueUsd) { res.status(400).json({ error: "Missing required fields" }); return; }
  // Remove all existing entries with this name for this user
  await db.delete(assetsTable).where(and(eq(assetsTable.userId, userId), eq(assetsTable.name, name)));
  const [a] = await db.insert(assetsTable).values({
    userId, name, category, valueUsd: valueUsd.toString(),
    currencyOriginal: currencyOriginal ?? "USD",
  }).returning();
  res.status(201).json(a);
});

router.get("/liabilities", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  res.json(await db.select().from(liabilitiesTable).where(eq(liabilitiesTable.userId, userId)));
});

router.post("/liabilities", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { name, category, balanceUsd, interestRatePercent, monthlyPaymentUsd, currencyOriginal, balanceOriginal } = req.body;
  if (!name || !category || !balanceUsd) { res.status(400).json({ error: "Missing required fields" }); return; }
  const [l] = await db.insert(liabilitiesTable).values({
    userId, name, category, balanceUsd: balanceUsd.toString(),
    interestRatePercent: interestRatePercent?.toString() ?? null,
    monthlyPaymentUsd: monthlyPaymentUsd?.toString() ?? null,
    currencyOriginal: currencyOriginal ?? "USD",
    balanceOriginal: balanceOriginal?.toString() ?? null,
  }).returning();
  res.status(201).json(l);
});

router.put("/liabilities/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, category, balanceUsd, interestRatePercent, monthlyPaymentUsd, currencyOriginal, balanceOriginal } = req.body;
  const [updated] = await db.update(liabilitiesTable).set({
    name, category, balanceUsd: balanceUsd?.toString(), interestRatePercent: interestRatePercent?.toString() ?? null,
    monthlyPaymentUsd: monthlyPaymentUsd?.toString() ?? null, currencyOriginal, balanceOriginal: balanceOriginal?.toString() ?? null, updatedAt: new Date(),
  }).where(and(eq(liabilitiesTable.id, rawId), eq(liabilitiesTable.userId, userId))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// Upsert liability by name: deletes all existing rows with same name, then inserts fresh.
router.post("/liabilities/upsert-by-name", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { name, category, balanceUsd, currencyOriginal } = req.body;
  if (!name || !category || !balanceUsd) { res.status(400).json({ error: "Missing required fields" }); return; }
  await db.delete(liabilitiesTable).where(and(eq(liabilitiesTable.userId, userId), eq(liabilitiesTable.name, name)));
  const [l] = await db.insert(liabilitiesTable).values({
    userId, name, category, balanceUsd: balanceUsd.toString(),
    currencyOriginal: currencyOriginal ?? "USD",
  }).returning();
  res.status(201).json(l);
});

router.delete("/liabilities/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(liabilitiesTable).where(and(eq(liabilitiesTable.id, rawId), eq(liabilitiesTable.userId, userId)));
  res.sendStatus(204);
});

export default router;
