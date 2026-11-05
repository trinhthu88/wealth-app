/**
 * Reconnects people to their old profile on the live site. Their old profile (with its data) is
 * tied to a sign-in that was replaced, so signing in again created a new, empty profile. This
 * moves everything that points at the old profile onto the profile of their current sign-in, takes
 * the old profile's details and role, and removes the old profile row.
 *
 * Runs inside the deployment (it needs the live Clerk key and database). Dry run by default: the
 * whole relink runs in one transaction and is rolled back. Add --apply to commit.
 *
 * Refuses, for that person, when anything is unclear: no current sign-in profile, more than one old
 * profile with data, or a current profile that already has its own data.
 *
 *   RELINK_ACCOUNTS="person@x.com, old-demo@demo.example=new-inbox+alias@gmail.com"
 *   `old=new` when the old profile carries a different email from the person's current sign-in.
 */
import pg from "pg";

pg.types.setTypeParser(1082, (v) => v);

// Written automatically when someone signs in; a fresh profile may already have these.
const AUTOMATIC_TABLES = new Set([
  "client_profiles", "memberships", "user_engagement", "health_scores", "conversion_checkpoints",
  "membership_checkout_sessions", "notifications", "goal_progress_snapshots", "net_worth_snapshots",
]);
// Profile columns that stay the current sign-in's.
const IDENTITY_COLUMNS = new Set(["id", "email", "updated_at"]);
const FREE_LIMITS = { goals: 1, holdings: 5 };

interface Pair { oldEmail: string; signInEmail: string }

export function parsePairs(value: string): Pair[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean).map((item) => {
    const [oldEmail, signInEmail] = item.split("=").map((s) => s.trim().toLowerCase());
    return { oldEmail, signInEmail: signInEmail || oldEmail };
  });
}

