import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, blogPostsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/blog", async (_req, res): Promise<void> => {
  const posts = await db.select().from(blogPostsTable).where(eq(blogPostsTable.status, "published"));
  res.json(posts);
});

router.get("/blog/:slug", async (req, res): Promise<void> => {
  const rawSlug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.slug, rawSlug));
  if (!post) { res.status(404).json({ error: "Not found" }); return; }
  res.json(post);
});

router.post("/blog", requireAuth, async (req, res): Promise<void> => {
  const authorId = (req as any).userId;
  const { title, slug, excerpt, contentMarkdown, category, status, coverImageUrl } = req.body;
  if (!title || !slug) { res.status(400).json({ error: "title and slug required" }); return; }
  const [post] = await db.insert(blogPostsTable).values({
    authorId, title, slug, excerpt: excerpt ?? null,
    contentMarkdown: contentMarkdown ?? null, category: category ?? null,
    status: status ?? "draft", coverImageUrl: coverImageUrl ?? null,
    publishedAt: status === "published" ? new Date() : null,
  }).returning();
  res.status(201).json(post);
});

router.put("/blog/:id/admin", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, slug, excerpt, contentMarkdown, category, status, coverImageUrl } = req.body;
  const [updated] = await db.update(blogPostsTable).set({
    title, slug, excerpt: excerpt ?? null, contentMarkdown: contentMarkdown ?? null,
    category: category ?? null, status, coverImageUrl: coverImageUrl ?? null,
    publishedAt: status === "published" ? new Date() : null, updatedAt: new Date(),
  }).where(eq(blogPostsTable.id, rawId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
