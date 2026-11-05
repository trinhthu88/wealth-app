// Runs one-off maintenance jobs from inside the deployed app, the only place that can reach the live
// database. Started in the background next to the API server, so the site comes up as usual.
//
// Does nothing unless PRODUCTION_TASKS is set. Each listed job runs in order, as a dry run unless
// PRODUCTION_TASKS_APPLY=true. Output goes to the deployment log, prefixed [production-tasks].
// A database advisory lock makes sure only one instance runs the jobs when several start at once.
//
//   PRODUCTION_TASKS=membership-constraints,free-tier-migration,backfill-memberships,copy-accounts
//   PRODUCTION_TASKS_APPLY=true            (leave unset for a dry run)
//   ACCOUNT_COPY_FILE=account-copy/bundle.json   (for copy-accounts; relative to the project root)
//
// Remove PRODUCTION_TASKS and redeploy once the jobs have applied, so they don't run again on the
// next cold start. Every job is safe to repeat, but there is no reason to.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const log = (msg) => console.log(`[production-tasks] ${msg}`);

const requested = (process.env.PRODUCTION_TASKS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
if (requested.length === 0) process.exit(0);

const apply = process.env.PRODUCTION_TASKS_APPLY === "true";
const copyFile = process.env.ACCOUNT_COPY_FILE ? resolve(root, process.env.ACCOUNT_COPY_FILE) : null;

const JOBS = {
  "membership-constraints": { file: "src/apply-membership-constraints.ts", args: [] },
  "free-tier-migration": { file: "src/migrate-free-tier-to-client.ts", args: [] },
  "backfill-memberships": { file: "src/backfill-memberships.ts", args: apply ? ["--comp-existing-clients"] : [] },
  "copy-accounts": { file: "src/copy-accounts-to-live.ts", args: copyFile ? [`--import=${copyFile}`] : [] },
};

function runJob(name) {
  const job = JOBS[name];
  if (!job) { log(`${name}: unknown job, skipped. Known: ${Object.keys(JOBS).join(", ")}`); return Promise.resolve(false); }
  if (name === "copy-accounts" && (!copyFile || !existsSync(copyFile))) {
    log(`${name}: ACCOUNT_COPY_FILE is missing or not found, skipped.`);
    return Promise.resolve(false);
  }
  const args = ["--import", "tsx", job.file, ...job.args, ...(apply ? ["--apply"] : [])];
  log(`${name}: starting (${apply ? "apply" : "dry run"})`);
  return new Promise((done) => {
    const child = spawn(process.execPath, args, {
      cwd: here,
      env: { ...process.env, TARGET_DATABASE_URL: process.env.DATABASE_URL, SOURCE_DATABASE_URL: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const relay = (stream) => stream.on("data", (chunk) => {
      for (const line of String(chunk).split("\n")) if (line.trim()) log(`${name}: ${line}`);
    });
    relay(child.stdout);
    relay(child.stderr);
    child.on("close", (code) => { log(`${name}: ${code === 0 ? "finished" : `failed with exit code ${code}`}`); done(code === 0); });
    child.on("error", (err) => { log(`${name}: could not start: ${err.message}`); done(false); });
  });
}

async function main() {
  if (!process.env.DATABASE_URL) { log("DATABASE_URL is not set, nothing run."); return; }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query("select pg_try_advisory_lock(hashtext('wealthapp:production-tasks')) as got");
    if (!rows[0].got) { log("another instance is running the jobs, this one skips them."); return; }
    log(`running ${requested.join(", ")} as ${apply ? "APPLY" : "a dry run"}`);
    for (const name of requested) {
      const ok = await runJob(name);
      if (!ok && apply) { log(`stopping after ${name} failed; later jobs were not run.`); break; }
    }
    log("done.");
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => { log(`error: ${err instanceof Error ? err.message : err}`); });
