import type { Request } from "express";
import { and, asc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import {
  db, advisedPlansTable, clientHoldingsTable, clientProfilesTable, financialGoalsTable,
  leadsTable, profilesTable, solConversationsTable, solMessagesTable, conversionCheckpointsTable,
} from "@workspace/db";
import {
  entitlementsFor, resolveTier, type Checkpoint, type CheckpointCode, type Entitlements, type Tier, type Usage,
} from "@workspace/tier-policy";

export interface EntitlementContext {
  role: string;
  tier: Tier;
  usage: Usage;
  leadStatus: string | null;
  advisor: { id: string; name: string | null } | null;
  entitlements: Entitlements & { advisor: { id: string; name: string | null } | null; leadSource: string | null };
}

/** The user's one lead: the oldest live row, else their most recent churned row. */
export async function getLeadForUser(userId: string) {
  const [live] = await db.select().from(leadsTable)
    .where(and(eq(leadsTable.userId, userId), ne(leadsTable.status, "churned")))
    .orderBy(asc(leadsTable.createdAt)).limit(1);
  if (live) return live;
  const [churned] = await db.select().from(leadsTable)
    .where(eq(leadsTable.userId, userId))
    .orderBy(sql`${leadsTable.updatedAt} desc`).limit(1);
  return churned ?? null;
}

async function loadContext(userId: string): Promise<EntitlementContext> {
  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);

  const [[profile], [clientProfile], [inforcePlan], [goals], [holdings], [sol], lead] = await Promise.all([
    db.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, userId)),
    db.select({ clientTrack: clientProfilesTable.clientTrack, advisorId: clientProfilesTable.advisorId })
      .from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId)),
    db.select({ id: advisedPlansTable.id }).from(advisedPlansTable)
      .where(and(eq(advisedPlansTable.userId, userId), eq(advisedPlansTable.status, "inforce"))).limit(1),
    db.select({ n: sql<number>`count(*)::int` }).from(financialGoalsTable)
      .where(and(eq(financialGoalsTable.userId, userId), eq(financialGoalsTable.status, "active"))),
    db.select({ n: sql<number>`count(*)::int` }).from(clientHoldingsTable)
      .where(and(eq(clientHoldingsTable.userId, userId), eq(clientHoldingsTable.isActive, true))),
    db.select({ n: sql<number>`count(*)::int` }).from(solMessagesTable)
      .innerJoin(solConversationsTable, eq(solConversationsTable.id, solMessagesTable.conversationId))
      .where(and(
        eq(solConversationsTable.userId, userId),
        eq(solMessagesTable.role, "user"),
        gte(solMessagesTable.sentAt, startOfUtcDay),
      )),
    getLeadForUser(userId),
  ]);
  const [open] = await db.select().from(conversionCheckpointsTable).where(and(
    eq(conversionCheckpointsTable.userId, userId),
    isNull(conversionCheckpointsTable.dismissedAt),
    isNull(conversionCheckpointsTable.acceptedAt),
  ));
  const openCheckpoint: Checkpoint | null = open
    ? { id: open.id, code: open.code as CheckpointCode, firedAt: open.firedAt.toISOString(), snapshot: open.snapshot }
    : null;

  const role = profile?.role ?? "free_user";
  const tier = resolveTier(role, clientProfile?.clientTrack ?? null, !!inforcePlan);
  const usage: Usage = { goals: goals?.n ?? 0, holdings: holdings?.n ?? 0, solMessagesToday: sol?.n ?? 0 };
  const leadStatus = lead?.status ?? null;

  // A preferences-only client_profiles row on a free user is not an advisor pointer.
  const advisorId = role === "investment_client"
    ? clientProfile?.advisorId ?? null
    : leadStatus === "active" || leadStatus === "client" ? lead?.assignedAdvisorId ?? null : null;
  let advisor: EntitlementContext["advisor"] = null;
  if (advisorId) {
    const [row] = await db.select({ id: profilesTable.id, name: profilesTable.fullName })
      .from(profilesTable).where(eq(profilesTable.id, advisorId));
    advisor = row ?? null;
  }

  return {
    role, tier, usage, leadStatus, advisor,
    entitlements: { ...entitlementsFor(tier, usage, leadStatus, openCheckpoint), advisor, leadSource: lead?.source ?? null },
  };
}

const perRequest = new WeakMap<Request, Promise<EntitlementContext>>();

/** The one query path behind the guard and the endpoint, memoised for the request. */
export function getEntitlementContext(req: Request): Promise<EntitlementContext> {
  let pending = perRequest.get(req);
  if (!pending) {
    pending = loadContext((req as any).userId as string);
    perRequest.set(req, pending);
  }
  return pending;
}
