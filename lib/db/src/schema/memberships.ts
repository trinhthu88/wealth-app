import { pgTable, text, boolean, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profilesTable } from "./profiles";

// Owner of the membership fact. Written only by artifacts/api-server/src/lib/membershipStore.ts,
// from the Stripe webhook and the super-admin comp route. The tier reads this table; the browser
// never decides whether a membership is active.
export const membershipsTable = pgTable("memberships", {
  userId: text("user_id").primaryKey().references(() => profilesTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("stripe"),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  plan: text("plan"),
  status: text("status").notNull().default("none"),
  // The date the member has paid through. While past_due this is the end of the last paid
  // period, not Stripe's current_period_end, which has already rolled forward by then.
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  source: text("source").notNull().default("stripe"),
  // Why a super admin comped or revoked this membership.
  reason: text("reason"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("memberships_provider_customer_id_idx").on(t.providerCustomerId),
  check("memberships_status_check", sql`${t.status} IN ('none', 'trialing', 'active', 'past_due', 'canceled')`),
  check("memberships_plan_check", sql`${t.plan} IN ('member_monthly', 'member_annual')`),
  check("memberships_source_check", sql`${t.source} IN ('stripe', 'comped', 'advised_plan')`),
]);

// One row per processed Stripe event, written in the same transaction as its effects, so a
// replayed event changes nothing and a failed one stays retryable.
export const stripeWebhookEventsTable = pgTable("stripe_webhook_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

// The caller's latest Checkout session, so asking twice while one is open returns the same URL.
export const membershipCheckoutSessionsTable = pgTable("membership_checkout_sessions", {
  userId: text("user_id").primaryKey().references(() => profilesTable.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  plan: text("plan").notNull(),
  url: text("url").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Membership = typeof membershipsTable.$inferSelect;
