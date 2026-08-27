---
name: Workflow termination signals
description: Interpreting managed workflow exits when the app appears to have failed
---

Managed artifact workflows may show a failed state with exit code 143 even when the service started cleanly and served requests. Treat this as an externally delivered termination signal first; inspect the latest logs and restart the exact managed workflow before changing application code.

**Why:** The WealthApp, API, and mockup services all stopped cleanly with exit 143 while their fresh restarts started normally without code changes.

**How to apply:** For an artifact showing only exit 143 and no startup/runtime exception, restart the managed service(s), refresh logs, and capture the preview before editing code.

An artifact restart can also report `EADDRINUSE` when a child server from the prior run still owns the injected port even though the managed workflow is marked failed.

**Why:** Repeated API restarts could not bind until the old nested Node listener was identified; the application itself was healthy, so changing server code would have been the wrong fix.

**How to apply:** Confirm the port answers and identify the exact stale child process before stopping it. Then restart the exact managed artifact workflow once and verify a clean “listening” log.