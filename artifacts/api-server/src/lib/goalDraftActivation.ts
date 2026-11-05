import { and, asc, eq, sql } from "drizzle-orm";
import {
  db, advisedPlansTable, clientProfilesTable, financialGoalsTable, membershipsTable, profilesTable,
} from "@workspace/db";
import {
  checkAllowance, membershipGraceUntil, resolveTier, type MembershipStatus,
} from "@workspace/tier-policy";

/**
 * Entitlement-change hook shared by membership activation and client promotion.
 * Drafts are activated only when the same goals allowance used by
 * requireAllowance("goals") allows the user to hold another active goal.
 */
export async function activateDraftGoalsForUser(userId: string): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`cap:${userId}`}))`);

    const [profile] = await tx.select({ role: profilesTable.role }).from(profilesTable)
      .where(eq(profilesTable.id, userId));
    const [clientProfile] = await tx.select({ clientTrack: clientProfilesTable.clientTrack })
      .from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId));
    const [inforcePlan] = await tx.select({ id: advisedPlansTable.id }).from(advisedPlansTable)
      .where(and(eq(advisedPlansTable.userId, userId), eq(advisedPlansTable.status, "inforce"))).limit(1);
    const [membership] = await tx.select().from(membershipsTable).where(eq(membershipsTable.userId, userId));
    const activeGoals = await tx.select({ id: financialGoalsTable.id }).from(financialGoalsTable)
      .where(and(eq(financialGoalsTable.userId, userId), eq(financialGoalsTable.status, "active")));
    const draftGoals = await tx.select({ id: financialGoalsTable.id }).from(financialGoalsTable)
      .where(and(eq(financialGoalsTable.userId, userId), eq(financialGoalsTable.status, "draft")))
      .orderBy(asc(financialGoalsTable.createdAt));

    const membershipStatus = (membership?.status ?? "none") as MembershipStatus;
    const tier = resolveTier(
      profile?.role ?? "free_user",
      clientProfile?.clientTrack ?? null,
      inforcePlan !== undefined,
      membershipStatus,
      membershipGraceUntil(membership?.currentPeriodEnd ?? null),
    );
    let goalCount = activeGoals.length;
    let activated = 0;
    for (const draft of draftGoals) {
      const allowance = checkAllowance(tier, "goals", {
        goals: goalCount,
        holdings: 0,
        solMessagesToday: 0,
      }, null);
      if (!allowance.allowed) break;
      const [updated] = await tx.update(financialGoalsTable)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(
          eq(financialGoalsTable.id, draft.id),
          eq(financialGoalsTable.userId, userId),
          eq(financialGoalsTable.status, "draft"),
        ))
        .returning({ id: financialGoalsTable.id });
      if (updated) {
        goalCount += 1;
        activated += 1;
      }
    }
    return activated;
  });
}
