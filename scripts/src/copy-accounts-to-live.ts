/**
 * Copies chosen accounts' data from one database (development) into another (live), so people
 * who have been using the development app find their own data on the live site.
 *
 * Safety rules:
 *  - Nothing creates sign-ins. Each person signs up on the live site first; their live account is
 *    found by email and the development data is attached to it.
 *  - Dry run by default: the whole copy runs inside one transaction on the live database and is
 *    rolled back, so every reference is checked without changing anything. Add --apply to commit.
 *  - Refuses to copy into a live account that already has its own data (goals, holdings, budget
 *    months, plans, messages...), so a second run can never duplicate rows.
 *  - Never grants super_admin: a live super admin keeps that role; anyone else takes their
 *    development role, except that a development super_admin becomes free_user.
 *  - Only the listed accounts are copied. A row that also points at someone not listed is left
 *    out, or the reference is cleared when it is only a side detail (who uploaded, who entered).
 *
 * Usage:
 *   SOURCE_DATABASE_URL=… TARGET_DATABASE_URL=… pnpm --filter @workspace/scripts run copy-accounts-to-live -- \
 *     --accounts "dev@example.com, other-dev@example.com=other-live@example.com" [--apply]
 *   Two steps when one machine can't reach both databases:
 *     SOURCE_DATABASE_URL=… … -- --accounts "…" --export=./account-copy/bundle.json
 *     TARGET_DATABASE_URL=… … -- --import=./account-copy/bundle.json [--apply]
 *   `dev=live` copies a development account into a live account with a different email.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import pg from "pg";

// Dates stay as the text Postgres sent (no time-zone shift); numerics already arrive as text.
pg.types.setTypeParser(1082, (v) => v);

type Row = Record<string, unknown>;

interface TableSpec {
  table: string;
  /** Columns that say whose row this is: at least one must be a copied account, and none may be someone else. */
  owner?: string[];
  /** User columns that are side details: mapped when copied, cleared when they point at someone else. */
  secondary?: string[];
  /** The row belongs under a parent row that must itself be copied. */
  parent?: { column: string; table: string };
  /** References to other copied rows that are cleared when that row isn't copied. */
  optionalRefs?: Array<{ column: string; table: string }>;
  /** One row per user: merged into a row the live sign-in may already have created. */
  singleton?: boolean;
  /** Written automatically while someone uses the app; the live copy's rows are replaced. */
  auto?: boolean;
}

// Load order respects every foreign key. Legacy tables the app no longer reads are left out.
const TABLES: TableSpec[] = [
  { table: "client_profiles", owner: ["user_id"], secondary: ["advisor_id"], singleton: true },
  { table: "memberships", owner: ["user_id"], singleton: true },
  { table: "user_engagement", owner: ["user_id"], singleton: true },
  { table: "financial_goals", owner: ["user_id"] },
  { table: "client_holdings", owner: ["user_id"] },
  { table: "client_holding_transactions", owner: ["user_id"], parent: { column: "holding_id", table: "client_holdings" } },
  { table: "goal_holding_links", owner: ["user_id"], parent: { column: "goal_id", table: "financial_goals" } },
  { table: "goal_progress_snapshots", owner: ["user_id"], parent: { column: "goal_id", table: "financial_goals" }, auto: true },
  { table: "advised_plans", owner: ["user_id"], secondary: ["advisor_id"] },
  { table: "advised_plan_statements", owner: ["user_id"], secondary: ["entered_by"], parent: { column: "advised_plan_id", table: "advised_plans" } },
  { table: "advised_plan_holdings", owner: ["user_id"], parent: { column: "advised_plan_id", table: "advised_plans" }, optionalRefs: [{ column: "statement_id", table: "advised_plan_statements" }] },
  { table: "advised_plan_transactions", owner: ["user_id"], parent: { column: "advised_plan_id", table: "advised_plans" }, optionalRefs: [{ column: "statement_id", table: "advised_plan_statements" }] },
  { table: "client_budget_months", owner: ["user_id"] },
  { table: "assets", owner: ["user_id"] },
  { table: "liabilities", owner: ["user_id"] },
  { table: "net_worth_snapshots", owner: ["user_id"], secondary: ["created_by"], auto: true },
  { table: "scenario_runs", owner: ["user_id"], optionalRefs: [{ column: "linked_goal_id", table: "financial_goals" }] },
  { table: "financial_plans", owner: ["client_id"], secondary: ["advisor_id"] },
  { table: "plan_milestones", parent: { column: "plan_id", table: "financial_plans" }, optionalRefs: [{ column: "linked_goal_id", table: "financial_goals" }] },
  { table: "milestone_comments", owner: ["user_id"], parent: { column: "milestone_id", table: "plan_milestones" } },
  { table: "conversations", owner: ["client_id", "advisor_id"] },
  { table: "messages", secondary: ["sender_id"], parent: { column: "conversation_id", table: "conversations" } },
  { table: "sol_conversations", owner: ["user_id"] },
  { table: "sol_messages", parent: { column: "conversation_id", table: "sol_conversations" } },
  { table: "documents", owner: ["user_id"], secondary: ["uploaded_by"] },
  { table: "advisor_tasks", owner: ["advisor_id", "client_id"], optionalRefs: [{ column: "goal_id", table: "financial_goals" }] },
  { table: "leads", owner: ["user_id"], secondary: ["assigned_advisor_id", "converted_user_id"] },
  { table: "conversion_checkpoints", owner: ["user_id"], optionalRefs: [{ column: "lead_id", table: "leads" }], auto: true },
  { table: "notifications", owner: ["user_id"] },
  { table: "health_scores", owner: ["user_id"], auto: true },
  { table: "advisor_assignments", owner: ["client_user_id", "advisor_id"], secondary: ["assigned_by"] },
];

