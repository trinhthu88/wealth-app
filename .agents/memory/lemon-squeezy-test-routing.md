---
name: Lemon Squeezy test checkout routing
description: Keep test checkout redirects and webhook events in development.
---

Before any Lemon Squeezy test checkout, verify that the API's effective `APP_URL` is the active development preview origin and that the test-mode webhook targets the development API. Do not trigger checkout while either target points to the published host.

**Why:** The app's `APP_URL` can remain set to the published domain after a secret confirmation, and the test-mode webhook was configured to the live host. A test purchase could therefore redirect or deliver events to production. A canceled test subscription can also emit a later expiration event, so restoring the production webhook endpoint too early can send test events to the live app.

**How to apply:** Check the effective API-process URL after restarting the API and inspect the test-mode webhook before checkout. Keep the test webhook pointed to development until all test subscriptions have completed their provider lifecycle, including any future `ends_at` or expiration event. Restore its original URL only after no further test events can be sent.
