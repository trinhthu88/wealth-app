// Phase 5 — client_profiles.onboarding_stage is the owner of onboarding state.
// Rule: onboarding_track_complete = true -> complete; basics saved (the basics
// step stores profiles.country_code) -> profile; else not_started. Only rows
// still at the column default `not_started` are considered, so a stage set by
// the app is never moved. Idempotent; `--dry-run` lists changes without writing.
import postgres from "postgres";

const dryRun = process.argv.includes("--dry-run");
// Optional `--user=<id>` (repeatable) limits the run to those users (used by tests).
const onlyUsers = process.argv.filter((a) => a.startsWith("--user=")).map((a) => a.slice("--user=".length));
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const sql = postgres(connectionString, { max: 1 });
const scope = () => (onlyUsers.length ? sql`AND p.id IN ${sql(onlyUsers)}` : sql``);

try {
  const rows = await sql`
    SELECT c.user_id, p.email, p.role, c.onboarding_track_complete, p.country_code,
      CASE WHEN c.onboarding_track_complete THEN 'complete'
           WHEN p.country_code IS NOT NULL THEN 'profile'
           ELSE 'not_started' END AS target
    FROM client_profiles c LEFT JOIN profiles p ON p.id = c.user_id
    WHERE c.onboarding_stage = 'not_started' ${scope()}
    ORDER BY p.email
  `;
  const changes = rows.filter((r) => r.target !== "not_started");
  console.log(`client_profiles at not_started: ${rows.length}; rows to change: ${changes.length}`);
  for (const r of changes) console.log(`  ${r.user_id} ${r.email} [${r.role}]: not_started -> ${r.target} (track_complete=${r.onboarding_track_complete}, country=${r.country_code ?? "null"})`);
  if (dryRun) { console.log("Dry run: no rows written."); }
  else {
    const changed = await sql`
      UPDATE client_profiles c SET onboarding_stage = CASE
          WHEN c.onboarding_track_complete THEN 'complete'
          WHEN p.country_code IS NOT NULL THEN 'profile' END,
        updated_at = now()
      FROM profiles p
      WHERE p.id = c.user_id AND c.onboarding_stage = 'not_started' ${scope()}
        AND (c.onboarding_track_complete OR p.country_code IS NOT NULL)
      RETURNING c.user_id, c.onboarding_stage
    `;
    console.log(`Updated ${changed.length} client_profiles rows.`);
    for (const r of changed) console.log(`  ${r.user_id} -> ${r.onboarding_stage}`);
  }
} finally {
  await sql.end();
}
