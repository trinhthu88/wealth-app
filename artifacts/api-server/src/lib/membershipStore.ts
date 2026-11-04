import type Stripe from "stripe";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import {
  db, clientProfilesTable, leadsTable, membershipsTable, profilesTable, stripeWebhookEventsTable,
  type Membership,
} from "@workspace/db";
import {
  isMembershipActive, membershipGraceUntil, type MembershipPlan, type MembershipStatus,
} from "@workspace/tier-policy";
import { logger } from "./logger";
import { raiseCheckpoint, runCheckpointHook } from "./checkpointEngine";

/**
 * The only runtime code that writes memberships. Two callers exist, as the addendum names:
 * handleStripeEvent (the webhook) and setCompedMembership (the super-admin route). Checkout
 * writes nothing here: a user is not a member until Stripe says so.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function isRowActive(row: Pick<Membership, "status" | "currentPeriodEnd"> | null | undefined, now = new Date()): boolean {
  if (!row) return false;
  return isMembershipActive(row.status as MembershipStatus, membershipGraceUntil(row.currentPeriodEnd), now);
}

function statusFromStripe(status: Stripe.Subscription.Status): MembershipStatus {
  switch (status) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due":
    case "unpaid": return "past_due";
    case "canceled":
    case "paused": return "canceled";
    default: return "none"; // incomplete, incomplete_expired: nothing was ever paid.
  }
}

function planFromPrice(price: Stripe.Price | undefined): MembershipPlan | null {
  if (!price) return null;
  // By interval, not id: an admin can change the configured prices, and subscribers stay on old ones.
  return price.recurring?.interval === "year" ? "member_annual" : "member_monthly";
}

const fromUnix = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000) : null);

/**
 * DECISION: while past_due, currentPeriodEnd stores the end of the last paid period. The grace
 * rule is currentPeriodEnd + 7 days, but Stripe rolls current_period_end forward as soon as the
 * renewal invoice is created, even if payment then fails, so using its value would give a monthly
 * member about 37 days and an annual member over a year. The new period's start is the date they
 * paid through, which is what the 7-day decision means.
 */
function paidThrough(sub: Stripe.Subscription, status: MembershipStatus): Date | null {
  const item = sub.items.data[0];
  return fromUnix(status === "past_due" ? item?.current_period_start : item?.current_period_end);
}

function customerId(customer: Stripe.Subscription["customer"]): string {
  return typeof customer === "string" ? customer : customer.id;
}

/** The subscription an event is about, whichever object Stripe delivered. */
function subscriptionIdFor(event: Stripe.Event): string | null {
  const idOf = (s: string | { id: string } | null | undefined) => (typeof s === "string" ? s : s?.id ?? null);
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      return session.mode === "subscription" ? idOf(session.subscription) : null;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return (event.data.object as Stripe.Subscription).id;
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      return idOf(invoice.parent?.subscription_details?.subscription);
    }
    default:
      return null;
  }
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

async function afterCommit(userId: string, previousStatus: string | undefined, nextStatus: string): Promise<void> {
  if (nextStatus === "canceled" && previousStatus !== "canceled") {
    await raiseCheckpoint(userId, "C12_lapsed", {});
  }
  await runCheckpointHook(userId);
}

/**
 * Applies one Stripe event. The subscription is re-read from Stripe rather than taken from the
 * payload, because Stripe does not guarantee delivery order: a late "active" must not resurrect a
 * canceled member. Throws on a transient failure, so the route answers 500 and Stripe retries.
 */
