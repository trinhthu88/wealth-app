import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable, clientProfilesTable, normalizeRiskProfile } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { parseDateOfBirth, setRiskProfile } from "../lib/profileFields";

const router: IRouter = Router();

router.post("/profiles/me/upsert", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { email, fullName } = req.body;
  if (!email) {
    res.status(400).json({ error: "email required" });
    return;
  }

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const isSuperAdmin = superAdminEmail && email.trim().toLowerCase() === superAdminEmail;

  const existing = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
  if (existing.length > 0) {
    const currentRole = existing[0].role;
    const roleOverride = isSuperAdmin && currentRole !== "super_admin" ? { role: "super_admin" as const } : {};
    const [updated] = await db.update(profilesTable)
      .set({ email, ...(fullName ? { fullName } : {}), ...roleOverride, updatedAt: new Date() })
      .where(eq(profilesTable.id, userId))
      .returning();
    res.json(updated);
    return;
  }

  const [created] = await db.insert(profilesTable)
    .values({ id: userId, email, fullName: fullName ?? null, role: isSuperAdmin ? "super_admin" : "free_user" })
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
  res.json(await withOwnedRiskProfile(profile));
});

// client_profiles owns the risk profile; the deprecated profiles copy is never returned.
async function withOwnedRiskProfile<T extends { id: string }>(profile: T) {
  const [cp] = await db.select({ riskProfile: clientProfilesTable.riskProfile, riskProfileSource: clientProfilesTable.riskProfileSource })
    .from(clientProfilesTable).where(eq(clientProfilesTable.userId, profile.id));
  return { ...profile, riskProfile: cp?.riskProfile ?? null, riskProfileSource: cp?.riskProfileSource ?? null };
}

router.put("/profiles/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const body = req.body ?? {};
  const {
    fullName, preferredCurrency, countryCode, isExpat,
    onboardingComplete, avatarUrl,
    totalSavings, totalInvestments, savingsRatePercent, investmentRatePercent,
  } = body;

  const hasRisk = Object.prototype.hasOwnProperty.call(body, "riskProfile");
  const riskProfile = hasRisk ? normalizeRiskProfile(body.riskProfile) : null;
  if (hasRisk && !riskProfile) {
    res.status(400).json({ error: "Invalid risk profile" });
    return;
  }
  const hasDob = Object.prototype.hasOwnProperty.call(body, "dateOfBirth");
  const dateOfBirth = hasDob && body.dateOfBirth !== null ? parseDateOfBirth(body.dateOfBirth) : null;
  if (hasDob && body.dateOfBirth !== null && !dateOfBirth) {
    res.status(400).json({ error: "Invalid date of birth" });
    return;
  }

  const updates: Record<string, unknown> = {
    fullName, preferredCurrency, countryCode, isExpat,
    onboardingComplete, avatarUrl, updatedAt: new Date(),
  };
  if (hasDob) updates.dateOfBirth = dateOfBirth;
  if (totalSavings !== undefined) updates.totalSavings = String(totalSavings);
  if (totalInvestments !== undefined) updates.totalInvestments = String(totalInvestments);
  if (savingsRatePercent !== undefined) updates.savingsRatePercent = String(savingsRatePercent);
  if (investmentRatePercent !== undefined) updates.investmentRatePercent = String(investmentRatePercent);

  const [updated] = await db.update(profilesTable)
    .set(updates as any)
    .where(eq(profilesTable.id, userId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  if (riskProfile) await setRiskProfile(userId, riskProfile, "self");
  res.json(await withOwnedRiskProfile(updated));
});

export default router;
