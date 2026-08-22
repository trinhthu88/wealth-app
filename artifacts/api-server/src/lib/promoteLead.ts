import { and, eq } from "drizzle-orm";
import { db, profilesTable, clientProfilesTable, leadsTable, advisedPlansTable } from "@workspace/db";

export type PromoteLeadResult =
  | { ok: true; profile: typeof profilesTable.$inferSelect; clientProfile: typeof clientProfilesTable.$inferSelect }
  | { ok: false; httpStatus: number; error: string };

/**
 * Promotes an already-linked lead (userId set) to a fully provisioned
 * investment_client: flips profiles.role if needed, creates (or updates, if
 * one already exists from a prior partial state) the client_profiles row, and
 * stamps leadsTable.convertedUserId as the historical promotion marker —
 * unless it's already set, in which case it's left alone.
 *
 * clientTrack is derived once, at promotion time, from whether the lead has
 * at least one in-force advised plan — it's a snapshot, not something this
 * re-derives on a later, unrelated edit (see the "only on the status
 * transition into client" guard at the call site in leads.ts).
 *
 * Runs the role flip, client_profiles upsert, and convertedUserId stamp as a
 * single transaction — a promotion that partially succeeds (role flipped but
 * no client_profiles row, or vice versa) is worse than not promoting at all.
 */
export async function promoteLeadToClient(lead: typeof leadsTable.$inferSelect): Promise<PromoteLeadResult> {
  if (!lead.userId) {
    return { ok: false, httpStatus: 409, error: "This lead has no linked account yet — convert it instead of promoting it." };
  }
  if (!lead.assignedAdvisorId) {
    return { ok: false, httpStatus: 409, error: "Assign this lead to an advisor before promoting it to client." };
  }
  const userId = lead.userId;

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
  if (!profile) {
    return { ok: false, httpStatus: 404, error: "Linked profile not found" };
  }

  const { updatedProfile, clientProfile } = await db.transaction(async (tx) => {
    const nextProfile = profile.role === "investment_client"
      ? profile
      : (await tx.update(profilesTable).set({ role: "investment_client", updatedAt: new Date() })
          .where(eq(profilesTable.id, userId)).returning())[0];

    const inforcePlans = await tx.select({ id: advisedPlansTable.id }).from(advisedPlansTable)
      .where(and(eq(advisedPlansTable.userId, userId), eq(advisedPlansTable.status, "inforce")));
    const clientTrack = inforcePlans.length > 0 ? "track_a" : "track_b";

    const [existingCp] = await tx.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
    const nextCp = existingCp
      ? (await tx.update(clientProfilesTable).set({
          advisorId: lead.assignedAdvisorId, status: "active", clientTrack, updatedAt: new Date(),
        }).where(eq(clientProfilesTable.userId, userId)).returning())[0]
      : (await tx.insert(clientProfilesTable).values({
          userId, advisorId: lead.assignedAdvisorId, status: "active", clientTrack,
        }).returning())[0];

    if (!lead.convertedUserId) {
      await tx.update(leadsTable).set({ convertedUserId: userId, updatedAt: new Date() }).where(eq(leadsTable.id, lead.id));
    }

    return { updatedProfile: nextProfile, clientProfile: nextCp };
  });

  return { ok: true, profile: updatedProfile, clientProfile };
}
