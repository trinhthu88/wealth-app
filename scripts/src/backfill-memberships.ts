// Run once when memberships ship, before the new tier rule reaches users. Without it, everyone
// with role investment_client has no membership row and drops to free limits on deploy.
//   1. Live rows in the retired subscriptions table become memberships.
//   2. Clients with neither are counted, and left alone unless --comp-existing-clients is passed,
//      which is a product decision: it gives them a free membership instead of asking them to pay.
// Idempotent and safe by default: without --apply it only reports. Never overwrites a membership.
// This one-off deploy step is the only writer outside artifacts/api-server/src/lib/membershipStore.ts.
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, pool, clientProfilesTable, membershipsTable, profilesTable, subscriptionsTable } from "@workspace/db";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const compExisting = args.includes("--comp-existing-clients");
const onlyUsers = args.filter((a) => a.startsWith("--user=")).map((a) => a.slice("--user=".length));
const COMP_REASON = "Existing client when memberships launched";

const counts = { paidBackfilled: 0, clientsWithoutMembership: 0, clientsComped: 0 };

function planFor(priceId: string | null): string | null {
  if (priceId && priceId === process.env.STRIPE_PRICE_ANNUAL) return "member_annual";
  if (priceId && priceId === process.env.STRIPE_PRICE_MONTHLY) return "member_monthly";
  return null;
}

try {
  const subscriptions = await db.select().from(subscriptionsTable).where(and(
    inArray(subscriptionsTable.status, ["active", "trialing", "past_due"]),
    onlyUsers.length ? inArray(subscriptionsTable.userId, onlyUsers) : undefined,
  ));
  for (const sub of subscriptions) {
    const [existing] = await db.select({ userId: membershipsTable.userId }).from(membershipsTable)
      .where(eq(membershipsTable.userId, sub.userId));
    if (existing) continue;
    counts.paidBackfilled += 1;
    if (!apply) continue;
    await db.insert(membershipsTable).values({
      userId: sub.userId,
      providerCustomerId: sub.stripeCustomerId,
      providerSubscriptionId: sub.stripeSubscriptionId,
      plan: planFor(sub.stripePriceId),
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      source: "stripe",
    }).onConflictDoNothing();
    await db.update(clientProfilesTable).set({ status: "active" }).where(and(
      eq(clientProfilesTable.userId, sub.userId),
      eq(clientProfilesTable.status, "pending_payment"),
    ));
  }

  const clients = await db.select({ id: profilesTable.id }).from(profilesTable)
    .leftJoin(membershipsTable, eq(membershipsTable.userId, profilesTable.id))
    .where(and(
      eq(profilesTable.role, "investment_client"),
      isNull(membershipsTable.userId),
      onlyUsers.length ? inArray(profilesTable.id, onlyUsers) : undefined,
    ));
  const paidIds = new Set(subscriptions.map((s) => s.userId));
  for (const { id } of clients) {
    if (paidIds.has(id)) continue;
    counts.clientsWithoutMembership += 1;
    if (!compExisting) continue;
    counts.clientsComped += 1;
    if (!apply) continue;
    await db.insert(membershipsTable).values({ userId: id, status: "active", source: "comped", reason: COMP_REASON })
      .onConflictDoNothing();
    await db.update(clientProfilesTable).set({ status: "active" }).where(and(
      eq(clientProfilesTable.userId, id),
      eq(clientProfilesTable.status, "pending_payment"),
    ));
  }

  console.log(`Membership backfill ${apply ? "apply" : "dry run"}: ${JSON.stringify(counts)}`);
  if (counts.clientsWithoutMembership > counts.clientsComped) {
    console.log(`${counts.clientsWithoutMembership - counts.clientsComped} client(s) have no membership and will drop to free limits. Pass --comp-existing-clients to comp them.`);
  }
} finally {
  await pool.end();
}
