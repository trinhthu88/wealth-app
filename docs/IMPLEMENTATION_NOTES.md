# Free-tier conversion: implementation notes

Implements `docs/prompts/implement-free-tier-conversion.md` and, as Phase 5, `docs/prompts/subscription-addendum.md` on branch `feat/free-tier-conversion`. Typecheck and both test suites pass after every phase.

**Not tested against a real payment provider.** Webhook and checkout tests use fakes of Stripe and Lemon Squeezy, built from their published docs, and no real checkout has been completed, even in test mode, because this environment has no keys. The screens after payment were checked by setting membership rows by hand.

**Browser tested on 2026-11-04,** on a production build with test Clerk users, at phone width. Covered: sign-in, onboarding, return visit, locked screens and membership copy, goal cap and C2, "Talk to an advisor", the Activate and Reactivate screens, the pending, member, trial-ending and lapsed states, the advisor allow-list, and Add lead. Not covered: real payment, the super-admin screens, and desktop width.

## Before this goes live

Run these in order on each environment, including production:

1. `pnpm --filter @workspace/scripts run apply-membership-constraints --apply` renames `stripe_webhook_events` where it exists, because push would otherwise stop to ask about it. On a database that has never had memberships, this step reports that and changes nothing yet.
2. `pnpm --filter @workspace/db run push` creates the membership tables, `conversion_checkpoints` and `user_engagement`.
3. `pnpm --filter @workspace/scripts run apply-membership-constraints --apply` again. It lets `client_profiles.status` hold `pending_payment` and `memberships.source` hold `lemonsqueezy`. **Push does not do this and reports success anyway.** Without it, every lead promotion and every Lemon Squeezy webhook fails with a 500.
4. `pnpm --filter @workspace/scripts run migrate-free-tier-to-client` is a dry run. Read the counts it logs.
5. `pnpm --filter @workspace/scripts run migrate-free-tier-to-client --apply` copies the data and sets `onboarding_stage`. It is safe to run again.
6. `pnpm --filter @workspace/scripts run backfill-memberships --comp-existing-clients` is a dry run. Read the counts it logs. If `paidBackfilled` is above zero, see decision 1 below first.
7. `pnpm --filter @workspace/scripts run backfill-memberships --apply --comp-existing-clients` comps every current client without a live subscription. **Run this before the new code serves users**, or those clients drop to free limits.

Then in Lemon Squeezy and the environment:

8. Create one product with two variants, Monthly and Annual, each with a 7-day free trial, and set `PAYMENT_PROVIDER`, `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET` and `APP_URL`.
9. Select the variants at `/admin/membership`. Lemon Squeezy has no env fallback, so sign-up answers 503 until this is done.
10. Point the Lemon Squeezy webhook at `/api/webhooks/payments`, with the events in `replit.md`.

## Copying development accounts to the live site

`scripts/src/copy-accounts-to-live.ts` copies chosen accounts' data from the development database into the live one, so people keep the data they built while testing. It creates no sign-ins: each person signs up on the live site first, and the copy attaches their development data to that live account by email.

1. Each person signs up on the live site with the email they will use there.
2. Dry run, which copies inside a transaction and rolls back, so every reference is checked:
   `SOURCE_DATABASE_URL=<development> TARGET_DATABASE_URL=<live> pnpm --filter @workspace/scripts run copy-accounts-to-live -- --accounts "a@x.com, b@x.com, old@demo.example=new@x.com"`
3. Read the counts, then run the same command with `--apply`.

`old=new` copies a development account into a live account with a different email. Copy everyone in one run where possible. A side reference (advisor, who entered a statement) to someone not in the run is linked to their live account by email, or cleared if they are not on the live site. It refuses to write into a live account that already has its own data, so a second run cannot duplicate anything, and it never grants super_admin. When one machine cannot reach both databases, use `--export=account-copy/bundle.json` on the development side and `--import=…` on the live side; the file holds personal data, is git-ignored, and should be deleted after the import.

## Running production jobs inside the deployment

Replit's live database accepts connections only from the deployed app, so the production steps (membership constraints, the free-tier migration, the membership backfill, copying accounts) run inside the deployment. `scripts/run-production-tasks.mjs` starts in the background next to the API server (see `artifacts/api-server/.replit-artifact/artifact.toml`) and does nothing unless `PRODUCTION_TASKS` is set. Output appears in the deployment log, prefixed `[production-tasks]`.

