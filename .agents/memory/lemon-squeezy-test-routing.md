---
name: Lemon Squeezy test checkout routing
description: Keep test checkout redirects and webhook events in development.
---

Before any Lemon Squeezy test checkout, verify that the API's effective `APP_URL` is the active development preview origin and that the test-mode webhook targets the development API. Do not trigger checkout while either target points to the published host.

**Why:** The app's `APP_URL` can remain set to the published domain after a secret confirmation, and the test-mode webhook was configured to the live host. A test purchase could therefore redirect or deliver events to production.

**How to apply:** Check the effective API-process URL after restarting the API, inspect the existing test-mode webhook before checkout, and restore its original URL after verification.
