# Free-tier conversion: implementation notes

Implements `docs/prompts/implement-free-tier-conversion.md` on branch `feat/free-tier-conversion`. Typecheck and both test suites pass after every phase. Final counts: 391 API tests and 108 frontend tests (the baseline was 179 and 89; the brief's 136 and 66 were out of date).

**Not tested in a browser.** The server is covered through its routes, and the frontend through typecheck, a production build and unit tests of its pure logic. Nobody has yet clicked through a free user's journey.

## Before this goes live

Run these in order on each environment, including production:

1. `pnpm --filter @workspace/db run push` adds `conversion_checkpoints` and `user_engagement`.
2. `pnpm --filter @workspace/scripts run migrate-free-tier-to-client` is a dry run. Read the counts it logs.
3. `pnpm --filter @workspace/scripts run migrate-free-tier-to-client --apply` copies the data. It is safe to run again.

The dev database has had all three. It filled 5 budget months and 3 risk profiles, and a second run changed nothing.

**Final step, once production has run the migration:** delete `budgetEntriesTable` from `lib/db/src/schema/budget.ts` and `pathwayProgressTable` from `lib/db/src/schema/pathway.ts`, and clean up their remaining users (`routes/healthscore.ts`, `budgetP7.test.ts`, `scripts/src/seed-demo-data.ts` and the two migration scripts), then push. This drops both tables and cannot be undone, so it was left out of this branch.

## Decisions for the product owner

1. **No screen offers self-serve Stripe checkout any more.** The brief described `FreeTierBanner` and `SmartUpgradeCard` as mailto and `/book` links, but they, and the free dashboard, opened the Stripe `PlanPicker` ($4.99 a month), whose webhook flips the role to `investment_client`. The brief says to replace every upgrade control, so they now raise interest. The billing routes, the webhook, `PlanPicker.tsx` and "Manage subscription" are all still there. To keep paid sign-up, it needs a new entry point, and a paid client with no advisor needs a place in the journey.
2. **Advisors can now open `/client/*` screens by URL.** The brief says to remove the role arrays. An allow-list of `free_user`, `investment_client` and `super_admin` would let free users in and keep advisors out.
3. **Track B clients see fewer prompts.** Their conversion CTAs used to show on their own conditions and now appear only when a checkpoint is open, as the brief asks. The "Upgrade to Advised" dashboard card is now C8.
4. **Existing free users are redirected to onboarding** the next time they sign in, because their `onboarding_stage` is unset.

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

### Metrics
- `pnpm --filter @workspace/scripts run funnel-report` (add `--weeks=<n>`, default 12). "Promoted within 30 days" uses the lead's `updatedAt` as the promotion date, so a later edit to a promoted lead can drop it from that count.

## Deferred

| Item | Why it matters |
|---|---|
| Lead detail reuses client screens | The brief asks for the client screens in read-only mode. The client pages fetch their own `/client/*` data, so reuse needs them to accept a data source. This branch adds read-only panels beside the existing summary instead. |
| Advised plan preview | The sample plan built from the user's surplus is not built. C8 shows an offer card. `advisedPlans` is served in entitlements but not enforced on `/client/advised-plans*`, which only return the caller's own plans. |
| Score breakdown gating | "Score + top insight" for free is not enforced. A free user gets the full score response. |
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

## Every `// DECISION:` comment

| Where | Decision |
|---|---|
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