1. For the account copy: export the bundle in the workspace, from the development database, to `account-copy/bundle.json` (git-ignored, but included in the deployed files):
   `SOURCE_DATABASE_URL=$DATABASE_URL pnpm --filter @workspace/scripts run copy-accounts-to-live -- --accounts "…" --export=../account-copy/bundle.json`
2. Deployment secrets: `PRODUCTION_TASKS=membership-constraints,free-tier-migration,backfill-memberships,copy-accounts` and `ACCOUNT_COPY_FILE=account-copy/bundle.json`. Redeploy, then read the dry-run counts in the deployment log.
3. Add `PRODUCTION_TASKS_APPLY=true` and redeploy. Jobs run in order and stop at the first failure; the backfill then comps existing clients. A database lock lets only one instance run them.
4. Remove `PRODUCTION_TASKS`, `PRODUCTION_TASKS_APPLY` and `ACCOUNT_COPY_FILE`, delete `account-copy/`, and redeploy, so the personal data file leaves the deployed image.

## Decisions for the product owner

1. **Any live Stripe subscribers need a plan before this deploys.** The backfill carries them over as Stripe memberships, but with `PAYMENT_PROVIDER=lemonsqueezy` their Stripe webhooks are refused and they can't reach a billing portal, so their membership would stay active with nothing updating it. `paidBackfilled` in the dry run shows how many there are.
2. **Track B clients see fewer prompts.** Their conversion CTAs used to show on their own conditions and now appear only when a checkpoint is open, as the brief asks. The "Upgrade to Advised" dashboard card is now C8.

Settled: paid sign-up stays (the addendum), `/client/*` screens keep advisors out, and users who finished the old onboarding don't repeat it. Current clients without a live subscription are comped at launch (product owner, 2026-11-04). The amounts are set in Stripe, and a super admin chooses which prices the app sells at `/admin/membership`.

## What shipped

### Phase 0: prerequisite fixes
- F-1: `POST /profiles/me/upsert` takes the email from Clerk.
- F-5 (part): `GET /client-profile/me` no longer creates a row.
- F-19: `PUT /budget/transactions/:id` already existed, so this added the missing Zod validation.

### Phase 1: tier policy and entitlements
- `lib/tier-policy`, `requireAllowance`, `GET /api/me/entitlements`.
- `useEntitlements`, `<Gated>`, `<LockedFeature>`, capped Add buttons, open client routes.
- Also gated, because each one bypassed a cap: reopening a finished goal, restoring a removed holding, `POST /scenarios`, and the budget and net worth read windows.

### Phase 2: direct ask and conversion state
- One idempotent interest action. Name, email and score of a linked lead are read through the `userId` join.
- `TalkToAdvisorButton` replaces every upgrade control. The `/book` and mailto destinations are gone.
- Dashboard `AdvisorCard` driven by lead status; `GET /advisor/leads/:id/budget` and `/score`.

### Phase 3: checkpoint engine
- `conversion_checkpoints`, `lib/checkpoints`, post-write hooks, `/api/me/checkpoint` routes, `GET /advisor/leads/:id/checkpoints`.
- Conversion components read the open checkpoint. Their copy follows `SOL_PERSONA.md`, which removed unsourced claims such as "accelerates net worth growth 2–3×".
- Free users get a score immediately, which C1 and C6 depend on.

### Phase 4: engagement and the advisor lead view
- `user_engagement`, daily check-in, `GET /me/engagement`, `GET /advisor/leads/:id/engagement`.
- Lead detail shows score, engagement, budget and fired checkpoints.
- `scripts/src/migrate-free-tier-to-client.ts`. Deleted `pages/free/*` and `routes/pathway.ts`; `/free/*` redirects to `/dashboard`.

