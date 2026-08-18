import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, kycDocumentsTable } from "@workspace/db";
import { requireAuth, requireRole, requireAdvisorOwnsClient } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/kyc/documents", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  res.json(await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, userId)));
});

router.post("/kyc/documents", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { documentType, fileUrl, fileName } = req.body;
  if (!documentType || !fileUrl) { res.status(400).json({ error: "documentType and fileUrl required" }); return; }
  const [doc] = await db.insert(kycDocumentsTable).values({ userId, documentType, fileUrl, fileName: fileName ?? null }).returning();
  res.status(201).json(doc);
});

router.get("/advisor/clients/:id/kyc", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClient("id"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  res.json(await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, rawId)));
});

router.post("/advisor/clients/:id/kyc/:docId/verify", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClient("id"), async (req, res): Promise<void> => {
  const verifiedBy = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawDocId = Array.isArray(req.params.docId) ? req.params.docId[0] : req.params.docId;
  const { status, rejectionReason } = req.body;
  const [updated] = await db.update(kycDocumentsTable).set({
    status, rejectionReason: rejectionReason ?? null,
    verifiedBy, verifiedAt: new Date(),
  }).where(and(eq(kycDocumentsTable.id, rawDocId), eq(kycDocumentsTable.userId, rawId))).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
