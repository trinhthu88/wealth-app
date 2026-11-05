import { and, asc, eq, ne, sql } from "drizzle-orm";
import {
  db, clientProfilesTable, leadsTable, membershipsTable, paymentWebhookEventsTable, profilesTable,
  type Membership,
} from "@workspace/db";
import {
  isMembershipActive, membershipGraceUntil, type MembershipPlan, type MembershipStatus,
} from "@workspace/tier-policy";
import { logger } from "./logger";
import type { PaymentProvider, ProviderEvent } from "./payments";
import { raiseCheckpoint, runCheckpointHook } from "./checkpointEngine";

/**
 * The only runtime code that writes memberships. Two callers exist, as the addendum names:
 * handleProviderEvent (the webhook) and setCompedMembership (the super-admin route). Checkout
 * writes nothing here: a user is not a member until the provider says so. Nothing here is specific
 * to a provider.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function isRowActive(row: Pick<Membership, "status" | "currentPeriodEnd"> | null | undefined, now = new Date()): boolean {
  if (!row) return false;
  return isMembershipActive(row.status as MembershipStatus, membershipGraceUntil(row.currentPeriodEnd), now);
}

function planFromInterval(interval: string | null): MembershipPlan | null {
  if (!interval) return null;
  return interval === "year" ? "member_annual" : "member_monthly";
}

/**
 * Runs when a membership turns active, in the same transaction as the write. A client waiting
 * on payment becomes active; a free user becomes a client, and on a first membership gets a lead
 * so a super admin can assign an advisor. Advisor assignment and data are never touched here.
 */
async function onActivated(tx: Tx, userId: string, role: string, isFirst: boolean, leadSource: string): Promise<void> {
  await tx.update(clientProfilesTable).set({ status: "active", updatedAt: new Date() })
    .where(and(eq(clientProfilesTable.userId, userId), eq(clientProfilesTable.status, "pending_payment")));
  if (role !== "free_user") return;

  await tx.update(profilesTable).set({ role: "investment_client", updatedAt: new Date() }).where(eq(profilesTable.id, userId));
  await tx.insert(clientProfilesTable).values({ userId, status: "active" }).onConflictDoNothing();
  if (!isFirst) return;

  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`lead:${userId}`}))`);
  const [live] = await tx.select().from(leadsTable)
    .where(and(eq(leadsTable.userId, userId), ne(leadsTable.status, "churned")))
    .orderBy(asc(leadsTable.createdAt)).limit(1);
  if (!live) {
    const [profile] = await tx.select({ email: profilesTable.email }).from(profilesTable).where(eq(profilesTable.id, userId));
    await tx.insert(leadsTable).values({ email: profile!.email, userId, source: leadSource, status: "unassigned" });
  } else if (live.status === "cold") {
    // Same rule as registerInterest: paying is a stronger hand-raise than a click.
    await tx.update(leadsTable).set({ status: "unassigned", assignedAdvisorId: null, source: leadSource, updatedAt: new Date() })
      .where(eq(leadsTable.id, live.id));
  }
}

/** The membership has just run out, as opposed to being cancelled with paid time still left. */
function hasLapsed(previous: Pick<Membership, "status" | "cancelAtPeriodEnd"> | undefined, status: string, activeNow: boolean): boolean {
  if (status !== "canceled" || activeNow) return false;
  return previous?.status !== "canceled" || previous.cancelAtPeriodEnd;
}

async function afterCommit(userId: string, lapsed: boolean): Promise<void> {
  if (lapsed) await raiseCheckpoint(userId, "C12_lapsed", {});
  await runCheckpointHook(userId);
}

/**
 * Applies one provider event. The subscription is re-read from the provider rather than taken from
 * the payload, because delivery order isn't guaranteed: a late "active" must not resurrect a canceled
 * member. Throws on a transient failure, so the route answers 500 and the provider retries.
 */
export async function handleProviderEvent(event: ProviderEvent, provider: PaymentProvider): Promise<void> {
  if (!event.subscriptionId) return;

  const [seen] = await db.select({ id: paymentWebhookEventsTable.eventId }).from(paymentWebhookEventsTable)
    .where(eq(paymentWebhookEventsTable.eventId, event.id));
  if (seen) return;

  const sub = await provider.fetchSubscription(event.subscriptionId);
  let userId: string | null = event.userId ?? sub.userId;
  if (!userId) {
    const [byCustomer] = await db.select({ userId: membershipsTable.userId }).from(membershipsTable)
      .where(eq(membershipsTable.providerCustomerId, sub.customerId));
    userId = byCustomer?.userId ?? null;
  }
  if (!userId) {
    logger.warn({ eventId: event.id, eventType: event.type }, "Payment event has no matching user");
    return;
  }
  const targetUserId = userId;

  const change = await db.transaction(async (tx) => {
    const [fresh] = await tx.insert(paymentWebhookEventsTable).values({ eventId: event.id, type: event.type })
      .onConflictDoNothing().returning();
    if (!fresh) return null;

    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`membership:${targetUserId}`}))`);
    const [profile] = await tx.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, targetUserId));
    if (!profile) {
      logger.warn({ eventId: event.id }, "Payment event names a user with no profile");
      return null;
    }
    const [existing] = await tx.select().from(membershipsTable).where(eq(membershipsTable.userId, targetUserId));
    const { status } = sub;
    // A provider that can't say while past_due leaves the date already stored standing.
    const paidThrough = sub.paidThrough ?? (status === "past_due" ? existing?.currentPeriodEnd ?? null : null);
    const activeNow = isMembershipActive(status, membershipGraceUntil(paidThrough));

    // An old subscription ending must not cancel a newer one, or a comped membership.
    if ((status === "canceled" || !activeNow) && existing && isRowActive(existing)
      && (existing.source === "comped" || (existing.providerSubscriptionId && existing.providerSubscriptionId !== sub.id))) {
      return null;
    }

    const values = {
      provider: provider.name,
      providerCustomerId: sub.customerId,
      providerSubscriptionId: sub.id,
      plan: planFromInterval(sub.interval) ?? existing?.plan ?? null,
      status,
      currentPeriodEnd: paidThrough,
      trialEndsAt: sub.trialEndsAt,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      source: provider.name,
      reason: null,
      updatedAt: new Date(),
    };
    await tx.insert(membershipsTable).values({ userId: targetUserId, ...values })
      .onConflictDoUpdate({ target: membershipsTable.userId, set: values });

    if (activeNow) {
      const isFirst = !existing || existing.status === "none";
      await onActivated(tx, targetUserId, profile.role, isFirst, "self_serve_member");
    }
    return { lapsed: hasLapsed(existing, status, activeNow) };
  });

  if (change) await afterCommit(targetUserId, change.lapsed);
}

