import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.post("/profiles/me/upsert", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { email, fullName } = req.body;
  if (!email) {
    res.status(400).json({ error: "email required" });
    return;
  }
  const existing = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
  if (existing.length > 0) {
    const [updated] = await db.update(profilesTable)
      .set({ email, ...(fullName ? { fullName } : {}), updatedAt: new Date() })
      .where(eq(profilesTable.id, userId))
      .returning();
    res.json(updated);
    return;
  }
  const [created] = await db.insert(profilesTable)
    .values({ id: userId, email, fullName: fullName ?? null, role: "free_user" })
    .returning();
  res.json(created);
});

router.get("/profiles/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(profile);
});

router.put("/profiles/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { fullName, preferredCurrency, countryCode, isExpat, onboardingComplete, riskProfile, avatarUrl } = req.body;
  const [updated] = await db.update(profilesTable)
    .set({ fullName, preferredCurrency, countryCode, isExpat, onboardingComplete, riskProfile, avatarUrl, updatedAt: new Date() })
    .where(eq(profilesTable.id, userId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(updated);
});

export default router;
