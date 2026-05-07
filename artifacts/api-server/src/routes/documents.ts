import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, documentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/documents", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  res.json(await db.select().from(documentsTable).where(eq(documentsTable.userId, userId)));
});

router.post("/documents", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { title, category, fileUrl, fileName, fileSizeBytes } = req.body;
  if (!title || !category || !fileUrl) { res.status(400).json({ error: "Missing required fields" }); return; }
  const [doc] = await db.insert(documentsTable).values({
    userId, uploadedBy: userId, title, category, fileUrl,
    fileName: fileName ?? null, fileSizeBytes: fileSizeBytes ?? null,
  }).returning();
  res.status(201).json(doc);
});

export default router;
