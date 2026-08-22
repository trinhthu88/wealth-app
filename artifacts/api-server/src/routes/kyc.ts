import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, kycDocumentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

// The advisor-facing list (GET /advisor/clients/:id/kyc) and the verify/reject
// workflow (POST /advisor/clients/:id/kyc/:docId/verify) are retired — both
// implied an internal approval that doesn't reflect reality (verification
// happens on the external investment platform, not here). client-detail.tsx's
// Documents tab (documentsTable, category: "kyc") replaces them; see
// scripts/src/migrate-kyc-to-documents.ts for the one-time data migration.
//
// The plain client self-service endpoints below are left in place — nothing
// currently calls them (pages/client/documents.tsx moved to the unified
// /documents endpoint), but kycDocumentsTable itself isn't being dropped, so
// they're kept rather than removed outright. Don't build new features on them.

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

export default router;