### Phase 5: membership
- `memberships` owns the fact, written only by `lib/membershipStore.ts`: the webhook and the super-admin comp route. A test fails if another API file writes it. `backfill-memberships` is the one-off exception, at deploy. Checkout writes nothing there; the old code's write at checkout is gone.
- `resolveTier` takes membership. A lapse moves and deletes nothing, and the webhook no longer demotes the role.
- Routes: `POST /membership/checkout`, `POST /membership/portal`, `POST /webhooks/stripe`, `PUT /admin/users/:id/membership`. `routes/billing.ts` is replaced by `routes/membership.ts`. `GET /billing/prices` and `/billing/subscription` stay.
- Webhook events are recorded in `stripe_webhook_events` in the same transaction as their effects, so a replay changes nothing and a failure stays retryable. The subscription is re-read from Stripe on each event, because delivery order isn't guaranteed.
- Both doors: `pending_payment` with an Activate screen and advisor card for the advisor-led door; a `self_serve_member` lead for the self-serve one. C11 and C12 on the dashboard. Comped badge and `pending_payment` on the client and lead lists.
- `/client/*` screens are allow-listed to `free_user`, `investment_client` and `super_admin`. A test fails if a new client screen skips it. This is a screen rule: `/api/client/*` answers an advisor with their own empty data, as it did before.
- `migrate-free-tier-to-client` sets `onboarding_stage = complete` for users with `onboardingComplete` true or pathway step 6 completed, including those with no pathway rows.

### Phase 6: access fixes from the audit
- F-2: the advisor statement routes 404 unless the plan belongs to `:clientId`.
- F-7: `PUT /leads/:id` and `POST /leads/:id/convert` use `requireAdvisorOwnsLeadById()`.
- F-6: public `POST /leads` drops `status` and `notes`, validates with Zod and is limited to 10 per IP per 15 minutes. The advisor page uses the new `POST /advisor/leads`.
- F-8: package transactions and snapshots take the owner from the package.
- F-9: `GET /blog/:slug` serves published posts only.
- `PATCH /goals/:id/status` already passed the goals cap on reopening; this phase adds a test.

Found by the browser test and fixed:
- **No new user could finish onboarding.** Saving step 2 sent them back to step 1, forever. `component={() => ...}` on each route made a new component type on every render, so a profile change remounted the page. `main` has the same code. Routes now take children, and a test refuses inline route components.
- **A returning member was promised a free trial they wouldn't get,** so their card would be charged at once. `membership.trialEligible` now comes from the server, using the same rule as Checkout.
- **A lead with no first name crashed the leads page to blank.** The server stores blanks as null, and the staff lists handle rows already saved.

### Phase 7: admin-configured prices
- `membership_settings` (one row, id = 1) names the Stripe prices the app sells. `GET /admin/membership/prices`, `GET` and `PUT /admin/membership/settings`, and the `/admin/membership` page. Prices are verified against Stripe before saving.
- `GET /billing/prices` returns Stripe's amounts, with `source: "settings"` or `"env"`. The settings row is read on every request, and only Stripe's price objects are cached, for 5 minutes, by id, so a change reaches every instance at once.
- Checkout reads the same row. An open session for a replaced price is closed rather than reused.
- A change applies to new sign-ups. Existing subscribers stay on their current price until they are moved in Stripe.
- The screens format by the price's own currency, including zero-decimal ones. "Best value" and "save N%" appear only when the real amounts show a saving.

### Phase 8: Lemon Squeezy
- `lib/payments` holds the `PaymentProvider` interface, `StripeProvider` and `LemonSqueezyProvider`. `PAYMENT_PROVIDER` selects at boot and defaults to `lemonsqueezy`; an unknown value stops the server. `handleProviderEvent` replaces `handleStripeEvent` and has no provider-specific code.
- `POST /api/webhooks/payments`, with `/api/webhooks/stripe` and `/api/billing/webhook` as aliases. `stripe_webhook_events` is renamed `payment_webhook_events`.
- Every owner decision stands. A variant without a 7-day free trial is refused at `/admin/membership`, and a returning member gets `skip_trial`.
- A canceled membership now runs to its paid-through date. C12 fires when it actually runs out, not when the member cancels.
- The Phase 5 and 7 scenarios run against both providers, through fakes of each, with `PAYMENT_PROVIDER` set to either value.

### Metrics
- `pnpm --filter @workspace/scripts run funnel-report` (add `--weeks=<n>`, default 12). "Promoted within 30 days" uses the lead's `updatedAt` as the promotion date, so a later edit to a promoted lead can drop it from that count.

## Deferred

