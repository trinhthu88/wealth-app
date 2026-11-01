// Phase 5 — clear the advisor pointer on a free user's client_profiles row and
// close their open advisor_assignments row, in one transaction (the same two
// writes PUT /admin/users/:id makes for advisorId: null). Refuses unless the
// user is a free_user with no lead. Idempotent; `--dry-run` shows the change.
// Usage: tsx src/p5-unassign-advisor.ts --user=<profile id> [--dry-run]
import postgres from "postgres";

const dryRun = process.argv.includes("--dry-run");
const userId = process.argv.find((a) => a.startsWith("--user="))?.slice("--user=".length);
if (!userId) throw new Error("--user=<profile id> is required");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const sql = postgres(connectionString, { max: 1 });

try {
  const [profile] = await sql`SELECT id, email, role FROM profiles WHERE id = ${userId}`;
  if (!profile) throw new Error(`No profile ${userId}`);
  if (profile.role !== "free_user") throw new Error(`${profile.email} is ${profile.role}, not free_user; use admin reassignment`);
  const [{ leads }] = await sql`SELECT count(*)::int AS leads FROM leads WHERE user_id = ${userId}`;
  if (leads > 0) throw new Error(`${profile.email} has ${leads} lead(s); unassign through the lead instead`);

  const [cp] = await sql`SELECT id, advisor_id FROM client_profiles WHERE user_id = ${userId}`;
  const open = await sql`SELECT id, advisor_id, started_at FROM advisor_assignments WHERE client_user_id = ${userId} AND ended_at IS NULL`;
  console.log(`${profile.email} (${userId}) [${profile.role}]`);
  console.log(`  client_profiles ${cp?.id ?? "none"}: advisor_id ${cp?.advisor_id ?? "null"} -> null`);
  for (const a of open) console.log(`  advisor_assignments ${a.id}: advisor ${a.advisor_id}, started ${a.started_at.toISOString()} -> ended_at now()`);
  if (!cp?.advisor_id && open.length === 0) { console.log("Nothing to change."); }
  else if (dryRun) { console.log("Dry run: no rows written."); }
  else {
    await sql.begin(async (tx) => {
      const updated = await tx`
        UPDATE client_profiles SET advisor_id = NULL, updated_at = now()
        WHERE user_id = ${userId} AND advisor_id IS NOT NULL RETURNING id`;
      const closed = await tx`
        UPDATE advisor_assignments SET ended_at = now()
        WHERE client_user_id = ${userId} AND ended_at IS NULL RETURNING id, ended_at`;
      console.log(`Cleared advisor on ${updated.length} client_profiles row(s); closed ${closed.length} assignment row(s).`);
      for (const r of closed) console.log(`  ${r.id} ended_at ${r.ended_at.toISOString()}`);
    });
  }
} finally {
  await sql.end();
}