export type CompResult = { ok: true; membership: Membership } | { ok: false; httpStatus: number; error: string };

/** The super-admin route's write. Comps or revokes; never touches a paying member's provider record. */
export async function setCompedMembership(userId: string, action: "comp" | "revoke", reason: string): Promise<CompResult> {
  const outcome = await db.transaction(async (tx): Promise<CompResult & { lapsed?: boolean }> => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`membership:${userId}`}))`);
    const [profile] = await tx.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, userId));
    if (!profile) return { ok: false, httpStatus: 404, error: "Not found" };
    if (profile.role !== "free_user" && profile.role !== "investment_client") {
      return { ok: false, httpStatus: 400, error: "Only free users and clients hold a membership." };
    }
    const [existing] = await tx.select().from(membershipsTable).where(eq(membershipsTable.userId, userId));

    if (action === "revoke") {
      if (existing?.source !== "comped") {
        return { ok: false, httpStatus: 409, error: "Only a comped membership can be revoked here. Cancel a paid one with the payment provider." };
      }
      const [membership] = await tx.update(membershipsTable)
        .set({ status: "canceled", reason, currentPeriodEnd: null, cancelAtPeriodEnd: false, updatedAt: new Date() })
        .where(eq(membershipsTable.userId, userId)).returning();
      return { ok: true, membership, lapsed: hasLapsed(existing, "canceled", false) };
    }

    if (existing && existing.source !== "comped" && isRowActive(existing)) {
      return { ok: false, httpStatus: 409, error: "This user has a paid membership. Cancel that subscription before comping." };
    }
    const values = {
      status: "active", source: "comped", reason, plan: null, currentPeriodEnd: null,
      trialEndsAt: null, cancelAtPeriodEnd: false, updatedAt: new Date(),
    };
    const [membership] = await tx.insert(membershipsTable).values({ userId, ...values })
      .onConflictDoUpdate({ target: membershipsTable.userId, set: values }).returning();
    await onActivated(tx, userId, profile.role, !existing || existing.status === "none", "comped_member");
    return { ok: true, membership, lapsed: false };
  });

  if (outcome.ok) await afterCommit(userId, !!outcome.lapsed);
  const { lapsed: _lapsed, ...result } = outcome;
  return result as CompResult;
}
