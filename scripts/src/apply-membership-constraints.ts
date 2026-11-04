// What `pnpm --filter @workspace/db run push` leaves undone for memberships. Idempotent. Without --apply
// it only reports.
//   - Renames stripe_webhook_events to payment_webhook_events, keeping its history. Run this BEFORE
//     push on any database that already has the old table, or push stops to ask about the rename.
//   - Replaces check constraints. Push creates new tables but leaves an existing constraint as it is
//     when the name hasn't changed, so without this a promotion to pending_payment, and every Lemon
//     Squeezy webhook, fails with a 500. On a database with no memberships yet, run it again after push.
import pg from "pg";

const apply = process.argv.includes("--apply");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const CONSTRAINTS = [
  { table: "client_profiles", name: "client_profiles_status_check", needs: "pending_payment", check: "status IN ('pending_payment', 'active', 'paused', 'churned')" },
  { table: "memberships", name: "memberships_source_check", needs: "lemonsqueezy", check: "source IN ('stripe', 'lemonsqueezy', 'comped', 'advised_plan')" },
];
const exists = async (table: string) =>
  (await client.query("SELECT to_regclass($1) AS t", [`public.${table}`])).rows[0].t !== null;

try {
  if (await exists("stripe_webhook_events") && !(await exists("payment_webhook_events"))) {
    if (apply) {
      await client.query("ALTER TABLE stripe_webhook_events RENAME TO payment_webhook_events");
      console.log("Renamed stripe_webhook_events to payment_webhook_events.");
    } else {
      console.log("Dry run: stripe_webhook_events would be renamed to payment_webhook_events.");
    }
  }
  for (const { table, name, needs, check } of CONSTRAINTS) {
    if (!(await exists(table))) {
      console.log(`${table} doesn't exist yet. Run this again after push.`);
      continue;
    }
    const { rows } = await client.query<{ def: string }>("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = $1", [name]);
    if (rows[0]?.def.includes(needs)) {
      console.log(`${name} already allows ${needs}.`);
    } else if (!apply) {
      console.log(`Dry run: ${name} would be replaced to allow ${needs}.`);
    } else {
      await client.query("BEGIN");
      await client.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${name}`);
      await client.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${check})`);
      await client.query("COMMIT");
      console.log(`${name} now allows ${needs}.`);
    }
  }
} finally {
  await client.end();
}
