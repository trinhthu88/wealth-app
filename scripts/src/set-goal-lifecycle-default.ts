import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const sql = postgres(connectionString, { max: 1 });

try {
  const [before] = await sql`
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_goals'
      AND column_name = 'status'
  `;
  if (!before) throw new Error("financial_goals.status was not found");
  console.log(`financial_goals.status default before: ${before.column_default ?? "none"}`);

  await sql`ALTER TABLE financial_goals ALTER COLUMN status SET DEFAULT 'active'`;

  const [after] = await sql`
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_goals'
      AND column_name = 'status'
  `;
  if (after?.column_default !== "'active'::text") {
    throw new Error(`Unexpected financial_goals.status default after update: ${after?.column_default}`);
  }
  console.log("financial_goals.status default is now active.");
} finally {
  await sql.end();
}
