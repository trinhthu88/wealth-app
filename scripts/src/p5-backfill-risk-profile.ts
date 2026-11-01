// Phase 5 — client_profiles.risk_profile is the owner of the risk profile.
// Copies profiles.risk_profile (as source `self`) where client_profiles has no
// risk value, creating the client_profiles row if it is missing. Values are
// mapped onto conservative | balanced | growth (lowercase; moderate -> balanced,
// aggressive -> growth) as they are copied. Existing client_profiles risk values are never overwritten.
// Skips onboardtest_*@example.com test accounts (listed in PROGRESS.md for
// cleanup). Idempotent; `--dry-run` lists the rows that would change without writing.
import postgres from "postgres";

const dryRun = process.argv.includes("--dry-run");
// Optional `--user=<id>` (repeatable) limits the run to those users (used by tests).
const onlyUsers = process.argv.filter((a) => a.startsWith("--user=")).map((a) => a.slice("--user=".length));
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const sql = postgres(connectionString, { max: 1 });
const mapped = sql.unsafe("CASE lower(p.risk_profile) WHEN 'moderate' THEN 'balanced' WHEN 'aggressive' THEN 'growth' ELSE lower(p.risk_profile) END");
const scope = () => (onlyUsers.length ? sql`AND p.id IN ${sql(onlyUsers)}` : sql``);
const TEST_EMAIL = "onboardtest\\_%@example.com";

try {
  const toUpdate = await sql`
    SELECT p.id, p.email, p.role, ${mapped} AS risk_profile
    FROM profiles p JOIN client_profiles c ON c.user_id = p.id
    WHERE c.risk_profile IS NULL AND p.risk_profile IS NOT NULL AND p.risk_profile <> '' AND p.email NOT LIKE ${TEST_EMAIL} ${scope()}
    ORDER BY p.email
  `;
  const toInsert = await sql`
    SELECT p.id, p.email, p.role, ${mapped} AS risk_profile
    FROM profiles p
    WHERE p.risk_profile IS NOT NULL AND p.risk_profile <> '' AND p.email NOT LIKE ${TEST_EMAIL} ${scope()}
      AND NOT EXISTS (SELECT 1 FROM client_profiles c WHERE c.user_id = p.id)
    ORDER BY p.email
  `;
  console.log(`client_profiles rows to update (risk empty): ${toUpdate.length}`);
  for (const r of toUpdate) console.log(`  ${r.id} ${r.email} [${r.role}]: risk_profile = ${r.risk_profile}, source = self`);
  console.log(`client_profiles rows to create: ${toInsert.length}`);
  for (const r of toInsert) console.log(`  ${r.id} ${r.email} [${r.role}]: risk_profile = ${r.risk_profile}, source = self`);
  if (dryRun) { console.log("Dry run: no rows written."); }
  else {
    await sql.begin(async (tx) => {
      const updated = await tx`
        UPDATE client_profiles c SET risk_profile = ${mapped}, risk_profile_source = 'self', updated_at = now()
        FROM profiles p
        WHERE c.user_id = p.id AND c.risk_profile IS NULL AND p.risk_profile IS NOT NULL AND p.risk_profile <> '' AND p.email NOT LIKE ${TEST_EMAIL} ${scope()}
        RETURNING c.user_id
      `;
      const inserted = await tx`
        INSERT INTO client_profiles (user_id, risk_profile, risk_profile_source)
        SELECT p.id, ${mapped}, 'self' FROM profiles p
        WHERE p.risk_profile IS NOT NULL AND p.risk_profile <> '' AND p.email NOT LIKE ${TEST_EMAIL} ${scope()}
          AND NOT EXISTS (SELECT 1 FROM client_profiles c WHERE c.user_id = p.id)
        ON CONFLICT (user_id) DO NOTHING
        RETURNING user_id
      `;
      console.log(`Updated ${updated.length} and created ${inserted.length} client_profiles rows.`);
      for (const r of [...updated, ...inserted]) console.log(`  ${r.user_id}`);
    });
  }
} finally {
  await sql.end();
}
