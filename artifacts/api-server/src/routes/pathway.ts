import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, pathwayProgressTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/pathway", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const steps = await db.select().from(pathwayProgressTable)
    .where(eq(pathwayProgressTable.userId, userId))
    .orderBy(pathwayProgressTable.stepNumber);
  res.json(steps);
});

router.put("/pathway/:stepNumber", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawStep = Array.isArray(req.params.stepNumber) ? req.params.stepNumber[0] : req.params.stepNumber;
  const stepNumber = parseInt(rawStep, 10);
  const { stepName, status, formData } = req.body;
  if (!stepName || !status) {
    res.status(400).json({ error: "stepName and status required" });
    return;
  }
  const existing = await db.select().from(pathwayProgressTable)
    .where(and(eq(pathwayProgressTable.userId, userId), eq(pathwayProgressTable.stepNumber, stepNumber)));
  if (existing.length > 0) {
    const [updated] = await db.update(pathwayProgressTable)
      .set({ stepName, status, formData: formData ?? null, completedAt: status === "completed" ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(pathwayProgressTable.userId, userId), eq(pathwayProgressTable.stepNumber, stepNumber)))
      .returning();
    res.json(updated);
    return;
  }
  const [created] = await db.insert(pathwayProgressTable)
    .values({ userId, stepNumber, stepName, status, formData: formData ?? null, completedAt: status === "completed" ? new Date() : null })
    .returning();
  res.json(created);
});

export default router;
