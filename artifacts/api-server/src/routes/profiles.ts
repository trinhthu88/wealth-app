import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, profilesTable, clientProfilesTable, normalizeRiskProfile } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { parseDateOfBirth, setRiskProfile } from "../lib/profileFields";

const router: IRouter = Router();

/** The caller's primary email as Clerk knows it. Null when the account has none. */
async function getClerkPrimaryEmail(userId: string): Promise<{ address: string; verified: boolean } | null> {
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  if (!primary) return null;
  return { address: primary.emailAddress, verified: primary.verification?.status === "verified" };
}

router.post("/profiles/me/upsert", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const fullName = req.body?.fullName;

  // F-1: identity comes from Clerk. A body `email` is ignored, both for the
  // super_admin check and for the stored address.
  let clerkEmail: Awaited<ReturnType<typeof getClerkPrimaryEmail>>;
  try {
    clerkEmail = await getClerkPrimaryEmail(userId);
  } catch (err) {
    req.log.error({ err }, "Could not read the caller's email from Clerk");
    res.status(502).json({ error: "Could not verify your account. Please try again." });
    return;
  }
  if (!clerkEmail) {
    res.status(400).json({ error: "Your account has no primary email address" });
    return;
  }
  const email = clerkEmail.address;

  // DECISION: super_admin also requires the primary address to be verified. Otherwise
  // an instance that allows unverified sign-ups would reopen F-1: register with the
  // admin's address, skip verification, get the role.
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const isSuperAdmin = !!superAdminEmail && clerkEmail.verified && email.trim().toLowerCase() === superAdminEmail;

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
