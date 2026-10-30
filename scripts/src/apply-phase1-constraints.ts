import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const sql = postgres(connectionString, { max: 1 });

const checkConstraints = [
  {
    table: "profiles",
    name: "profiles_role_check",
    values: ["free_user", "investment_client", "advisor", "super_admin"],
    ddl: "ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('free_user', 'investment_client', 'advisor', 'super_admin'))",
  },
  {
    table: "client_profiles",
    name: "client_profiles_status_check",
    values: ["active", "paused", "churned"],
    ddl: "ALTER TABLE client_profiles ADD CONSTRAINT client_profiles_status_check CHECK (status IN ('active', 'paused', 'churned'))",
  },
  {
    table: "financial_goals",
    name: "financial_goals_lifecycle_check",
    values: ["active", "completed", "cancelled"],
    ddl: "ALTER TABLE financial_goals ADD CONSTRAINT financial_goals_lifecycle_check CHECK (status IN ('active', 'completed', 'cancelled'))",
  },
  {
    table: "advised_plans",
    name: "advised_plans_status_check",
    values: ["scenario", "inforce", "matured", "surrender"],
    ddl: "ALTER TABLE advised_plans ADD CONSTRAINT advised_plans_status_check CHECK (status IN ('scenario', 'inforce', 'matured', 'surrender'))",
  },
  {
    table: "leads",
    name: "leads_status_check",
    values: ["unassigned", "active", "cold", "churned", "client"],
    ddl: "ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN ('unassigned', 'active', 'cold', 'churned', 'client'))",
  },
  {
    table: "health_scores",
    name: "health_scores_tier_check",
    values: ["free", "client"],
    ddl: "ALTER TABLE health_scores ADD CONSTRAINT health_scores_tier_check CHECK (tier IN ('free', 'client'))",
  },
] as const;

const uniqueConstraints = [
  {
    table: "client_budget_months",
    name: "client_budget_months_user_id_month_unique",
    columns: ["user_id", "month"],
    ddl: "ALTER TABLE client_budget_months ADD CONSTRAINT client_budget_months_user_id_month_unique UNIQUE (user_id, month)",
  },
  {
    table: "net_worth_snapshots",
    name: "net_worth_snapshots_user_date_unique",
    columns: ["user_id", "snapshot_date"],
    ddl: "ALTER TABLE net_worth_snapshots ADD CONSTRAINT net_worth_snapshots_user_date_unique UNIQUE (user_id, snapshot_date)",
  },
  {
    table: "health_scores",
    name: "health_scores_user_date_tier_unique",
    columns: ["user_id", "score_date", "tier"],
    ddl: "ALTER TABLE health_scores ADD CONSTRAINT health_scores_user_date_tier_unique UNIQUE (user_id, score_date, tier)",
  },
  {
    table: "goal_progress_snapshots",
    name: "goal_progress_snapshots_unique",
    columns: ["goal_id", "snapshot_date"],
    ddl: "ALTER TABLE goal_progress_snapshots ADD CONSTRAINT goal_progress_snapshots_unique UNIQUE (goal_id, snapshot_date)",
  },
] as const;

try {
  await sql.begin(async (tx) => {
    const audit = await tx`
      SELECT
        (SELECT count(*) FROM profiles WHERE role NOT IN ('free_user', 'investment_client', 'advisor', 'super_admin'))::int AS invalid_roles,
        (SELECT count(*) FROM client_profiles WHERE status NOT IN ('active', 'paused', 'churned'))::int AS invalid_client_statuses,
        (SELECT count(*) FROM financial_goals WHERE status NOT IN ('active', 'completed', 'cancelled'))::int AS invalid_goal_statuses,
        (SELECT count(*) FROM advised_plans WHERE status NOT IN ('scenario', 'inforce', 'matured', 'surrender'))::int AS invalid_plan_statuses,
        (SELECT count(*) FROM leads WHERE status NOT IN ('unassigned', 'active', 'cold', 'churned', 'client'))::int AS invalid_lead_statuses,
        (SELECT count(*) FROM health_scores WHERE tier NOT IN ('free', 'client'))::int AS invalid_health_tiers,
        (SELECT count(*) FROM (SELECT 1 FROM client_budget_months GROUP BY user_id, month HAVING count(*) > 1) d)::int AS duplicate_budgets,
        (SELECT count(*) FROM (SELECT 1 FROM net_worth_snapshots GROUP BY user_id, snapshot_date HAVING count(*) > 1) d)::int AS duplicate_net_worth,
        (SELECT count(*) FROM (SELECT 1 FROM health_scores GROUP BY user_id, score_date, tier HAVING count(*) > 1) d)::int AS duplicate_health_scores,
        (SELECT count(*) FROM (SELECT 1 FROM goal_progress_snapshots GROUP BY goal_id, snapshot_date HAVING count(*) > 1) d)::int AS duplicate_goal_progress
    `;
    const values = Object.values(audit[0]).map(Number);
    if (values.some((value) => value !== 0)) {
      throw new Error(`P1 pre-constraint audit did not pass: ${JSON.stringify(audit[0])}`);
    }
    console.log("P1 pre-constraint audit passed:", JSON.stringify(audit[0]));

    for (const constraint of checkConstraints) {
      const existing = await tx`
        SELECT pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conname = ${constraint.name}
          AND conrelid = to_regclass(${"public." + constraint.table})
      `;
      if (existing.length) {
        const literals = [...existing[0].definition.matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
        if (JSON.stringify(literals) !== JSON.stringify([...constraint.values].sort())) {
          throw new Error(`Existing constraint ${constraint.name} has an unexpected definition.`);
        }
        continue;
      }
      await tx.unsafe(constraint.ddl);
      console.log(`Added CHECK ${constraint.table}.${constraint.name}.`);
    }

    for (const constraint of uniqueConstraints) {
      const existing = await tx`
        SELECT pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conname = ${constraint.name}
          AND conrelid = to_regclass(${"public." + constraint.table})
      `;
      if (existing.length) {
        const definition = existing[0].definition.toLowerCase().replaceAll('"', "").replaceAll(" ", "");
        const expectedColumns = [...constraint.columns].join(",");
        if (!definition.includes(`unique(${expectedColumns})`)) {
          throw new Error(`Existing constraint ${constraint.name} has an unexpected definition.`);
        }
        continue;
      }
      await tx.unsafe(constraint.ddl);
      console.log(`Added UNIQUE ${constraint.table}.${constraint.name}.`);
    }
  });
} finally {
  await sql.end();
}
