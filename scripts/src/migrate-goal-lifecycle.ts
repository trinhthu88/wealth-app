import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const sql = postgres(connectionString, { max: 1 });

try {
  const unexpected = await sql`
    SELECT status, count(*)::int AS rows
    FROM financial_goals
    WHERE status NOT IN ('active', 'completed', 'cancelled', 'paused', 'on_track', 'behind')
    GROUP BY status
  `;
  if (unexpected.length) {
    throw new Error(`Unmapped financial goal statuses found: ${JSON.stringify(unexpected)}`);
  }

  const before = await sql`
    SELECT status, count(*)::int AS rows
    FROM financial_goals
    WHERE status IN ('paused', 'on_track', 'behind')
    GROUP BY status
    ORDER BY status
  `;
  console.log("Audited legacy financial goal statuses:", JSON.stringify(before));

  const changed = await sql`
    UPDATE financial_goals
    SET status = 'active', updated_at = now()
    WHERE status IN ('paused', 'on_track', 'behind')
    RETURNING id
  `;
  console.log(`Mapped ${changed.length} financial goal rows to lifecycle active.`);
} finally {
  await sql.end();
}
