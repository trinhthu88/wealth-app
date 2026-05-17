import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable, clientProfilesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

const adminGuard = [requireAuth, requireRole("super_admin")];

router.get("/admin/users", ...adminGuard, async (req, res): Promise<void> => {
  const users = await db.select().from(profilesTable).orderBy(profilesTable.createdAt);
  res.json(users);
});

router.get("/admin/users/:id", ...adminGuard, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [user] = await db.select().from(profilesTable).where(eq(profilesTable.id, rawId));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(user);
});

router.put("/admin/users/:id", ...adminGuard, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { fullName, role, preferredCurrency, advisorId } = req.body;
  const [updated] = await db.update(profilesTable).set({
    ...(fullName !== undefined ? { fullName } : {}),
    ...(role !== undefined ? { role } : {}),
    ...(preferredCurrency !== undefined ? { preferredCurrency } : {}),
    updatedAt: new Date(),
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

router.get("/admin/stats", ...adminGuard, async (req, res): Promise<void> => {
  const users = await db.select().from(profilesTable);
  const byRole = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});
  res.json({ totalUsers: users.length, byRole });
});

export default router;
