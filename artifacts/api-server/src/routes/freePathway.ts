import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, pathwayProgressTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const saveStepSchema = z.object({
  stepName: z.string().trim().min(1).max(80),
  status: z.enum(["not_started", "in_progress", "completed"]),
  formData: z.record(z.string(), z.unknown()).nullable().optional(),
});

router.get("/pathway", requireAuth, requireRole("free_user"), async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const steps = await db.select().from(pathwayProgressTable)
    .where(eq(pathwayProgressTable.userId, userId))
    .orderBy(pathwayProgressTable.stepNumber);
  res.json(steps);
});

router.put("/pathway/:stepNumber", requireAuth, requireRole("free_user"), async (req, res): Promise<void> => {
  const rawStep = Array.isArray(req.params.stepNumber) ? req.params.stepNumber[0] : req.params.stepNumber;
  const stepNumber = Number(rawStep);
  if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 6) {
    res.status(400).json({ error: "stepNumber must be between 1 and 6" });
    return;
  }

  const parsed = saveStepSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "stepName, a valid status, and optional formData are required" });
    return;
  }

  const userId = (req as any).userId as string;
  const { stepName, status, formData } = parsed.data;
  const values = {
    stepName,
    status,
    formData: formData ?? null,
    completedAt: status === "completed" ? new Date() : null,
    updatedAt: new Date(),
  };
  const [existing] = await db.select({ id: pathwayProgressTable.id })
    .from(pathwayProgressTable)
    .where(and(
      eq(pathwayProgressTable.userId, userId),
      eq(pathwayProgressTable.stepNumber, stepNumber),
    ));

  if (existing) {
    const [updated] = await db.update(pathwayProgressTable)
      .set(values)
      .where(eq(pathwayProgressTable.id, existing.id))
      .returning();
    res.json(updated);
    return;
  }

  const [created] = await db.insert(pathwayProgressTable)
    .values({ userId, stepNumber, ...values })
    .returning();
  res.status(201).json(created);
});

export default router;
