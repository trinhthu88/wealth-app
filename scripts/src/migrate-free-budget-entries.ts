// Phase 7 — migrate free-tier monthly budgets into the shared table.
// Safe by default: without --apply this only reports the planned copy counts.
import postgres from "postgres";

type LegacyBudgetRow = {
  user_id: string;
  period_month: string;
  currency: string;
  income: string | null;
  needs_actual: string | null;
  wants_actual: string | null;
  savings_actual: string | null;
  savings_rate_percent: string | null;
  housing: string | null;
  food: string | null;
  transport: string | null;
  utilities: string | null;
  entertainment: string | null;
  other: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const dryRun = args.includes("--dry-run") || !apply;
const onlyUsers = args.filter((arg) => arg.startsWith("--user=")).map((arg) => arg.slice("--user=".length));

if (apply && args.includes("--dry-run")) throw new Error("Use either --dry-run or --apply, not both.");
if (args.some((arg) => arg.startsWith("--user=") && !arg.slice("--user=".length))) {
  throw new Error("--user requires a profile id.");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const sql = postgres(connectionString, { max: 1 });

const amount = (value: string | null) => Number.parseFloat(value ?? "0") || 0;
const sourceValueFields = [
  "currency", "income", "needs_actual", "wants_actual", "savings_actual",
  "savings_rate_percent", "housing", "food", "transport", "utilities",
  "entertainment", "other", "notes",
] as const;

function signature(row: LegacyBudgetRow): string {
  return JSON.stringify(sourceValueFields.map((field) => row[field]));
}

function scope(alias: string) {
  return onlyUsers.length
    ? sql`AND ${sql(alias)}.user_id IN ${sql(onlyUsers)}`
    : sql``;
}

try {
  const sourceRows = await sql<LegacyBudgetRow[]>`
    SELECT
      b.user_id,
      b.period_month::text AS period_month,
      b.currency,
      b.income,
      b.needs_actual,
      b.wants_actual,
      b.savings_actual,
      b.savings_rate_percent,
      b.housing,
      b.food,
      b.transport,
      b.utilities,
      b.entertainment,
      b.other,
      b.notes,
      b.created_at,
      b.updated_at
    FROM budget_entries b
    JOIN profiles p ON p.id = b.user_id
    WHERE p.role = 'free_user' ${scope("b")}
    ORDER BY b.user_id, b.period_month, b.created_at, b.id
  `;
  const sharedRows = await sql<{ user_id: string; month: string }[]>`
    SELECT m.user_id, m.month::text AS month
    FROM client_budget_months m
    JOIN profiles p ON p.id = m.user_id
    WHERE p.role = 'free_user' ${scope("m")}
  `;

  const grouped = new Map<string, LegacyBudgetRow[]>();
  for (const row of sourceRows) {
    const key = `${row.user_id}\u0000${row.period_month}`;
    const group = grouped.get(key) ?? [];
    group.push(row);
    grouped.set(key, group);
  }
  const existing = new Set(sharedRows.map((row) => `${row.user_id}\u0000${row.month}`));
  const groups = [...grouped.entries()].map(([key, rows]) => ({
    key,
    rows,
    duplicate: rows.length > 1,
    ambiguous: new Set(rows.map(signature)).size > 1,
    sharedConflict: existing.has(key),
  }));
  const duplicateGroups = groups.filter((group) => group.duplicate);
  const ambiguousGroups = groups.filter((group) => group.ambiguous);
  const sharedConflicts = groups.filter((group) => group.sharedConflict);
  const candidates = groups.filter((group) => !group.sharedConflict && !group.ambiguous);
  const duplicateExcessRows = duplicateGroups.reduce((sum, group) => sum + group.rows.length - 1, 0);

  const report = {
    sourceRows: sourceRows.length,
    sourceMonthKeys: groups.length,
    sourceDuplicateGroups: duplicateGroups.length,
    sourceDuplicateExcessRows: duplicateExcessRows,
    ambiguousSourceGroups: ambiguousGroups.length,
    sharedMonthConflictKeys: sharedConflicts.length,
    monthKeysToCopy: candidates.length,
    mode: apply ? "apply" : "dry-run",
  };
  console.log(`Free budget migration ${dryRun ? "dry run" : "apply"}: ${JSON.stringify(report)}`);

  if (dryRun) {
    console.log("Dry run only; no rows written.");
  } else {
    if (ambiguousGroups.length > 0) {
      throw new Error(`${ambiguousGroups.length} duplicate source month groups have different values; no rows were written.`);
    }
    const copied = await sql.begin(async (tx) => {
      let count = 0;
      for (const group of candidates) {
        const row = group.rows[0];
        const income = amount(row.income);
        const expenses = [
          row.housing, row.food, row.transport, row.utilities, row.entertainment, row.other,
        ].reduce((sum, value) => sum + amount(value), 0);
        const surplus = row.savings_actual == null ? income - expenses : amount(row.savings_actual);
        const savingsRate = row.savings_rate_percent == null
          ? (income > 0 ? (surplus / income) * 100 : 0)
          : amount(row.savings_rate_percent);

        const [inserted] = await tx`
          INSERT INTO client_budget_months (
            user_id, month, currency,
            primary_income, secondary_income, rental_income, other_income,
            housing, utilities, transport, insurance, food_dining,
            entertainment, shopping, health, education, other_expenses,
            debt_payments, investment_contributions,
            total_income, total_expenses, total_investments, net_surplus, savings_rate_pct,
            notes, created_at, updated_at
          ) VALUES (
            ${row.user_id}, ${row.period_month}::date, ${row.currency || "USD"},
            ${row.income ?? "0"}, '0', '0', '0',
            ${row.housing ?? "0"}, ${row.utilities ?? "0"}, ${row.transport ?? "0"}, '0', ${row.food ?? "0"},
            ${row.entertainment ?? "0"}, '0', '0', '0', ${row.other ?? "0"},
            '0', ${"[]"}::jsonb,
            ${row.income ?? "0"}, ${String(expenses)}, '0', ${String(surplus)}, ${String(savingsRate)},
            ${row.notes}, ${row.created_at}, ${row.updated_at}
          )
          ON CONFLICT (user_id, month) DO NOTHING
          RETURNING id
        `;
        if (inserted) count += 1;
      }
      return count;
    });
    console.log(`Inserted ${copied} shared budget month rows; existing shared months were never overwritten.`);
    console.log(`Rows skipped for existing shared months: ${sharedConflicts.length}; duplicate source excess rows retained in budget_entries: ${duplicateExcessRows}.`);
  }
} finally {
  await sql.end();
}
