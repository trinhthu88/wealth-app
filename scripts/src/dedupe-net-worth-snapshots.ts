import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const sql = postgres(connectionString, { max: 1 });

try {
  const groups = await sql`
    SELECT count(*)::int AS groups, coalesce(sum(rows - 1), 0)::int AS excess_rows
    FROM (
      SELECT count(*) AS rows
      FROM net_worth_snapshots
      GROUP BY user_id, snapshot_date
      HAVING count(*) > 1
    ) duplicates
  `;
  console.log("Audited net-worth duplicate keys:", JSON.stringify(groups[0]));

  const deleted = await sql`
    WITH ranked AS (
      SELECT id,
        row_number() OVER (
          PARTITION BY user_id, snapshot_date
          ORDER BY created_at DESC, id DESC
        ) AS row_number
      FROM net_worth_snapshots
    )
    DELETE FROM net_worth_snapshots AS snapshots
    USING ranked
    WHERE snapshots.id = ranked.id
      AND ranked.row_number > 1
    RETURNING snapshots.id
  `;
  console.log(`Removed ${deleted.length} older duplicate net-worth snapshot rows; latest rows were kept.`);
} finally {
  await sql.end();
}