async function clerkIdsFor(email: string): Promise<string[]> {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("CLERK_SECRET_KEY is not set; run this inside the deployment.");
  const base = process.env.CLERK_API_URL ?? "https://api.clerk.com/v1";
  const res = await fetch(`${base}/users?email_address=${encodeURIComponent(email)}&limit=10`, {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Could not check ${email} with the sign-in service (HTTP ${res.status}).`);
  return ((await res.json()) as Array<{ id: string }>).map((u) => u.id);
}

/** Every text column, outside profiles, that can hold a user id. */
async function userColumns(client: pg.ClientBase): Promise<Array<{ table: string; column: string }>> {
  const { rows } = await client.query(`
    select c.table_name as table, c.column_name as column
    from information_schema.columns c
    join information_schema.tables t on t.table_name = c.table_name and t.table_schema = c.table_schema
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE' and c.table_name <> 'profiles'
      and c.data_type in ('text', 'character varying')
      and (c.column_name like '%\\_id' or c.column_name like '%\\_by')
    order by 1, 2`);
  return rows;
}

async function rowCounts(client: pg.ClientBase, cols: Array<{ table: string; column: string }>, id: string) {
  const counts: Record<string, number> = {};
  for (const { table, column } of cols) {
    const { rows } = await client.query(`select count(*)::int as n from "${table}" where "${column}" = $1`, [id]);
    if (rows[0].n) counts[table] = (counts[table] ?? 0) + rows[0].n;
  }
  return counts;
}

const describe = (counts: Record<string, number>) =>
  Object.entries(counts).map(([t, n]) => `${t}=${n}`).join(" ") || "nothing";
const dataOnly = (counts: Record<string, number>) =>
  Object.fromEntries(Object.entries(counts).filter(([t]) => !AUTOMATIC_TABLES.has(t)));

export async function relink(pool: pg.Pool, pairs: Pair[], apply: boolean): Promise<string[]> {
  const out: string[] = [];
  const client = await pool.connect();
  try {
    await client.query("begin");
    const cols = await userColumns(client);
    const problems: string[] = [];
    const resolved: Array<{ signInEmail: string; id: string }> = [];
    const superAdmin = (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();

    for (const { oldEmail, signInEmail } of pairs) {
      const signIns = await clerkIdsFor(signInEmail);
      const oldSignIns = oldEmail === signInEmail ? signIns : await clerkIdsFor(oldEmail);
      const { rows: profiles } = await client.query(
        `select * from profiles where lower(email) = any($1) order by created_at`, [[oldEmail, signInEmail]]);

      const current = profiles.filter((p) => String(p.email).toLowerCase() === signInEmail && signIns.includes(p.id));
      if (current.length !== 1) {
        problems.push(`${signInEmail}: ${current.length === 0 ? "no profile for a current sign-in; sign in on the live site once" : "several current sign-ins"}`);
        continue;
      }
      const cur = current[0];
      // Under either address: an old demo profile may already carry the new address.
      const old = profiles.filter((p) => p.id !== cur.id && !signIns.includes(p.id) && !oldSignIns.includes(p.id));
      const withData: Array<{ profile: Record<string, unknown>; counts: Record<string, number> }> = [];
      for (const p of old) {
        const counts = await rowCounts(client, cols, p.id);
        out.push(`${oldEmail}: old profile (role ${p.role}, created ${new Date(p.created_at).toISOString().slice(0, 10)}) has ${describe(counts)}`);
        // A role above free is worth keeping even without rows of its own (an advisor, say).
        if (Object.keys(dataOnly(counts)).length || p.role !== "free_user") withData.push({ profile: p, counts });
      }
      resolved.push({ signInEmail, id: cur.id });
      if (withData.length === 0) { out.push(`${signInEmail}: no old profile with data, nothing to relink`); continue; }
      if (withData.length > 1) { problems.push(`${oldEmail}: ${withData.length} old profiles have data; can't tell which to use`); continue; }

      const curCounts = dataOnly(await rowCounts(client, cols, cur.id));
      if (Object.keys(curCounts).length) {
        problems.push(`${signInEmail}: the current profile already has its own data (${describe(curCounts)}); not merged`);
        continue;
      }

      const from = { ...withData[0].profile };
      // Super admin follows SUPER_ADMIN_EMAIL only, never an old row.
      if (from.role === "super_admin" && signInEmail !== superAdmin) from.role = cur.role;
      // The fresh profile's own automatic rows give way to the old profile's. Only rows it owns:
      // a record that merely mentions it (granted_by and the like) belongs to someone else.
      for (const { table, column } of cols) {
        if (column === "user_id") await client.query(`delete from "${table}" where user_id = $1`, [cur.id]);
      }
      let moved = 0;
      for (const { table, column } of cols) {
        const res = await client.query(`update "${table}" set "${column}" = $1 where "${column}" = $2`, [cur.id, from.id]);
        moved += res.rowCount ?? 0;
      }
      await client.query(`delete from profiles where id = $1`, [from.id]);
      const fields = Object.keys(from).filter((k) => !IDENTITY_COLUMNS.has(k));
      await client.query(
        `update profiles set ${fields.map((f, i) => `"${f}" = $${i + 2}`).join(", ")}, updated_at = now() where id = $1`,
        [cur.id, ...fields.map((f) => from[f])]);
      out.push(`${signInEmail}: relinked to the old profile (role ${from.role}); ${moved} references moved`);
    }

    if (problems.length) {
      await client.query("rollback");
      throw new Error(`Nothing was changed. ${problems.join("; ")}.\n${out.join("\n")}`);
    }

    // Where the relinked data sits against each plan's limits, for the owner to review.
    for (const { signInEmail, id } of resolved) {
      const { rows: [p] } = await client.query(`select id, role from profiles where id = $1`, [id]);
      if (!p) continue;
      const { rows: [g] } = await client.query(`select count(*)::int as n from financial_goals where user_id = $1 and status = 'active'`, [p.id]);
      const { rows: [h] } = await client.query(`select count(*)::int as n from client_holdings where user_id = $1 and is_active`, [p.id]);
      const { rows: [plan] } = await client.query(`select count(*)::int as n from advised_plans where user_id = $1 and status = 'inforce'`, [p.id]);
      const { rows: [m] } = await client.query(`select status, source from memberships where user_id = $1`, [p.id]);
      let line = `${signInEmail}: role ${p.role}, active goals ${g.n}, active holdings ${h.n}`;
      if (p.role === "free_user") {
        const over = [g.n > FREE_LIMITS.goals ? `goals over the free limit of ${FREE_LIMITS.goals}` : "", h.n > FREE_LIMITS.holdings ? `holdings over the free limit of ${FREE_LIMITS.holdings}` : ""].filter(Boolean);
        if (over.length) line += ` (${over.join(", ")})`;
      }
      if (p.role === "investment_client") {
        line += `, in-force advised plans ${plan.n} (${plan.n ? "Track A" : "Track B"}), membership ${m ? `${m.status}/${m.source}` : "none yet"}`;
      }
      out.push(line);
    }

    await client.query(apply ? "commit" : "rollback");
    out.push(apply ? "Applied." : "Dry run: rolled back, nothing was changed. Run again with --apply.");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith("relink-live-profiles.ts")) {
  const apply = process.argv.includes("--apply");
  const list = process.env.RELINK_ACCOUNTS ?? "";
  if (!list.trim()) { console.error("Set RELINK_ACCOUNTS."); process.exit(1); }
  const url = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) { console.error("Set DATABASE_URL."); process.exit(1); }
  const pool = new pg.Pool({ connectionString: url });
  pool.on("error", (err) => console.error(`database connection dropped: ${err.message}`));
  relink(pool, parsePairs(list), apply)
    .then((lines) => { for (const l of lines) console.log(l); })
    .catch((err) => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1; })
    .finally(() => pool.end());
}
