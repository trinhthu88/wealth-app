import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const notifs = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, userId));
  res.json(notifs);
});

router.post("/notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { type, title, message, link } = req.body ?? {};
  if (!type || !title) { res.status(400).json({ error: "type and title required" }); return; }
  const [notif] = await db.insert(notificationsTable).values({ userId, type, title, message: message ?? null, link: link ?? null }).returning();
  res.status(201).json(notif);
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  await db.update(notificationsTable).set({ read: true })
    .where(eq(notificationsTable.userId, userId));
  res.sendStatus(204);
});

export default router;