// Profile fields carried over. Identity (id, email) stays the live sign-in's; role is decided below.
const PROFILE_FIELDS = [
  "full_name", "avatar_url", "preferred_currency", "country_code", "is_expat", "onboarding_complete",
  "risk_profile", "date_of_birth", "created_at",
];

export interface AccountPair { source: string; target: string }

export interface Bundle {
  version: 1;
  exportedAt: string;
  accounts: Array<{ sourceEmail: string; targetEmail: string; sourceId: string; profile: Row }>;
  tables: Record<string, Row[]>;
  /**
   * Development profiles of people not being copied. A side reference to one of them is linked to
   * the live account with the same email if there is one, and cleared otherwise.
   */
  otherSourceUsers: Array<{ id: string; email: string }>;
}

export function parseAccounts(value: string): AccountPair[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean).map((item) => {
    const [source, target] = item.split("=").map((s) => s.trim().toLowerCase());
    return { source, target: target || source };
  });
}

async function columnsOf(client: pg.ClientBase, table: string): Promise<Map<string, { type: string; generated: boolean }>> {
  const { rows } = await client.query(
    `select column_name, data_type, column_default from information_schema.columns where table_schema = 'public' and table_name = $1`,
    [table],
  );
  return new Map(rows.map((r) => [r.column_name as string, {
    type: r.data_type as string,
    generated: typeof r.column_default === "string" && r.column_default.startsWith("nextval("),
  }]));
}

/** Reads every copied account's rows from the source database. */
export async function exportAccounts(source: pg.Pool, pairs: AccountPair[]): Promise<Bundle> {
  const client = await source.connect();
  try {
    const { rows: profiles } = await client.query(`select * from profiles where lower(email) = any($1)`, [pairs.map((p) => p.source)]);
    const byEmail = new Map(profiles.map((p) => [String(p.email).toLowerCase(), p as Row]));
    const missing = pairs.filter((p) => !byEmail.has(p.source)).map((p) => p.source);
    if (missing.length) throw new Error(`Not found in the source database: ${missing.join(", ")}`);

    const ids = new Set(profiles.map((p) => p.id as string));
    const { rows: others } = await client.query(`select id, email from profiles where not (id = any($1))`, [[...ids]]);

    const tables: Record<string, Row[]> = {};
    const kept = new Map<string, Set<string>>(); // table -> copied row ids
    for (const spec of TABLES) {
      const cols = await columnsOf(client, spec.table);
      if (cols.size === 0) { tables[spec.table] = []; continue; }
      let rows: Row[];
      if (spec.owner) {
        const where = spec.owner.filter((c) => cols.has(c)).map((c) => `${c} = any($1)`).join(" or ");
        rows = (await client.query(`select * from ${spec.table} where ${where}`, [[...ids]])).rows;
        rows = rows.filter((r) => spec.owner!.every((c) => r[c] == null || ids.has(r[c] as string)));
      } else {
        const parentIds = [...(kept.get(spec.parent!.table) ?? [])];
        rows = parentIds.length ? (await client.query(`select * from ${spec.table} where ${spec.parent!.column} = any($1)`, [parentIds])).rows : [];
      }
      if (spec.parent && spec.owner) {
        const parents = kept.get(spec.parent.table) ?? new Set();
        rows = rows.filter((r) => r[spec.parent!.column] == null || parents.has(r[spec.parent!.column] as string));
      }
      tables[spec.table] = rows;
      if (cols.has("id")) kept.set(spec.table, new Set(rows.map((r) => String(r.id))));
    }
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts: pairs.map((p) => {
        const profile = byEmail.get(p.source)!;
        return { sourceEmail: p.source, targetEmail: p.target, sourceId: profile.id as string, profile };
      }),
      tables,
      otherSourceUsers: others.map((r) => ({ id: r.id as string, email: String(r.email).toLowerCase() })),
    };
  } finally {
    client.release();
  }
}

