// Prints the conversion funnel per sign-up cohort week: sign-ups, activation (first score
// within 7 days), checkpoints fired, shown and accepted per code, leads by source, and
// leads promoted within 30 days. Read-only. Add --weeks=<n> to change the window (default 12).
import { pool } from "@workspace/db";

const weeksArg = process.argv.find((a) => a.startsWith("--weeks="));
const weeks = weeksArg ? parseInt(weeksArg.slice("--weeks=".length), 10) : 12;
if (!Number.isInteger(weeks) || weeks < 1) throw new Error("--weeks must be a positive whole number");

const COHORT = `date_trunc('week', p.created_at AT TIME ZONE 'UTC')::date`;
const WINDOW = `p.created_at >= now() - make_interval(weeks => $1) AND p.role <> 'advisor' AND p.role <> 'super_admin'`;

try {
  const { rows: cohorts } = await pool.query(`
    SELECT ${COHORT}::text AS cohort,
           count(*)::int AS signups,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM health_scores h
             WHERE h.user_id = p.id AND h.score_date <= (p.created_at + interval '7 days')::date
           ))::int AS activated
    FROM profiles p WHERE ${WINDOW} GROUP BY 1 ORDER BY 1`, [weeks]);

  const { rows: checkpoints } = await pool.query(`
    SELECT ${COHORT}::text AS cohort, c.code,
           count(*)::int AS fired,
           count(c.shown_at)::int AS shown,
           count(c.accepted_at)::int AS accepted
    FROM conversion_checkpoints c JOIN profiles p ON p.id = c.user_id
    WHERE ${WINDOW} GROUP BY 1, 2 ORDER BY 1, 2`, [weeks]);

  // A lead is promoted within 30 days when its status is client and its last update, the
  // promotion for a lead that has stayed client, falls within 30 days of its creation.
  const { rows: leads } = await pool.query(`
    SELECT ${COHORT}::text AS cohort, coalesce(l.source, '(none)') AS source,
           count(*)::int AS leads,
           count(*) FILTER (WHERE l.status = 'client' AND l.updated_at <= l.created_at + interval '30 days')::int AS promoted_30d
    FROM leads l JOIN profiles p ON p.id = l.user_id
    WHERE ${WINDOW} GROUP BY 1, 2 ORDER BY 1, 2`, [weeks]);

  if (cohorts.length === 0) console.log(`No sign-ups in the last ${weeks} weeks.`);
  for (const c of cohorts) {
    const rate = c.signups ? Math.round((c.activated / c.signups) * 100) : 0;
    console.log(`\nWeek of ${c.cohort}: ${c.signups} sign-ups, ${c.activated} activated (${rate}%)`);
    for (const k of checkpoints.filter((r) => r.cohort === c.cohort)) {
      console.log(`  ${k.code}: fired ${k.fired}, shown ${k.shown}, accepted ${k.accepted}`);
    }
    for (const l of leads.filter((r) => r.cohort === c.cohort)) {
      console.log(`  leads from ${l.source}: ${l.leads}, promoted within 30 days ${l.promoted_30d}`);
    }
  }
} finally {
  await pool.end();
}
