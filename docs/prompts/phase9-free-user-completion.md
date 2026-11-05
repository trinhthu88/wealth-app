# Phase 9: complete the free-user tier

Supplements `implement-free-tier-conversion.md`. Closes the free-user gaps listed under "Deferred" in `docs/IMPLEMENTATION_NOTES.md`. Work on `feat/free-tier-conversion` (or a branch from it if PR #4 has merged). Nothing here needs the Lemon Squeezy store to be activated. Same rules as before: tier limits only in `lib/tier-policy`, computed values never stored, every new request body Zod-validated, tests for every change, typecheck and both suites green before each commit.

## A. Free-user features that the design specified and the branch did not build

1. **Score for free users = score + top insight.** `GET /client/health-score` for tier `free` returns `overallScore`, `gated`, and the single weakest sub-score as `topInsight {name, score, hint}`; the four sub-scores and history are omitted. Investment clients are unchanged. The WealthScoreCard renders the one-insight version with "Membership unlocks the full breakdown" from `UNLOCKS.membership`. Add `scoreBreakdown` to `CAPABILITIES` with gate `limited` for free, `full` otherwise, so the UI reads it from entitlements rather than role.

2. **C2 draft goal.** When `POST /goals` is refused by the cap, store the submitted goal as `status = "draft"` (add to the goal status enum) instead of discarding it. Drafts do not count toward the cap, do not appear in pacing, score or Sol, and are listed on the goals page under "Waiting for membership" with the C2 offer. On promotion or membership activation, drafts become `active` automatically (one place: the entitlement change hook). Cap check: a draft becoming active must pass `requireAllowance("goals")`, which it will once the tier is no longer free.

3. **C8 advised-plan preview.** Build the sample plan from the user's latest `netSurplus` and the admin's `advised_strategy_returns`: monthly contribution = surplus, projection over 10 and 25 years at the strategy's target return, shown as a read-only `AdvisedPlanCard` variant labelled "Example, not a plan". Pure function in `lib/goal-math` (`projectRegularSavings`), unit-tested. The C8 card uses it; no new table.

4. **Net worth trend for free users.** The nightly snapshot job must include every user who has any assets, liabilities or holdings, regardless of role. Free users read the last `trendMonths` (3) months through the existing gate.

5. **Holding cap and the surplus sweep.** `POST /client/budget` must not create the "Surplus (auto)" cash holding when the caller is at the holdings cap; instead it records the surplus on the month and raises C5 with the snapshot. Test: a free user with 5 holdings saves a budget with surplus and still has 5 holdings.

6. **C2 after a hand-raise.** The evaluator's suppression rule (nothing new fires while a lead is unassigned or active) must also apply to C2 raised from the cap path in `checkAllowanceFor`. The refusal still returns 403 with the gate message, without creating a checkpoint row.

7. **Caps under concurrency.** Take a per-user advisory lock (`pg_advisory_xact_lock(hashtext('cap:' || userId))`) inside a transaction around count-then-insert for goals and holdings, so two simultaneous requests cannot pass a cap by one. Test with two concurrent inserts.

## B. Retire the free-tier leftovers

8. Delete `POST /goals/upsert-from-pathway` and `POST /goals/auto-update` (audit F-10 and the auto-growth writer); remove their tests; confirm no caller with a grep.
9. Delete `routes/budget.ts` legacy entries routes and `POST /health-score` (free formula) if no caller remains; the shared scoring service covers both tiers. Keep `budget_entries` and `pathway_progress` tables until the production migration has run (as the notes say), but no route may read or write them.
10. Remove the unused components the notes list (`FreeTierBanner`, `GhostGoalCard`, `InvestableSurplusCard`, `shared/GoalCard`, `WeeklyTipCard`, `BottomNav`, `PlanPicker`, `lib/tipEngine`) after confirming with a grep that nothing imports them. If `WeeklyTipCard` or `tipEngine` is still wanted, port the tip to the server-side engagement table first (one tip per week per user, stored, not recomputed in the browser) and keep only that version.
11. `PUT /client-profile/me` must not create a row for any role; the messages-page toggle it supports must use `PUT /client/profile/basics` or a dedicated preference route. Remove `status` from its allowlist (client must not set their own account status).

## C. Operational items that do not need store activation

12. **Membership reconciliation job.** A nightly script (`scripts/src/reconcile-memberships.ts`, idempotent, dry run by default) that calls `provider.fetchSubscription` for every membership with `source = "stripe"` or `"lemonsqueezy"` and status in `trialing | active | past_due`, and applies any difference through `membershipStore` exactly as a webhook would. Logs counts. Closes the "missed webhook" gap.
13. **Comp button on `/admin/clients`.** Per row: "Comp membership" / "Revoke comp" calling the existing `PUT /admin/users/:id/membership`, with a required reason field, badge updated in place.
14. **Rate limit on `POST /leads` across instances.** Move the counter to the database (a small `rate_limits(key, window_start, count)` table, upserted in one statement) so the limit is exact on autoscale; keep the per-IP window at 10 per 15 minutes. Confirm `trust proxy` matches the deployment's hop count and document it in `.env.example`.

## Tests to add

Score shape per tier; draft goal lifecycle (refused → draft → active on activation); `projectRegularSavings` fixtures; snapshot job includes a free user; surplus sweep at cap; C2 suppression while a lead is open; concurrent cap; reconciliation job dry run and apply with a mocked provider; comp button route; rate limit table.

## Order and commits

One commit per numbered item or small group, in the order A, B, C. After each commit: typecheck, both suites, push. Update `docs/IMPLEMENTATION_NOTES.md`: move each closed item out of "Deferred" and record any new `// DECISION:`.