| Item | Why it matters |
|---|---|
| Lead detail reuses client screens | The brief asks for the client screens in read-only mode. The client pages fetch their own `/client/*` data, so reuse needs them to accept a data source. This branch adds read-only panels beside the existing summary instead. |
| Advised plan preview | The sample plan built from the user's surplus is not built. C8 shows an offer card. `advisedPlans` is served in entitlements but not enforced on `/client/advised-plans*`, which only return the caller's own plans. |
| Score breakdown gating | "Score + top insight" for free is not enforced. A free user gets the full score response. The addendum lists "full score breakdown" as a membership unlock and also says no new gates, so the locked copy leaves it out rather than promise something free users already have. |
| Comp controls in the UI | `PUT /admin/users/:id/membership` works and the badge shows, but `/admin/clients` has no button yet, so comping takes an API call. |
| Trial-ending and lapse emails | C11 and C12 appear on the dashboard only, as the addendum says. Someone who doesn't sign in during the two-day window sees no C11, and is charged. Stripe's own trial reminder email can cover this. |
| Removing `subscriptions` | Nothing writes it now. Delete it after production has run `backfill-memberships`, along with the `/billing/webhook` alias. |
| C2 draft goal | The design keeps the refused goal as a draft. Not built. |
| Net worth trend for free users | The nightly snapshot job covers investment clients only, so a free user's trend stays empty. |
| Holding cap via surplus sweep | `POST /client/budget` can create a default cash holding, which can take a free user to six. |
| Caps under concurrency | The guard counts and then writes, so simultaneous requests can pass a cap by one. |
| `POST /goals/upsert-from-pathway` | No caller remains, but it still deletes extra goals (F-10). The brief named only `routes/pathway.ts`, and a test covers this route. Worth deleting. |
| Legacy routes | `/budget` and `POST /health-score` have no UI callers left. |
| Unused components | `FreeTierBanner`, `GhostGoalCard`, `InvestableSurplusCard`, `shared/GoalCard`, `WeeklyTipCard`, `BottomNav`, `PlanPicker` and `lib/tipEngine` may be unused now. |
| `PUT /client-profile/me` | Still creates a row for any role. The toggle on the messages page depends on it. |
| Other localStorage keys | Track A's own CTAs and the off-track Sol card still store dismissals locally. They are not checkpoints. |
| Rate limit across instances | The `POST /leads` count is held in memory and the deployment is autoscale, so each instance counts separately and the real limit is 10 × instances. A shared store would make it exact. It also assumes one proxy hop (`trust proxy` in `app.ts`), which needs checking on the deployed app: too few hops would put every visitor in one bucket. |
| C2 after a lead exists | A user who already asked for an advisor still sees C2's "Talk to an advisor" until they dismiss it. Accepting is harmless, since it touches the same lead. |
| Temporary Vite proxy | `artifacts/wealthapp/vite.config.ts` has a proxy to port 8082 marked "TEMPORARY ... will be reverted". It came from an earlier commit on `main`, and affects the dev server only. |
| Missed webhooks | Lemon Squeezy retries a failed webhook only three times, over about two and a half minutes, and then gives up. An outage longer than that leaves `memberships` out of date until that subscription's next event. A nightly job re-reading active subscriptions through `fetchSubscription` would close this. |
| Closing a checkout on Lemon Squeezy | It has no way to end a checkout early. Someone who keeps an old tab open could complete it within its 24 hours, after changing plan or after an admin changes the price. |
| Lemon Squeezy's deprecated fields | Amounts and billing come from the variant's own attributes, which are deprecated but still returned. The docs don't say how to pick a variant's current row from the Price history that replaces them. |
| Lemon Squeezy store currency | The docs don't say that variant prices are always in the store's currency, which is what the screens show. Worth checking on the test run. |
| OpenAPI spec | New routes are not in `lib/api-spec`. They use `apiFetch`, like most client routes. |

## Where Phase 5 departs from the addendum

| Addendum | What shipped | Why |
|---|---|---|
| The interface as written | Added `isConfigured`, `getPrice`, `priceProblem`, `envPriceIds`, `isCheckoutOpen`, `closeCheckout`. `ProviderEvent` gains `userId`, `ProviderSubscription` gains `interval`, and amounts may be null. | `/billing/prices` and Phase 7's validation need one price; the user link exists only on the webhook; the plan is set by interval. |
| The trial is "the variant's own setting" | Also sends `checkout_options.skip_trial` for a returning member | The docs offer it, and without it a member could cancel and rejoin for free indefinitely. |
| `cancelled` maps to `canceled` "so access runs to the paid-through date" | Same mapping, and the tier rule now honours a future paid-through date on `canceled` | The rule treated `canceled` as over at once, which would have ended access the moment a member cancelled. |
| `expired` maps to `canceled` | With no paid-through date | It is over whatever the date says. |
| Promotion creates the Checkout session | Pressing Activate creates it | A session expires within 24 hours and is fixed to one price, while the next sign-in may be later and the client hasn't chosen a plan. |
| `past_due` active until `currentPeriodEnd + 7 days` | Same formula, with `currentPeriodEnd` holding the paid-through date while past_due | Stripe rolls `current_period_end` forward before payment fails, so its value would give about 37 days, or over a year on annual. |
| C11 fires for members "with no card on file" | Fires for every trialing member who hasn't chosen to cancel | Decision 1 requires a card, so the condition would mean C11 never fires. |
| "Become a member" opens Checkout directly | It opens one screen to choose monthly or annual first | Checkout is fixed to one price. |
| Reason "recorded in `memberships.source`" | `source = comped`, with a new `reason` column | `source` is an enum, and decision 5 fixes its value. |
| `manageUrl` | The portal route, not a Stripe link | Portal links are short-lived, and creating one on every entitlements read would call Stripe each time. |
| Comp and revoke | Refused (409) on a paying member | Comping would leave Stripe charging them, and revoking would leave them paying for nothing. |

