import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, leadsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/leads", requireAuth, async (req, res): Promise<void> => {
  res.json(await db.select().from(leadsTable));
});

router.post("/leads", async (req, res): Promise<void> => {
  const { email, firstName, source, quizResult, healthScore, status, notes } = req.body;
  if (!email) { res.status(400).json({ error: "email required" }); return; }
  const [lead] = await db.insert(leadsTable).values({
    email, firstName: firstName ?? null, source: source ?? null,
    quizResult: quizResult ?? null, healthScore: healthScore ?? null,
    status: status ?? "new", notes: notes ?? null,
  }).returning();
  res.status(201).json(lead);
});

router.put("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { email, firstName, source, quizResult, healthScore, status, notes } = req.body;
  const [updated] = await db.update(leadsTable).set({
    email, firstName: firstName ?? null, source: source ?? null,
    quizResult: quizResult ?? null, healthScore: healthScore ?? null,
    status, notes: notes ?? null, updatedAt: new Date(),
  }).where(eq(leadsTable.id, rawId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
