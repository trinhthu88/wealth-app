---
name: Workflow termination signals
description: Interpreting managed workflow exits when the app appears to have failed
---

Managed artifact workflows may show a failed state with exit code 143 even when the service started cleanly and served requests. Treat this as an externally delivered termination signal first; inspect the latest logs and restart the exact managed workflow before changing application code.

**Why:** The WealthApp, API, and mockup services all stopped cleanly with exit 143 while their fresh restarts started normally without code changes.

**How to apply:** For an artifact showing only exit 143 and no startup/runtime exception, restart the managed service(s), refresh logs, and capture the preview before editing code.