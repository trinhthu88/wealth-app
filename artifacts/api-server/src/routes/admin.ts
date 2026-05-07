import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable, clientProfilesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/admin/users", requireAuth, async (req, res): Promise<void> => {
  const users = await db.select().from(profilesTable);
  res.json(users);
});

router.get("/admin/users/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [user] = await db.select().from(profilesTable).where(eq(profilesTable.id, rawId));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(user);
});

router.put("/admin/users/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { fullName, role, preferredCurrency } = req.body;
  const { advisorId } = req.body;
  const [updated] = await db.update(profilesTable).set({
    fullName, role, preferredCurrency, updatedAt: new Date(),
  }).where(eq(profilesTable.id, rawId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  if (advisorId) {
    const existing = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, rawId));
    if (existing.length > 0) {
      await db.update(clientProfilesTable).set({ advisorId }).where(eq(clientProfilesTable.userId, rawId));
    } else {
      await db.insert(clientProfilesTable).values({ userId: rawId, advisorId });
    }
  }
  res.json(updated);
});

export default router;
