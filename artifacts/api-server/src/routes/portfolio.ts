import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, portfolioHoldingsTable, profilesTable } from "@workspace/db";
import { requireAuth, requireRole, requireAdvisorOwnsClient } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/portfolio", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  res.json(await db.select().from(portfolioHoldingsTable).where(eq(portfolioHoldingsTable.userId, userId)));
});

router.post("/portfolio", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { assetName, assetClass, currentValueUsd, currencyOriginal, weightPercent, tickerSymbol, notes } = req.body;
  if (!assetName || !assetClass || !currentValueUsd) { res.status(400).json({ error: "Missing required fields" }); return; }

  // Enforce 2-holding limit for free users
  const [[profile], existing] = await Promise.all([
    db.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, userId)),
    db.select({ id: portfolioHoldingsTable.id }).from(portfolioHoldingsTable).where(eq(portfolioHoldingsTable.userId, userId)),
  ]);
  if (profile?.role === "free_user" && existing.length >= 2) {
    res.status(403).json({ error: "Free users can only track 2 holdings. Upgrade to Investment Client to unlock unlimited holdings and live pricing." });
    return;
  }

  const [h] = await db.insert(portfolioHoldingsTable).values({
    userId, assetName, assetClass, currentValueUsd: currentValueUsd.toString(),
    currencyOriginal: currencyOriginal ?? "USD",
    weightPercent: weightPercent?.toString() ?? null,
    tickerSymbol: tickerSymbol ?? null, notes: notes ?? null,
  }).returning();
  res.status(201).json(h);
});

router.put("/portfolio/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { assetName, assetClass, currentValueUsd, currencyOriginal, weightPercent, tickerSymbol, notes } = req.body;
  const [updated] = await db.update(portfolioHoldingsTable).set({
    assetName, assetClass, currentValueUsd: currentValueUsd?.toString(),
    currencyOriginal, weightPercent: weightPercent?.toString() ?? null,
    tickerSymbol: tickerSymbol ?? null, notes: notes ?? null, lastUpdatedAt: new Date(),
  }).where(and(eq(portfolioHoldingsTable.id, rawId), eq(portfolioHoldingsTable.userId, userId))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/portfolio/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(portfolioHoldingsTable).where(and(eq(portfolioHoldingsTable.id, rawId), eq(portfolioHoldingsTable.userId, userId)));
  res.sendStatus(204);
});

router.get("/advisor/clients/:id/portfolio", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClient("id"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  res.json(await db.select().from(portfolioHoldingsTable).where(eq(portfolioHoldingsTable.userId, rawId)));
});

router.put("/advisor/clients/:id/portfolio", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClient("id"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { holdings } = req.body;
  if (!Array.isArray(holdings)) { res.status(400).json({ error: "holdings array required" }); return; }
  await db.delete(portfolioHoldingsTable).where(and(eq(portfolioHoldingsTable.userId, rawId), eq(portfolioHoldingsTable.isAdvisorManaged, true)));
  if (holdings.length > 0) {
    await db.insert(portfolioHoldingsTable).values(holdings.map((h: any) => ({
      userId: rawId, assetName: h.assetName, assetClass: h.assetClass,
      currentValueUsd: h.currentValueUsd?.toString(), currencyOriginal: h.currencyOriginal ?? "USD",
      weightPercent: h.weightPercent?.toString() ?? null, tickerSymbol: h.tickerSymbol ?? null,
      isAdvisorManaged: true,
    })));
  }
  const updated = await db.select().from(portfolioHoldingsTable).where(eq(portfolioHoldingsTable.userId, rawId));
  res.json(updated);
});

export default router;
