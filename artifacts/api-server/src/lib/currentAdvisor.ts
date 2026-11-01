import { and, eq, inArray } from "drizzle-orm";
import { db, clientProfilesTable, leadsTable, profilesTable } from "@workspace/db";

/**
 * The client_profiles advisor pointer applies only to investment clients. A
 * free user may have a client_profiles row that holds preferences alone (risk
 * profile, onboarding stage), so row existence never means "is a client".
 * Returns undefined when the user is not an investment client with a row.
 */
export async function getClientAdvisorPointer(clientUserId: string): Promise<{ advisorId: string | null } | undefined> {
  const [row] = await db
    .select({ advisorId: clientProfilesTable.advisorId })
    .from(clientProfilesTable)
    .innerJoin(profilesTable, eq(profilesTable.id, clientProfilesTable.userId))
    .where(and(eq(clientProfilesTable.userId, clientUserId), eq(profilesTable.role, "investment_client")));
  return row;
}

/** Resolve the current advisor from the owning record, never a copied row field. */
export async function getCurrentAdvisorIdForClient(clientUserId: string): Promise<string | null> {
  const clientProfile = await getClientAdvisorPointer(clientUserId);
  if (clientProfile) return clientProfile.advisorId ?? null;

  const [lead] = await db
    .select({ assignedAdvisorId: leadsTable.assignedAdvisorId })
    .from(leadsTable)
    .where(eq(leadsTable.userId, clientUserId));
  return lead?.assignedAdvisorId ?? null;
}

/** Return clients whose active assignment points at this advisor, including pre-client leads. */
export async function getClientUserIdsForAdvisor(advisorId: string): Promise<string[]> {
  const [clientRows, leadRows] = await Promise.all([
    db.select({ userId: clientProfilesTable.userId })
      .from(clientProfilesTable)
      .innerJoin(profilesTable, eq(profilesTable.id, clientProfilesTable.userId))
      .where(and(eq(clientProfilesTable.advisorId, advisorId), eq(profilesTable.role, "investment_client"))),
    db.select({ userId: leadsTable.userId })
      .from(leadsTable)
      .where(eq(leadsTable.assignedAdvisorId, advisorId)),
  ]);

  const leadUserIds = [...new Set(leadRows.map((lead) => lead.userId).filter((id): id is string => !!id))];
  const linkedProfiles = leadUserIds.length > 0
    ? await db.select({ userId: clientProfilesTable.userId, advisorId: clientProfilesTable.advisorId })
      .from(clientProfilesTable)
      .innerJoin(profilesTable, eq(profilesTable.id, clientProfilesTable.userId))
      .where(and(inArray(clientProfilesTable.userId, leadUserIds), eq(profilesTable.role, "investment_client")))
    : [];
  const advisorByClient = new Map(linkedProfiles.map((profile) => [profile.userId, profile.advisorId]));
  const currentLeadUsers = leadUserIds.filter(
    (userId) => !advisorByClient.has(userId) || advisorByClient.get(userId) === advisorId,
  );

  return [...new Set([...clientRows.map((row) => row.userId), ...currentLeadUsers])];
}
