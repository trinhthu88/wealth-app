import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, advisorTasksTable } from "@workspace/db";
import { requireAuth, requireRole, requireAdvisorOwnsClient } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/tasks", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  res.json(await db.select().from(advisorTasksTable).where(eq(advisorTasksTable.advisorId, userId)));
});

router.post("/tasks", requireAuth, async (req, res): Promise<void> => {
  const advisorId = (req as any).userId;
  const { clientId, title, description, dueDate, priority, status } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const [t] = await db.insert(advisorTasksTable).values({
    advisorId, clientId: clientId ?? null, title,
    description: description ?? null, dueDate: dueDate ?? null,
    priority: priority ?? "medium", status: status ?? "todo",
  }).returning();
  res.status(201).json(t);
});

router.put("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const advisorId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { clientId, title, description, dueDate, priority, status } = req.body;
  const [updated] = await db.update(advisorTasksTable).set({
    clientId: clientId ?? null, title, description: description ?? null,
    dueDate: dueDate ?? null, priority, status, updatedAt: new Date(),
  }).where(and(eq(advisorTasksTable.id, rawId), eq(advisorTasksTable.advisorId, advisorId))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const advisorId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(advisorTasksTable).where(and(eq(advisorTasksTable.id, rawId), eq(advisorTasksTable.advisorId, advisorId)));
  res.sendStatus(204);
});

router.get("/advisor/clients/:id/tasks", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClient("id"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  res.json(await db.select().from(advisorTasksTable).where(eq(advisorTasksTable.clientId, rawId)));
});

export default router;
