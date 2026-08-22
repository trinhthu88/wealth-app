import { eq } from "drizzle-orm";
import { db, clientProfilesTable, advisedPlansTable, profilesTable } from "@workspace/db";

// One-off (and re-runnable) cleanup for client_profiles.status now meaning
// "already-promoted client's account health" (active | paused | churned) rather
// than the pre-client pipeline stage. "prospect" and "pending" rows predate the
// promotion event this redesign introduces, so there's no promotion record to
// anchor them to — inventory each one and only auto-migrate to "active" when
// there's independent evidence it's a real, working client relationship
// (an assigned advisor AND at least one advised_plans row). Anything else is
// flagged for manual review rather than guessed at.

const LEGACY_STATUSES = ["prospect", "pending"];

async function run() {
  console.log("\nInventorying client_profiles rows with a legacy pipeline status...\n");

  const rows = await db.select().from(clientProfilesTable);
  const legacyRows = rows.filter(r => LEGACY_STATUSES.includes(r.status));

  if (legacyRows.length === 0) {
    console.log("None found — nothing to do.\n");
    process.exit(0);
  }

  let migrated = 0;
  const flagged: Array<{ userId: string; email: string | null; status: string; advisorId: string | null; planCount: number }> = [];

  for (const row of legacyRows) {
    const plans = await db.select({ id: advisedPlansTable.id }).from(advisedPlansTable)
      .where(eq(advisedPlansTable.userId, row.userId));
    const [profile] = await db.select({ email: profilesTable.email }).from(profilesTable)
      .where(eq(profilesTable.id, row.userId));

    const qualifies = !!row.advisorId && plans.length > 0;

    if (qualifies) {
      await db.update(clientProfilesTable).set({ status: "active" }).where(eq(clientProfilesTable.id, row.id));
      console.log(`  ✓ ${row.userId} (${profile?.email ?? "unknown email"}) — "${row.status}" → "active" (advisor ${row.advisorId}, ${plans.length} plan(s))`);
      migrated++;
    } else {
      flagged.push({ userId: row.userId, email: profile?.email ?? null, status: row.status, advisorId: row.advisorId, planCount: plans.length });
      console.log(`  ⚠ ${row.userId} (${profile?.email ?? "unknown email"}) — "${row.status}" left as-is: advisorId=${row.advisorId ?? "null"}, plans=${plans.length}. Needs manual review.`);
    }
  }

  console.log(`\nDone. ${migrated} row(s) migrated to "active", ${flagged.length} flagged for manual review.\n`);
  if (flagged.length > 0) {
    console.log("Flagged rows (JSON, for review):");
    console.log(JSON.stringify(flagged, null, 2));
  }
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
