import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const sql = postgres(connectionString, { max: 1 });

try {
  await sql.begin(async (tx) => {
    await tx`ALTER TABLE health_scores ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free'`;

    const changedTier = await tx`
      UPDATE health_scores
      SET tier = CASE WHEN details IS NOT NULL THEN 'client' ELSE 'free' END
      WHERE tier IS DISTINCT FROM CASE WHEN details IS NOT NULL THEN 'client' ELSE 'free' END
      RETURNING id
    `;
    console.log(`Backfilled ${changedTier.length} health-score tier values from details.`);

    const groups = await tx`
      SELECT count(*)::int AS groups, coalesce(sum(rows - 1), 0)::int AS excess_rows
      FROM (
        SELECT count(*) AS rows
        FROM health_scores
        GROUP BY user_id, score_date, tier
        HAVING count(*) > 1
      ) duplicates
    `;
    console.log("Audited health-score duplicate keys after tier backfill:", JSON.stringify(groups[0]));

    const deleted = await tx`
      WITH ranked AS (
        SELECT id,
          row_number() OVER (
            PARTITION BY user_id, score_date, tier
            ORDER BY created_at DESC, id DESC
          ) AS row_number
        FROM health_scores
      )
      DELETE FROM health_scores AS scores
      USING ranked
      WHERE scores.id = ranked.id
        AND ranked.row_number > 1
      RETURNING scores.id
    `;
    console.log(`Removed ${deleted.length} older duplicate health-score rows; latest rows were kept.`);
  });
} finally {
  await sql.end();
}
