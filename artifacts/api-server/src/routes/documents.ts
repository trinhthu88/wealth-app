import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, documentsTable } from "@workspace/db";
import { requireAuth, requireRole, requireAdvisorOwnsClient, requireAdvisorOwnsLead } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Shared by every route below — documents exist on a userId regardless of the
// account's current role (free_user, lead, or promoted investment_client).
function getDocumentsForUser(userId: string) {
  return db.select().from(documentsTable).where(eq(documentsTable.userId, userId));
}

interface UploadDocumentInput {
  userId: string; uploadedBy: string; title: string; category: string;
  fileUrl: string; fileName?: string | null; fileSizeBytes?: number | null; isAdminUploaded: boolean;
}
function insertDocument(input: UploadDocumentInput) {
  return db.insert(documentsTable).values({
    userId: input.userId, uploadedBy: input.uploadedBy, title: input.title, category: input.category,
    fileUrl: input.fileUrl, fileName: input.fileName ?? null, fileSizeBytes: input.fileSizeBytes ?? null,
    isAdminUploaded: input.isAdminUploaded,
  }).returning();
}

router.get("/documents", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  res.json(await getDocumentsForUser(userId));
});

router.post("/documents", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { title, category, fileUrl, fileName, fileSizeBytes } = req.body;
  if (!title || !category || !fileUrl) { res.status(400).json({ error: "Missing required fields" }); return; }
  const [doc] = await insertDocument({ userId, uploadedBy: userId, title, category, fileUrl, fileName, fileSizeBytes, isAdminUploaded: false });
  res.status(201).json(doc);
});

// Advisor read/upload for a lead's documents — the single documents surface
// for the lead-detail page (no separate KYC tab; category tags the type).
router.get("/advisor/leads/:id/documents", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsLead("id"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  res.json(await getDocumentsForUser(rawId));
});

router.post("/advisor/leads/:id/documents", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsLead("id"), async (req, res): Promise<void> => {
  const advisorId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, category, fileUrl, fileName, fileSizeBytes } = req.body;
  if (!title || !category || !fileUrl) { res.status(400).json({ error: "Missing required fields" }); return; }
  const [doc] = await insertDocument({ userId: rawId, uploadedBy: advisorId, title, category, fileUrl, fileName, fileSizeBytes, isAdminUploaded: true });
  res.status(201).json(doc);
});

// Same, for an already-promoted client — replaces the retired KYC tab's
// document list/upload (see kyc.ts). category "kyc" documents live here now,
// alongside every other document type, instead of a separate surface.
router.get("/advisor/clients/:id/documents", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClient("id"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  res.json(await getDocumentsForUser(rawId));
});

router.post("/advisor/clients/:id/documents", requireAuth, requireRole("advisor", "super_admin"), requireAdvisorOwnsClient("id"), async (req, res): Promise<void> => {
  const advisorId = (req as any).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, category, fileUrl, fileName, fileSizeBytes } = req.body;
  if (!title || !category || !fileUrl) { res.status(400).json({ error: "Missing required fields" }); return; }
  const [doc] = await insertDocument({ userId: rawId, uploadedBy: advisorId, title, category, fileUrl, fileName, fileSizeBytes, isAdminUploaded: true });
  res.status(201).json(doc);
});

export default router;
