import { Router, type IRouter } from "express";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";

/**
 * Runs scripts/run-production-tasks.mjs for the length of one request and streams its output back.
 *
 * Autoscale gives an instance CPU only while it serves a request, and with more than one instance a
 * background job may sit on one that gets no traffic, so jobs started next to the server crawled or
 * stalled. Inside a request the job runs at full speed on the instance answering it, and the caller
 * watches its progress live.
 *
 * Guarded by PRODUCTION_TASKS_TOKEN (at least 32 characters), sent as the x-production-token header.
 * Without the secret, or with the wrong token, the route does not exist. The jobs to run and whether
 * to apply come from the same secrets as before: PRODUCTION_TASKS, PRODUCTION_TASKS_APPLY and each
 * job's own.
 */
const router: IRouter = Router();
const MIN_TOKEN_LENGTH = 32;

export function tokenMatches(given: string | undefined, expected: string | undefined): boolean {
  if (!expected || expected.length < MIN_TOKEN_LENGTH || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function runnerPath(): string | null {
  for (const dir of [process.cwd(), path.resolve(process.cwd(), "../.."), path.resolve(process.cwd(), "..")]) {
    const candidate = path.resolve(dir, "scripts/run-production-tasks.mjs");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

router.post("/internal/production-tasks", (req, res): void => {
  if (!tokenMatches(req.header("x-production-token"), process.env.PRODUCTION_TASKS_TOKEN)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const runner = runnerPath();
  if (!runner) { res.status(500).json({ error: "scripts/run-production-tasks.mjs is not in this deployment" }); return; }

  res.status(200);
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-accel-buffering", "no");
  res.flushHeaders();

  const child = spawn(process.execPath, [runner], {
    cwd: path.dirname(path.dirname(runner)),
    env: { ...process.env, PRODUCTION_TASKS_TOKEN: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const write = (chunk: Buffer | string) => { if (!res.writableEnded) res.write(chunk); };
  child.stdout.on("data", write);
  child.stderr.on("data", write);
  // Some steps are quiet for a while; a line now and then keeps proxies from closing the request.
  const heartbeat = setInterval(() => write("[still working]\n"), 20_000);
  child.on("error", (err) => { clearInterval(heartbeat); write(`could not start: ${err.message}\n`); res.end(); });
  child.on("close", (code) => {
    clearInterval(heartbeat);
    write(code === 0 ? "\nFinished.\n" : `\nStopped with exit code ${code}. Running it again carries on where it left off.\n`);
    res.end();
  });
});

export default router;
