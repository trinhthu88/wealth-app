import { eq, inArray } from "drizzle-orm";
import { db, clientProfilesTable, leadsTable } from "@workspace/db";

/** Resolve the current advisor from the owning record, never a copied row field. */
export async function getCurrentAdvisorIdForClient(clientUserId: string): Promise<string | null> {
  const [clientProfile] = await db
    .select({ advisorId: clientProfilesTable.advisorId })
    .from(clientProfilesTable)
    .where(eq(clientProfilesTable.userId, clientUserId));
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
      .where(eq(clientProfilesTable.advisorId, advisorId)),
    db.select({ userId: leadsTable.userId })
      .from(leadsTable)
      .where(eq(leadsTable.assignedAdvisorId, advisorId)),
  ]);

  const leadUserIds = [...new Set(leadRows.map((lead) => lead.userId).filter((id): id is string => !!id))];
  const linkedProfiles = leadUserIds.length > 0
    ? await db.select({ userId: clientProfilesTable.userId, advisorId: clientProfilesTable.advisorId })
      .from(clientProfilesTable)
      .where(inArray(clientProfilesTable.userId, leadUserIds))
    : [];
  const advisorByClient = new Map(linkedProfiles.map((profile) => [profile.userId, profile.advisorId]));
  const currentLeadUsers = leadUserIds.filter(
    (userId) => !advisorByClient.has(userId) || advisorByClient.get(userId) === advisorId,
  );

  return [...new Set([...clientRows.map((row) => row.userId), ...currentLeadUsers])];
}
