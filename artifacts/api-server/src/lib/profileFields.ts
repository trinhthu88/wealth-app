import { eq } from "drizzle-orm";
import { db, clientProfilesTable, type RiskProfile } from "@workspace/db";

/**
 * client_profiles owns the risk profile. Writes it with its source, creating
 * the client_profiles row if missing (free users keep preferences there too;
 * row existence never means "is an investment client").
 */
export async function setRiskProfile(userId: string, riskProfile: RiskProfile, source: "self" | "advisor"): Promise<void> {
  await db.insert(clientProfilesTable)
    .values({ userId, riskProfile, riskProfileSource: source })
    .onConflictDoUpdate({
      target: clientProfilesTable.userId,
      set: { riskProfile, riskProfileSource: source, updatedAt: new Date() },
    });
}

/**
 * Date of birth is month + year only; stored as the 1st of that month.
 * Accepts "YYYY-MM" or a full "YYYY-MM-DD" (day is discarded). Returns
 * "YYYY-MM-01", or null if invalid or not in the past.
 */
export function parseDateOfBirth(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 1900) return null;
  const first = new Date(Date.UTC(year, month - 1, 1));
  if (first.getTime() > Date.now()) return null;
  return `${match[1]}-${match[2]}-01`;
}
