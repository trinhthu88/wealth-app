// Phase 5 — one risk vocabulary: conservative | balanced | growth.
// Lowercases values and maps moderate -> balanced, aggressive -> growth in
// client_profiles.risk_profile (owner) and the deprecated profiles.risk_profile.
// Skips onboardtest_*@example.com test accounts (listed in PROGRESS.md for
// cleanup). Idempotent; `--dry-run` lists changes without writing.
import postgres from "postgres";

const dryRun = process.argv.includes("--dry-run");
// Optional `--user=<id>` (repeatable) limits the run to those users (used by tests).
const onlyUsers = process.argv.filter((a) => a.startsWith("--user=")).map((a) => a.slice("--user=".length));
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const sql = postgres(connectionString, { max: 1 });
const scope = () => (onlyUsers.length ? sql`AND p.id IN ${sql(onlyUsers)}` : sql``);
const TEST_EMAIL = "onboardtest\\_%@example.com";

try {
  const target = (col: string) => sql.unsafe(`CASE lower(${col}) WHEN 'moderate' THEN 'balanced' WHEN 'aggressive' THEN 'growth' ELSE lower(${col}) END`);
  const unmapped = await sql`
    SELECT 'profiles' AS tbl, p.email, p.risk_profile AS value FROM profiles p
    WHERE p.risk_profile IS NOT NULL AND p.risk_profile <> '' AND p.email NOT LIKE ${TEST_EMAIL} ${scope()}
      AND ${target("p.risk_profile")} NOT IN ('conservative', 'balanced', 'growth')
    UNION ALL
    SELECT 'client_profiles', p.email, c.risk_profile FROM client_profiles c JOIN profiles p ON p.id = c.user_id
    WHERE c.risk_profile IS NOT NULL AND p.email NOT LIKE ${TEST_EMAIL} ${scope()}
      AND ${target("c.risk_profile")} NOT IN ('conservative', 'balanced', 'growth')
  `;
  if (unmapped.length) throw new Error(`Unmapped risk values: ${JSON.stringify(unmapped)}`);

  const changes = await sql`
    SELECT 'profiles' AS tbl, p.id, p.email, p.risk_profile AS "from", ${target("p.risk_profile")} AS "to" FROM profiles p
    WHERE p.risk_profile IS NOT NULL AND p.risk_profile <> '' AND p.email NOT LIKE ${TEST_EMAIL} ${scope()}
      AND p.risk_profile <> ${target("p.risk_profile")}
    UNION ALL
    SELECT 'client_profiles', c.user_id, p.email, c.risk_profile, ${target("c.risk_profile")} FROM client_profiles c JOIN profiles p ON p.id = c.user_id
    WHERE c.risk_profile IS NOT NULL AND p.email NOT LIKE ${TEST_EMAIL} ${scope()}
      AND c.risk_profile <> ${target("c.risk_profile")}
    ORDER BY 1, 3
  `;
  console.log(`Risk values to normalize: ${changes.length}`);
  for (const r of changes) console.log(`  ${r.tbl} ${r.id} ${r.email}: ${r.from} -> ${r.to}`);
  if (dryRun) { console.log("Dry run: no rows written."); }
  else {
    await sql.begin(async (tx) => {
      const a = await tx`
        UPDATE profiles p SET risk_profile = ${target("p.risk_profile")}, updated_at = now()
        WHERE p.risk_profile IS NOT NULL AND p.risk_profile <> '' AND p.email NOT LIKE ${TEST_EMAIL} ${scope()}
          AND p.risk_profile <> ${target("p.risk_profile")}
        RETURNING p.id, p.risk_profile`;
      const b = await tx`
        UPDATE client_profiles c SET risk_profile = ${target("c.risk_profile")}, updated_at = now()
        FROM profiles p WHERE p.id = c.user_id AND c.risk_profile IS NOT NULL AND p.email NOT LIKE ${TEST_EMAIL} ${scope()}
          AND c.risk_profile <> ${target("c.risk_profile")}
        RETURNING c.user_id AS id, c.risk_profile`;
      console.log(`Updated ${a.length} profiles and ${b.length} client_profiles rows.`);
      for (const r of [...a, ...b]) console.log(`  ${r.id} -> ${r.risk_profile}`);
    });
  }
} finally {
  await sql.end();
}
