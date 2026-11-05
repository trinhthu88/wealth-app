import { and, asc, eq, inArray, ne, sql, desc } from "drizzle-orm";
import { db, clientProfilesTable, healthScoresTable, leadsTable, profilesTable, type Lead } from "@workspace/db";
import type { CheckpointCode } from "@workspace/tier-policy";

/**
 * The one interest action: one live lead per user. Re-touches the existing non-churned
 * lead, updating source and updatedAt, and creates a row only when none exists. The
 * advisory lock makes two simultaneous clicks produce one row.
 *
 * DECISION: re-touching a cold lead returns it to unassigned and clears the old advisor.
 * The design sends a cold lead back to "Talk to an advisor", so if the status stayed cold
 * the user's hand-raise would change nothing on their card.
 *
 * DECISION: leads.email is NOT NULL, so a linked lead's row stores the email at creation.
 * It is never read for a linked lead; withLinkedPerson overlays the profile's values.
 */
export async function registerInterest(
  userId: string,
  email: string,
  source: CheckpointCode,
): Promise<{ lead: Lead; created: boolean }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`lead:${userId}`}))`);
    const [existing] = await tx.select().from(leadsTable)
      .where(and(eq(leadsTable.userId, userId), ne(leadsTable.status, "churned")))
      .orderBy(asc(leadsTable.createdAt)).limit(1);
    if (existing) {
      const [lead] = await tx.update(leadsTable).set({
        source,
        updatedAt: new Date(),
        ...(existing.status === "cold" ? { status: "unassigned", assignedAdvisorId: null } : {}),
      }).where(eq(leadsTable.id, existing.id)).returning();
      return { lead, created: false };
    }
    const [lead] = await tx.insert(leadsTable).values({ email, userId, source, status: "unassigned" }).returning();
    return { lead, created: true };
  });
}

/** Name, email and score of a linked lead come from the owner tables, never the lead's copy. */
export async function withLinkedPerson<T extends Lead>(leads: T[]): Promise<T[]> {
  const userIds = [...new Set(leads.map((l) => l.userId).filter((id): id is string => !!id))];
  if (userIds.length === 0) return leads;
  const [profiles, scores, clientRows] = await Promise.all([
    db.select({ id: profilesTable.id, email: profilesTable.email, fullName: profilesTable.fullName })
      .from(profilesTable).where(inArray(profilesTable.id, userIds)),
    db.selectDistinctOn([healthScoresTable.userId], { userId: healthScoresTable.userId, overallScore: healthScoresTable.overallScore })
      .from(healthScoresTable).where(inArray(healthScoresTable.userId, userIds))
      .orderBy(healthScoresTable.userId, desc(healthScoresTable.scoreDate), desc(healthScoresTable.createdAt)),
    db.select({ userId: clientProfilesTable.userId, status: clientProfilesTable.status })
      .from(clientProfilesTable).where(inArray(clientProfilesTable.userId, userIds)),
  ]);
  const pendingPayment = new Set(clientRows.filter((c) => c.status === "pending_payment").map((c) => c.userId));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const scoreByUser = new Map(scores.map((s) => [s.userId, s.overallScore]));
  return leads.map((lead) => {
    const profile = lead.userId ? profileById.get(lead.userId) : undefined;
    if (!profile) return lead;
    return {
      ...lead,
      email: profile.email,
      firstName: profile.fullName,
      healthScore: scoreByUser.get(profile.id) ?? null,
      pendingPayment: pendingPayment.has(profile.id),
    };
  });
}
