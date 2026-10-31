import { Router, type IRouter } from "express";
import { eq, inArray, or, and } from "drizzle-orm";
import { db, conversationsTable, messagesTable, profilesTable } from "@workspace/db";
import { requireAuth, isSuperAdmin } from "../middlewares/requireAuth";
import { getClientUserIdsForAdvisor, getCurrentAdvisorIdForClient } from "../lib/currentAdvisor";

const router: IRouter = Router();

async function canAccessConversation(conversation: typeof conversationsTable.$inferSelect, userId: string) {
  if (await isSuperAdmin(userId)) return true;
  if (conversation.clientId === userId) return true;
  if (!conversation.clientId) return false;
  return (await getCurrentAdvisorIdForClient(conversation.clientId)) === userId;
}

router.get("/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;

  if (clientId) {
    const currentAdvisorId = await getCurrentAdvisorIdForClient(clientId);
    const isAdmin = await isSuperAdmin(userId);
    if (clientId !== userId && currentAdvisorId !== userId && !isAdmin) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!currentAdvisorId) {
      res.json([]);
      return;
    }
    const [existing] = await db.select().from(conversationsTable)
      .where(and(
        eq(conversationsTable.clientId, clientId),
        eq(conversationsTable.advisorId, currentAdvisorId),
      ));
    if (existing) { res.json([existing]); return; }
    const [created] = await db.insert(conversationsTable)
      .values({ clientId, advisorId: currentAdvisorId }).returning();
    res.json([created]);
    return;
  }

  if (await isSuperAdmin(userId)) {
    res.json(await db.select().from(conversationsTable));
    return;
  }
  const assignedClients = await getClientUserIdsForAdvisor(userId);
  const participantFilters = [eq(conversationsTable.clientId, userId)];
  if (assignedClients.length > 0) {
    participantFilters.push(inArray(conversationsTable.clientId, assignedClients));
  }
  const convs = await db.select().from(conversationsTable).where(or(...participantFilters));
  res.json(convs);
});

router.post("/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const clientId = typeof req.body?.clientId === "string" ? req.body.clientId : userId;
  const currentAdvisorId = await getCurrentAdvisorIdForClient(clientId);
  const isAdmin = await isSuperAdmin(userId);
  if (clientId !== userId && currentAdvisorId !== userId && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!currentAdvisorId) {
    res.status(409).json({ error: "No current advisor is assigned to this client" });
    return;
  }
  const [existing] = await db.select().from(conversationsTable)
    .where(and(
      eq(conversationsTable.clientId, clientId),
      eq(conversationsTable.advisorId, currentAdvisorId),
    ));
  if (existing) { res.json(existing); return; }
  const [conv] = await db.insert(conversationsTable)
    .values({ clientId, advisorId: currentAdvisorId }).returning();
  res.status(201).json(conv);
});

router.get("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, rawId));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canAccessConversation(conv, userId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, rawId));
  res.json(msgs);
});

router.post("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const senderId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, rawId));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canAccessConversation(conv, senderId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { content, attachmentUrl } = req.body;
  if (typeof content !== "string" || !content.trim()) { res.status(400).json({ error: "content required" }); return; }
  const [profile] = await db.select({ role: profilesTable.role })
    .from(profilesTable).where(eq(profilesTable.id, senderId));
  if (!profile) { res.status(403).json({ error: "Forbidden" }); return; }
  const [msg] = await db.insert(messagesTable).values({
    conversationId: rawId as any, senderId, senderRole: profile.role,
    content: content.trim(), attachmentUrl: attachmentUrl ?? null,
  }).returning();
  res.status(201).json(msg);
});

export default router;
