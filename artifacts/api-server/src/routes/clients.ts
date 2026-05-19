import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clientProfilesTable, profilesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/client-profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
  if (!cp) { res.status(404).json({ error: "Not found" }); return; }
  res.json(cp);
});

router.get("/advisor/clients/:id/profile", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, id));
  if (!profile) { res.status(404).json({ error: "Not found" }); return; }
  res.json(profile);
});

router.get("/advisor/clients/:id/client-profile", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, id));
  if (!cp) { res.status(404).json({ error: "Not found" }); return; }
  res.json(cp);
});

router.put("/advisor/clients/:id/client-profile", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const updates = req.body;
  const existing = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, id));
  let cp;
  if (existing.length > 0) {
    [cp] = await db.update(clientProfilesTable).set({ ...updates, updatedAt: new Date() }).where(eq(clientProfilesTable.userId, id)).returning();
  } else {
    [cp] = await db.insert(clientProfilesTable).values({ userId: id, ...updates }).returning();
  }
  res.json(cp);
});

router.get("/advisor/clients", requireAuth, async (req, res): Promise<void> => {
  const advisorId = (req as any).userId;
  const clients = await db.select({
    id: profilesTable.id,
    email: profilesTable.email,
    fullName: profilesTable.fullName,
    role: profilesTable.role,
    createdAt: profilesTable.createdAt,
    kycStatus: clientProfilesTable.kycStatus,
    riskProfile: clientProfilesTable.riskProfile,
    onboardingStep: clientProfilesTable.onboardingStep,
    advisorId: clientProfilesTable.advisorId,
  }).from(profilesTable)
    .innerJoin(clientProfilesTable, eq(clientProfilesTable.userId, profilesTable.id))
    .where(eq(clientProfilesTable.advisorId, advisorId));
  res.json(clients);
});

export default router;
