# Free-tier conversion: implementation notes

Implements `docs/prompts/implement-free-tier-conversion.md` and, as Phase 5, `docs/prompts/subscription-addendum.md` on branch `feat/free-tier-conversion`. Typecheck and both test suites pass after every phase.

**Not tested in a browser, and not tested against Stripe.** The server is covered through its routes, with the Stripe client mocked, and the frontend through typecheck, a production build and unit tests of its pure logic. Nobody has yet clicked through a free user's journey or completed a real Checkout, even in Stripe test mode.

## Before this goes live

Run these in order on each environment, including production:

1. `pnpm --filter @workspace/db run push` adds `conversion_checkpoints`, `user_engagement`, `memberships`, `stripe_webhook_events` and `membership_checkout_sessions`.
2. `pnpm --filter @workspace/scripts run apply-membership-constraints --apply` lets `client_profiles.status` hold `pending_payment`. **Push does not do this and reports success anyway.** Without this step every lead promotion fails with a 500.
3. `pnpm --filter @workspace/scripts run migrate-free-tier-to-client` is a dry run. Read the counts it logs.
4. `pnpm --filter @workspace/scripts run migrate-free-tier-to-client --apply` copies the data and sets `onboarding_stage`. It is safe to run again.
5. `pnpm --filter @workspace/scripts run backfill-memberships` is a dry run. Read the counts it logs.
6. `pnpm --filter @workspace/scripts run backfill-memberships --apply` carries live `subscriptions` rows over to `memberships`. Add `--comp-existing-clients` only if decision 1 below goes that way. **Run this before the new code serves users**, or every current client drops to free limits.

Then in Stripe and the environment:

7. Create the annual price at $49.90 (10 × monthly) and set `STRIPE_PRICE_ANNUAL`. `STRIPE_PRICE_YEARLY` is no longer read.
8. Move the webhook endpoint to `/api/webhooks/stripe`. `/api/billing/webhook` still works during the cutover, and should be removed afterwards.

The dev database has had steps 1 and 2 for Phase 5, and steps 3 and 4 for the earlier phases.

**Final step, once production has run the migration:** delete `budgetEntriesTable` from `lib/db/src/schema/budget.ts` and `pathwayProgressTable` from `lib/db/src/schema/pathway.ts`, and clean up their remaining users (`routes/healthscore.ts`, `budgetP7.test.ts`, `scripts/src/seed-demo-data.ts` and the two migration scripts), then push. This drops both tables and cannot be undone, so it was left out of this branch.

## Decisions for the product owner

1. **What happens to current clients who don't pay?** Every `investment_client` without a live subscription has no membership, so the new rule puts them on free limits at deploy. Their data and advisor stay, but they can't add to it, and `/client/plan` closes. `backfill-memberships --comp-existing-clients` comps them all instead. Nothing does this by default.
2. **The monthly price is still $4.99.** The addendum says one price, without an amount. `MONTHLY_CENTS` in `routes/membership.ts` is the display price and the Stripe price must match it; annual follows at 10 ×. The old annual price was $41.92.
3. **Track B clients see fewer prompts.** Their conversion CTAs used to show on their own conditions and now appear only when a checkpoint is open, as the brief asks. The "Upgrade to Advised" dashboard card is now C8.

Settled in Phase 5: paid sign-up stays (the addendum), `/client/*` screens now keep advisors out, and users who finished the old onboarding no longer repeat it.

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
| OpenAPI spec | New routes are not in `lib/api-spec`. They use `apiFetch`, like most client routes. |

## Where Phase 5 departs from the addendum

| Addendum | What shipped | Why |
|---|---|---|
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