## Every `// DECISION:` comment

| Where | Decision |
|---|---|
| `artifacts/api-server/src/lib/membershipStore.ts` (`paidThrough`) | While past_due, `currentPeriodEnd` stores the paid-through date. |
| `artifacts/api-server/src/lib/promoteLead.ts` | Promotion does not create the Checkout session. |
| `artifacts/api-server/src/routes/membership.ts` | The trial is for a first membership only. |
| `lib/checkpoints/src/index.ts` (`trialEndingCandidate`) | C11 ignores "no card on file". |
| `artifacts/api-server/src/routes/profiles.ts` | super_admin also requires the primary address to be verified, or unverified sign-ups would reopen F-1. |
| `lib/tier-policy/src/index.ts` (`resolveTier`) | `clientTrack` does not decide the tier: it is deprecated and unwritten. An inforce plan makes a client Track A. |
| `lib/tier-policy/src/index.ts` (`resolveTier`) | Advisors and super admins resolve to `track_a`, so no cap applies to staff. An unknown role resolves to free. |
| `lib/tier-policy/src/index.ts` (`earliestBudgetMonth`) | The budget window is the current month plus `budgetMonths` earlier months, so free reads four. |
| `artifacts/wealthapp/src/lib/roleRedirect.ts` | Redirects read `onboarding_stage`, because `onboardingTrackComplete` is deprecated. |
| `artifacts/wealthapp/src/pages/client/ClientOnboarding.tsx` | The 8-screen flow is now 3 screens with no track or holdings step. Free users take all three with advisor copy removed. |
| `artifacts/wealthapp/src/hooks/useEntitlements.ts` | A capped Add button looks disabled but reports the click, because C2 and C5 fire from the refused attempt. |
| `artifacts/api-server/src/lib/leadInterest.ts` | Re-touching a cold lead returns it to unassigned and clears the old advisor. |
| `artifacts/api-server/src/lib/leadInterest.ts` | `leads.email` is NOT NULL, so a linked lead stores it at creation but never reads it. |
| `artifacts/api-server/src/routes/clients.ts` | A lead's budget honours `shareBudgetWithAdvisor`, like a client's. |
| `lib/db/src/schema/conversionCheckpoints.ts` | The unique index takes the date in UTC, because `firedAt::date` is not immutable on a timestamptz. |
| `lib/checkpoints/src/index.ts` (`isSuppressed`) | An accepted checkpoint cools down like a dismissed one. |
| `lib/checkpoints/src/index.ts` (`offTrackCandidate`) | "Consecutive" means consecutive in the snapshot series, not adjacent calendar days. |
| `lib/checkpoints/src/index.ts` (`evaluate`) | C8 to C10 triggers come from the design, because the brief gives none. It also sets which tier gets which code. |
| `lib/checkpoints/src/index.ts` (`decide`) | A higher-priority candidate supersedes a lower-priority open checkpoint, recorded as a dismissal with `supersededBy`. |
| `artifacts/api-server/src/routes/checkpoints.ts` | A Track B client's accept records the choice without creating a lead. |
| `artifacts/wealthapp/src/components/client/scenarios/BringUnderManagementCompare.tsx` | The compare tool appears for a free user only with C5 open, and stays available to Track B. |
| `artifacts/api-server/src/lib/engagement.ts` | `plan_starter` now means completing onboarding. |
| `lib/db/src/schema/budget.ts` | The `budget_entries` definition stays until production has run the migration. |