export async function handleStripeEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
  const subscriptionId = subscriptionIdFor(event);
  if (!subscriptionId) return;

  const [seen] = await db.select({ id: stripeWebhookEventsTable.eventId }).from(stripeWebhookEventsTable)
    .where(eq(stripeWebhookEventsTable.eventId, event.id));
  if (seen) return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customer = customerId(sub.customer);
  let userId: string | undefined = sub.metadata?.userId;
  if (!userId) {
    const [byCustomer] = await db.select({ userId: membershipsTable.userId }).from(membershipsTable)
      .where(eq(membershipsTable.providerCustomerId, customer));
    userId = byCustomer?.userId;
  }
  if (!userId) {
    logger.warn({ eventId: event.id, eventType: event.type }, "Stripe event has no matching user");
    return;
  }
  const targetUserId = userId;

  const change = await db.transaction(async (tx) => {
    const [fresh] = await tx.insert(stripeWebhookEventsTable).values({ eventId: event.id, type: event.type })
      .onConflictDoNothing().returning();
    if (!fresh) return null;

    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`membership:${targetUserId}`}))`);
    const [profile] = await tx.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, targetUserId));
    if (!profile) {
      logger.warn({ eventId: event.id }, "Stripe event names a user with no profile");
      return null;
    }
    const [existing] = await tx.select().from(membershipsTable).where(eq(membershipsTable.userId, targetUserId));
    const status = statusFromStripe(sub.status);
    const activeNow = isMembershipActive(status, membershipGraceUntil(paidThrough(sub, status)));

    // An old subscription ending must not cancel a newer one, or a comped membership.
    if (!activeNow && existing && isRowActive(existing)
      && (existing.source === "comped" || (existing.providerSubscriptionId && existing.providerSubscriptionId !== sub.id))) {
      return null;
    }

    const values = {
      provider: "stripe",
      providerCustomerId: customer,
      providerSubscriptionId: sub.id,
      plan: planFromPrice(sub.items.data[0]?.price),
      status,
      currentPeriodEnd: paidThrough(sub, status),
      trialEndsAt: fromUnix(sub.trial_end),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      source: "stripe",
      reason: null,
      updatedAt: new Date(),
    };
    await tx.insert(membershipsTable).values({ userId: targetUserId, ...values })
      .onConflictDoUpdate({ target: membershipsTable.userId, set: values });

    if (activeNow) {
      const isFirst = !existing || existing.status === "none";
      await onActivated(tx, targetUserId, profile.role, isFirst, "self_serve_member");
    }
    return { previous: existing?.status, next: status };
  });

  if (change) await afterCommit(targetUserId, change.previous, change.next);
}

export type CompResult = { ok: true; membership: Membership } | { ok: false; httpStatus: number; error: string };

/** The super-admin route's write. Comps or revokes; never touches a paying member's Stripe record. */
export async function setCompedMembership(userId: string, action: "comp" | "revoke", reason: string): Promise<CompResult> {
  const outcome = await db.transaction(async (tx): Promise<CompResult & { previous?: string }> => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`membership:${userId}`}))`);
    const [profile] = await tx.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, userId));
    if (!profile) return { ok: false, httpStatus: 404, error: "Not found" };
    if (profile.role !== "free_user" && profile.role !== "investment_client") {
      return { ok: false, httpStatus: 400, error: "Only free users and clients hold a membership." };
    }
    const [existing] = await tx.select().from(membershipsTable).where(eq(membershipsTable.userId, userId));

    if (action === "revoke") {
      if (existing?.source !== "comped") {
        return { ok: false, httpStatus: 409, error: "Only a comped membership can be revoked here. Cancel a paid one in Stripe." };
      }
      const [membership] = await tx.update(membershipsTable)
        .set({ status: "canceled", reason, currentPeriodEnd: null, updatedAt: new Date() })
        .where(eq(membershipsTable.userId, userId)).returning();
      return { ok: true, membership, previous: existing.status };
    }

    if (existing?.source === "stripe" && isRowActive(existing)) {
      return { ok: false, httpStatus: 409, error: "This user is paying through Stripe. Cancel that subscription before comping." };
    }
    const values = {
      status: "active", source: "comped", reason, plan: null, currentPeriodEnd: null,
      trialEndsAt: null, cancelAtPeriodEnd: false, updatedAt: new Date(),
    };
    const [membership] = await tx.insert(membershipsTable).values({ userId, ...values })
      .onConflictDoUpdate({ target: membershipsTable.userId, set: values }).returning();
    await onActivated(tx, userId, profile.role, !existing || existing.status === "none", "comped_member");
    return { ok: true, membership, previous: existing?.status };
  });

  if (outcome.ok) await afterCommit(userId, outcome.previous, outcome.membership.status);
  const { previous: _previous, ...result } = outcome;
  return result as CompResult;
}
