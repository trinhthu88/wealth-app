// Run after `pnpm --filter @workspace/db run push` when memberships ship. Push creates new tables
// but leaves an existing check constraint as it is when the name hasn't changed, so without this
// the first promotion to pending_payment fails with a 500. Idempotent. Without --apply it only reports.
import pg from "pg";

const apply = process.argv.includes("--apply");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query<{ def: string }>(
    "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'client_profiles_status_check'",
  );
  if (rows[0]?.def.includes("pending_payment")) {
    console.log("client_profiles_status_check already allows pending_payment.");
  } else if (!apply) {
    console.log("Dry run: client_profiles_status_check would be replaced to allow pending_payment.");
  } else {
    await client.query("BEGIN");
    await client.query("ALTER TABLE client_profiles DROP CONSTRAINT IF EXISTS client_profiles_status_check");
    await client.query("ALTER TABLE client_profiles ADD CONSTRAINT client_profiles_status_check CHECK (status IN ('pending_payment', 'active', 'paused', 'churned'))");
    await client.query("COMMIT");
    console.log("client_profiles_status_check now allows pending_payment.");
  }
} finally {
  await client.end();
}
