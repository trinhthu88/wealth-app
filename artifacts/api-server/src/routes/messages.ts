import { Router, type IRouter } from "express";
import { eq, or, and } from "drizzle-orm";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { clientId, advisorId } = req.query;

  // Lookup by clientId + advisorId (find or create pattern)
  if (clientId && advisorId) {
    const [existing] = await db.select().from(conversationsTable)
      .where(and(eq(conversationsTable.clientId, clientId as string), eq(conversationsTable.advisorId, advisorId as string)));
    if (existing) { res.json([existing]); return; }
    // Auto-create
    const [created] = await db.insert(conversationsTable).values({ clientId: clientId as string, advisorId: advisorId as string }).returning();
    res.json([created]);
    return;
  }

  const convs = await db.select().from(conversationsTable)
    .where(or(eq(conversationsTable.clientId, userId), eq(conversationsTable.advisorId, userId)));
  res.json(convs);
});

router.post("/conversations", requireAuth, async (req, res): Promise<void> => {
  const { clientId, advisorId } = req.body;
  const [conv] = await db.insert(conversationsTable).values({ clientId, advisorId }).returning();
  res.status(201).json(conv);
});

router.get("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, rawId));
  res.json(msgs);
});

router.post("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const senderId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { content, senderRole, attachmentUrl } = req.body;
  if (!content) { res.status(400).json({ error: "content required" }); return; }
  const [msg] = await db.insert(messagesTable).values({
    conversationId: rawId as any, senderId, senderRole: senderRole ?? null,
    content, attachmentUrl: attachmentUrl ?? null,
  }).returning();
  res.status(201).json(msg);
});

export default router;
