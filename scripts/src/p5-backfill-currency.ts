// Phase 5 — profiles.preferred_currency is the owner of the preferred currency.
// Copies client_profiles.preferred_display_currency into profiles where profiles
// still holds the default (USD) and the two differ. Idempotent; `--dry-run`
// lists the rows that would change without writing.
import postgres from "postgres";

const dryRun = process.argv.includes("--dry-run");
// Optional `--user=<id>` (repeatable) limits the run to those users (used by tests).
const onlyUsers = process.argv.filter((a) => a.startsWith("--user=")).map((a) => a.slice("--user=".length));
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const sql = postgres(connectionString, { max: 1 });
const scope = () => (onlyUsers.length ? sql`AND p.id IN ${sql(onlyUsers)}` : sql``);

try {
  const candidates = await sql`
    SELECT p.id, p.email, p.preferred_currency AS "from", c.preferred_display_currency AS "to"
    FROM profiles p JOIN client_profiles c ON c.user_id = p.id
    WHERE p.preferred_currency = 'USD' AND c.preferred_display_currency <> p.preferred_currency ${scope()}
    ORDER BY p.email
  `;
  const conflicts = await sql`
    SELECT p.id, p.email, p.preferred_currency, c.preferred_display_currency
    FROM profiles p JOIN client_profiles c ON c.user_id = p.id
    WHERE p.preferred_currency <> 'USD' AND c.preferred_display_currency <> p.preferred_currency ${scope()}
    ORDER BY p.email
  `;
  console.log(`Currency backfill candidates: ${candidates.length}`);
  for (const r of candidates) console.log(`  ${r.id} ${r.email}: ${r.from} -> ${r.to}`);
  console.log(`Kept profiles value (non-default, differs from client_profiles): ${conflicts.length}`);
  for (const r of conflicts) console.log(`  ${r.id} ${r.email}: profiles ${r.preferred_currency}, client_profiles ${r.preferred_display_currency}`);
  if (dryRun) { console.log("Dry run: no rows written."); }
  else {
    const changed = await sql`
      UPDATE profiles p SET preferred_currency = c.preferred_display_currency, updated_at = now()
      FROM client_profiles c
      WHERE c.user_id = p.id AND p.preferred_currency = 'USD' AND c.preferred_display_currency <> p.preferred_currency ${scope()}
      RETURNING p.id, p.preferred_currency
    `;
    console.log(`Updated ${changed.length} profiles rows.`);
    for (const r of changed) console.log(`  ${r.id} -> ${r.preferred_currency}`);
  }
} finally {
  await sql.end();
}
