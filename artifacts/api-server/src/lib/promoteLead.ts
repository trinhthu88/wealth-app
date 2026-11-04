import { and, eq, isNull } from "drizzle-orm";
import {
  db, profilesTable, clientProfilesTable, leadsTable, advisorAssignmentsTable, membershipsTable,
} from "@workspace/db";
import { isRowActive } from "./membershipStore";

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
 * A free user may already have a client_profiles row holding only
 * preferences (risk profile, onboarding stage); promotion updates that row in
 * place rather than inserting, so the unique user_id never blocks it. Track is
 * not written: it is derived from visible advised plans.
 *
 * Runs the role flip, client_profiles upsert, and convertedUserId stamp as a
 * single transaction — a promotion that partially succeeds (role flipped but
 * no client_profiles row, or vice versa) is worse than not promoting at all.
 *
 * Without an active membership the client starts as pending_payment: their tier stays free until
 * the webhook confirms payment.
 *
 * DECISION: promotion does not create the Checkout session, though the addendum says it should.
 * The session is created when the client presses Activate. A Stripe session expires within 24
 * hours while the client's next sign-in may be later, and it is fixed to one price before they have
 * chosen monthly or annual. It would also put a network call to Stripe in the way of promotion.
 */
export async function promoteLeadToClient(
  lead: typeof leadsTable.$inferSelect,
  assignedBy?: string | null,
): Promise<PromoteLeadResult> {
  if (!lead.userId) {
    return { ok: false, httpStatus: 409, error: "This lead has no linked account yet — convert it instead of promoting it." };
  }
  if (!lead.assignedAdvisorId) {
    return { ok: false, httpStatus: 409, error: "Assign this lead to an advisor before promoting it to client." };
  }
  const userId = lead.userId;
  const advisorId = lead.assignedAdvisorId;

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
  if (!profile) {
    return { ok: false, httpStatus: 404, error: "Linked profile not found" };
  }

  const [membership] = await db.select().from(membershipsTable).where(eq(membershipsTable.userId, userId));
  const status = isRowActive(membership) ? "active" : "pending_payment";

  const { updatedProfile, clientProfile } = await db.transaction(async (tx) => {
    const nextProfile = profile.role === "investment_client"
      ? profile
      : (await tx.update(profilesTable).set({ role: "investment_client", updatedAt: new Date() })
          .where(eq(profilesTable.id, userId)).returning())[0];

    const [existingCp] = await tx.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
    const nextCp = existingCp
      ? (await tx.update(clientProfilesTable).set({
          advisorId, status, updatedAt: new Date(),
        }).where(eq(clientProfilesTable.userId, userId)).returning())[0]
      : (await tx.insert(clientProfilesTable).values({
          userId, advisorId, status,
        }).onConflictDoUpdate({
          target: clientProfilesTable.userId,
          set: { advisorId, status, updatedAt: new Date() },
        }).returning())[0];

    const openAssignments = await tx.select({
      id: advisorAssignmentsTable.id,
      advisorId: advisorAssignmentsTable.advisorId,
    }).from(advisorAssignmentsTable).where(and(
      eq(advisorAssignmentsTable.clientUserId, userId),
      isNull(advisorAssignmentsTable.endedAt),
    ));
    const assignmentNeedsSync = existingCp?.advisorId !== advisorId
      || openAssignments.some((assignment) => assignment.advisorId !== advisorId)
      || openAssignments.length === 0;
    if (assignmentNeedsSync) {
      if (openAssignments.length > 0) {
        await tx.update(advisorAssignmentsTable)
          .set({ endedAt: new Date() })
          .where(and(
            eq(advisorAssignmentsTable.clientUserId, userId),
            isNull(advisorAssignmentsTable.endedAt),
          ));
      }
      await tx.insert(advisorAssignmentsTable).values({
        clientUserId: userId,
        advisorId,
        assignedBy: assignedBy ?? null,
      });
    }

    if (!lead.convertedUserId) {
      await tx.update(leadsTable).set({ convertedUserId: userId, updatedAt: new Date() }).where(eq(leadsTable.id, lead.id));
    }

    return { updatedProfile: nextProfile, clientProfile: nextCp };
  });

  return { ok: true, profile: updatedProfile, clientProfile };
}