export interface CopyReport {
  applied: boolean;
  accounts: Array<{ sourceEmail: string; targetEmail: string; role: string }>;
  copied: Record<string, number>;
  clearedReferences: number;
  /** Side references to people not in this run, linked to their live account by email. */
  linkedReferences: number;
}

/** Writes a bundle into the target database, in one transaction; rolled back unless apply. */
export async function importBundle(target: pg.Pool, bundle: Bundle, apply: boolean): Promise<CopyReport> {
  const client = await target.connect();
  try {
    await client.query("begin");
    const { rows: live } = await client.query(`select id, email, role from profiles where lower(email) = any($1)`, [bundle.accounts.map((a) => a.targetEmail)]);
    const liveByEmail = new Map(live.map((p) => [String(p.email).toLowerCase(), p]));
    const notSignedUp = bundle.accounts.filter((a) => !liveByEmail.has(a.targetEmail)).map((a) => a.targetEmail);
    if (notSignedUp.length) {
      throw new Error(`These people must sign up on the live site first: ${notSignedUp.join(", ")}`);
    }

    const idMap = new Map(bundle.accounts.map((a) => [a.sourceId, liveByEmail.get(a.targetEmail)!.id as string]));
    const liveIds = [...idMap.values()];
    // People copied in an earlier run (or who signed up on their own) are found by email.
    const otherEmails = bundle.otherSourceUsers.map((o) => o.email);
    const { rows: liveOthers } = otherEmails.length
      ? await client.query(`select id, lower(email) as email from profiles where lower(email) = any($1)`, [otherEmails])
      : { rows: [] as Array<{ id: string; email: string }> };
    const liveIdByEmail = new Map(liveOthers.map((r) => [r.email as string, r.id as string]));
    const linkedOthers = new Map<string, string>();
    for (const o of bundle.otherSourceUsers) if (liveIdByEmail.has(o.email)) linkedOthers.set(o.id, liveIdByEmail.get(o.email)!);
    const others = new Set(bundle.otherSourceUsers.map((o) => o.id));

    // A live account that already has its own data is never written over.
    const dataTables = TABLES.filter((s) => s.owner && !s.singleton && !s.auto && s.table !== "advisor_tasks" && s.table !== "conversations" && s.table !== "advisor_assignments");
    const conflicts: string[] = [];
    for (const spec of dataTables) {
      const cols = await columnsOf(client, spec.table);
      const where = spec.owner!.filter((c) => cols.has(c)).map((c) => `${c} = any($1)`).join(" or ");
      if (!where) continue;
      const { rows } = await client.query(`select count(*)::int as n from ${spec.table} where ${where}`, [liveIds]);
      if (rows[0].n > 0) conflicts.push(`${spec.table} (${rows[0].n})`);
    }
    if (conflicts.length) {
      throw new Error(`The live accounts already have data, so nothing was copied: ${conflicts.join(", ")}`);
    }

    // Profiles: carry over the person's details and role, never super_admin.
    const accounts: CopyReport["accounts"] = [];
    for (const a of bundle.accounts) {
      const liveProfile = liveByEmail.get(a.targetEmail)!;
      const sourceRole = String(a.profile.role);
      const role = liveProfile.role === "super_admin" ? "super_admin" : sourceRole === "super_admin" ? "free_user" : sourceRole;
      const profileCols = await columnsOf(client, "profiles");
      const fields = PROFILE_FIELDS.filter((f) => profileCols.has(f) && f in a.profile);
      const sets = [...fields.map((f, i) => `${f} = $${i + 2}`), `role = $${fields.length + 2}`, `updated_at = now()`];
      await client.query(`update profiles set ${sets.join(", ")} where id = $1`, [liveProfile.id, ...fields.map((f) => a.profile[f]), role]);
      accounts.push({ sourceEmail: a.sourceEmail, targetEmail: a.targetEmail, role });
    }

    const copied: Record<string, number> = {};
    let clearedReferences = 0;
    let linkedReferences = 0;
    const included = new Map<string, Set<string>>();
    const mapUser = (value: unknown): unknown => (typeof value === "string" && idMap.has(value) ? idMap.get(value) : value);

    for (const spec of TABLES) {
      const rows = bundle.tables[spec.table] ?? [];
      const cols = await columnsOf(client, spec.table);
      if (cols.size === 0 || rows.length === 0) { copied[spec.table] = 0; continue; }
      if (spec.auto) {
        const where = (spec.owner ?? []).filter((c) => cols.has(c)).map((c) => `${c} = any($1)`).join(" or ");
        if (where) await client.query(`delete from ${spec.table} where ${where}`, [liveIds]);
      }
      const insertCols = [...cols.keys()].filter((c) => !cols.get(c)!.generated && rows.some((r) => c in r));
      let n = 0;
      for (const original of rows) {
        const row: Row = { ...original };
        for (const c of spec.owner ?? []) row[c] = mapUser(row[c]);
        for (const c of spec.secondary ?? []) {
          const v = row[c];
          if (typeof v === "string" && linkedOthers.has(v)) { row[c] = linkedOthers.get(v); linkedReferences++; }
          else if (typeof v === "string" && others.has(v)) { row[c] = null; clearedReferences++; }
          else row[c] = mapUser(v);
        }
        if (spec.parent && row[spec.parent.column] != null && !included.get(spec.parent.table)?.has(String(row[spec.parent.column]))) continue;
        for (const ref of spec.optionalRefs ?? []) {
          if (row[ref.column] != null && !included.get(ref.table)?.has(String(row[ref.column]))) { row[ref.column] = null; clearedReferences++; }
        }
        const values = insertCols.map((c) => {
          const v = row[c];
          const type = cols.get(c)!.type;
          return (type === "jsonb" || type === "json") && v != null ? JSON.stringify(v) : v;
        });
        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(", ");
        if (spec.singleton) {
          const updates = insertCols.filter((c) => c !== "id" && c !== "user_id").map((c) => `${c} = excluded.${c}`).join(", ");
          await client.query(
            `insert into ${spec.table} (${insertCols.join(", ")}) values (${placeholders}) on conflict (user_id) do update set ${updates}`,
            values,
          );
        } else {
          await client.query(`insert into ${spec.table} (${insertCols.join(", ")}) values (${placeholders})`, values);
        }
        if (cols.has("id")) {
          if (!included.has(spec.table)) included.set(spec.table, new Set());
          included.get(spec.table)!.add(String(row.id));
        }
        n++;
      }
      copied[spec.table] = n;
    }

    await client.query(apply ? "commit" : "rollback");
    return { applied: apply, accounts, copied, clearedReferences, linkedReferences };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const i = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(prefix));
  if (i === -1) return undefined;
  const a = process.argv[i];
  return a.startsWith(prefix) ? a.slice(prefix.length) : process.argv[i + 1];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const exportPath = arg("export");
  const importPath = arg("import");
  const accountsArg = arg("accounts");

  let bundle: Bundle;
  if (importPath) {
    bundle = JSON.parse(readFileSync(importPath, "utf8"));
  } else {
    if (!accountsArg) throw new Error('Pass --accounts "dev@example.com, other@example.com=live@example.com"');
    if (!process.env.SOURCE_DATABASE_URL) throw new Error("Set SOURCE_DATABASE_URL to the development database.");
    const source = new pg.Pool({ connectionString: process.env.SOURCE_DATABASE_URL });
    try { bundle = await exportAccounts(source, parseAccounts(accountsArg)); } finally { await source.end(); }
    const counts = Object.entries(bundle.tables).filter(([, r]) => r.length).map(([t, r]) => `${t}=${r.length}`).join(" ");
    console.log(`Exported ${bundle.accounts.length} accounts: ${counts}`);
    if (exportPath) {
      mkdirSync(dirname(exportPath), { recursive: true });
      writeFileSync(exportPath, JSON.stringify(bundle), { mode: 0o600 });
      console.log(`Wrote ${exportPath}. It contains personal data: keep it out of git and delete it after the import.`);
      return;
    }
  }

  if (!process.env.TARGET_DATABASE_URL) throw new Error("Set TARGET_DATABASE_URL to the live database.");
  if (process.env.TARGET_DATABASE_URL === process.env.SOURCE_DATABASE_URL) throw new Error("Source and target are the same database.");
  const target = new pg.Pool({ connectionString: process.env.TARGET_DATABASE_URL });
  try {
    const report = await importBundle(target, bundle, apply);
    console.log(`${report.applied ? "Applied" : "Dry run (rolled back)"}:`);
    for (const a of report.accounts) console.log(`  ${a.sourceEmail} -> ${a.targetEmail} as ${a.role}`);
    console.log(`  copied: ${Object.entries(report.copied).filter(([, n]) => n).map(([t, n]) => `${t}=${n}`).join(" ") || "nothing"}`);
    console.log(`  references linked to people already on the live site: ${report.linkedReferences}`);
    console.log(`  references to people not on the live site, cleared: ${report.clearedReferences}`);
    if (!report.applied) console.log("Nothing was changed. Run again with --apply to copy.");
  } finally {
    await target.end();
  }
}

const isCli = process.argv[1]?.endsWith("copy-accounts-to-live.ts");
if (isCli) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
