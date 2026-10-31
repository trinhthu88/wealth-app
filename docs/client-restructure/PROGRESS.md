# Restructure progress

## Current phase
P2.5 — Align advised-plan statement uniqueness — complete; normal schema push blocked by unrelated truncation warning

## Baseline (Phase 0)
- typecheck: passed (`pnpm run typecheck`; all libraries and leaf workspaces completed).
- api tests: 136/136 passed across 16 files; pre-existing failures: none.

## Phase log
### P0 — Baseline and guardrails
Plan:
- Record the current schema and fact ownership in `docs/client-restructure/OWNERS.md`.
- Add `backups/` to `.gitignore`, identify the client-area tables from §5, and export each table's data to a dated SQL backup before any schema change.
- Run the full `pnpm run typecheck` and `pnpm --filter @workspace/api-server test` commands; record exact results, including pre-existing failures.
- Make no schema or application changes in this phase.
Done:
- Commit `528171c` — establish baseline and backups.
- Added `backups/` to `.gitignore`.
- Exported all 32 client-area/Phase 1 tables to `backups/2026-10-30-<table>.sql`; each export completed and was non-empty.
- Wrote `docs/client-restructure/OWNERS.md` for every §5 fact.
- Captured full typecheck and API test baselines.
Audit counts / backfills:
- Not applicable in Phase 0.
Tests: typecheck passed; API suite 16 files and 136 tests passed.
Decisions made by agent:
- Backups are local, ignored files and will not be committed because they contain client financial and identity data.
Files changed:
- `.gitignore`
- `docs/client-restructure/OWNERS.md`
- `docs/client-restructure/PROGRESS.md`

### P1 — Enums, constraints, unique indexes
Plan:
- Re-export the P1-affected table data to fresh ignored backups immediately before schema changes.
- Add shared `as const` value arrays and Zod enums for roles, goal lifecycle, advised-plan status, lead status, client status, onboarding stage (`not_started`, `profile`, `complete`), and first focus (`know_my_money`, `start_investing`, `save_for_big`, `organise_existing`, `plan_retirement`).
- Audit all existing values and duplicate keys, then run idempotent `scripts/src/` repair scripts that log changed row counts; map legacy goal pacing statuses to lifecycle `active`, and keep the latest snapshot row per required unique key.
- Add `health_scores.tier` with the required free/client backfill; add CHECK constraints and missing unique indexes only after audits and repairs pass.
- Keep old consumers working under the new unique keys: make browser net-worth snapshot writes and both free/client health-score writes tier-aware and idempotent for a user/day.
- Replace affected route status/role string validation with shared Zod enums and add supertest coverage for invalid values.
- Run full typecheck and API tests, verify resulting constraints/indexes, record outcomes, then commit with the required P1 prefix.
Done:
- Exported all nine affected tables to ignored backups before schema/data changes, then refreshed those backups before constraint creation and before changing the goal status default.
- Added shared Zod enums and database CHECK constraints for profile role, client status, goal lifecycle, advised-plan status, lead status, and health-score tier.
- Added the `health_scores.tier` column with the documented details-based backfill; added the net-worth and health-score unique constraints. The budget-month and goal-progress unique constraints already existed and were verified.
- Mapped 24 legacy goal rows (`21 on_track`, `3 behind`) to lifecycle `active`; changed the database default from `on_track` to `active`.
- Kept the latest row per key while deduplicating 4 excess net-worth snapshots and 27 excess health-score snapshots.
- Updated API validators, free/client score history isolation, and daily net-worth/health-score upserts. Updated goal creation callers and fixtures to use lifecycle `active`; added invalid-status API tests.
Audit counts / backfills:
- Preliminary read-only audit: profiles 15 (all 4 requested roles); client_profiles 4 (all active); financial_goals 24 (21 `on_track`, 3 `behind`, both require lifecycle mapping); advised_plans 4 (all `inforce`); leads 0.
- Preliminary duplicate-key audit: client_budget_months 0; net_worth_snapshots 4 groups (4 excess rows); health_scores 3 groups (27 excess rows when tier is derived from `details`); goal_progress_snapshots 0.
- Health-score tier backfill changed 5 rows; after backfill, 3 duplicate groups/27 excess rows were removed. Net-worth deduplication removed 4 rows across 4 groups.
- Final pre-constraint audit: zero invalid profile roles, client statuses, goal statuses, advised-plan statuses, lead statuses, or health-score tiers; zero duplicate keys for budgets, net-worth snapshots, health scores, and goal-progress snapshots.
- Verified all six CHECK constraints and all four unique constraints in PostgreSQL; `financial_goals.status` now defaults to `active`.
- All 24 goals have a target date, so Phase 1's legacy free-score fallback for goals without a target is not used by current rows.
Tests: `pnpm run typecheck` passed; `pnpm --filter @workspace/api-server test` passed (17 files, 139 tests).
Commit: `fe8e53b` — `[restructure P1] enforce lifecycle and snapshot constraints`.
Decisions made by agent:
- Define `onboardingStage` and `firstFocus` shared enums in P1, but defer their CHECK constraints until P5 adds the columns; neither column exists today.
- Before deleting duplicate snapshot rows, keep the newest `created_at` row, with `id` as a deterministic tie-breaker, as required by the brief's “keep latest” rule.
- The standard schema push proposed truncating 6 rows in `advised_plan_statements`; it was declined and not retried. Applied only the audited P1 additions using targeted scripts, leaving that unrelated schema drift untouched.
Files changed:
- `artifacts/api-server/src/routes/__tests__/advisorLeadReads.test.ts`
- `artifacts/api-server/src/routes/__tests__/clientHealthScore.test.ts`
- `artifacts/api-server/src/routes/__tests__/coastPoint.test.ts`
- `artifacts/api-server/src/routes/__tests__/goalHoldingLinks.test.ts`
- `artifacts/api-server/src/routes/__tests__/healthscore.test.ts`
- `artifacts/api-server/src/routes/__tests__/offTrackTasks.test.ts`
- `artifacts/api-server/src/routes/__tests__/statusEnums.test.ts`
- `artifacts/api-server/src/routes/admin.ts`
- `artifacts/api-server/src/routes/clientHealthScore.ts`
- `artifacts/api-server/src/routes/clientPortal.ts`
- `artifacts/api-server/src/routes/goals.ts`
- `artifacts/api-server/src/routes/healthscore.ts`
- `artifacts/api-server/src/routes/investments.ts`
- `artifacts/api-server/src/routes/leads.ts`
- `artifacts/api-server/src/routes/networth.ts`
- `artifacts/api-server/src/routes/sol.ts`
- `artifacts/wealthapp/src/hooks/useGoals.ts`
- `artifacts/wealthapp/src/pages/client/ClientOnboarding.tsx`
- `artifacts/wealthapp/src/pages/free/dashboard.tsx`
- `lib/db/src/schema/advisedPlans.ts`
- `lib/db/src/schema/clients.ts`
- `lib/db/src/schema/enums.ts`
- `lib/db/src/schema/goals.ts`
- `lib/db/src/schema/health.ts`
- `lib/db/src/schema/index.ts`
- `lib/db/src/schema/leads.ts`
- `lib/db/src/schema/netWorth.ts`
- `lib/db/src/schema/profiles.ts`
- `scripts/package.json`
- `scripts/src/apply-phase1-constraints.ts`
- `scripts/src/dedupe-net-worth-snapshots.ts`
- `scripts/src/migrate-goal-lifecycle.ts`
- `scripts/src/migrate-health-score-tier.ts`
- `scripts/src/seed-demo-data.ts`
- `scripts/src/set-goal-lifecycle-default.ts`

## Blocked / questions for the product owner
- P1 CHECK constraints for `onboarding_stage` and `first_focus` are deferred until P5 introduces their columns; their shared enums are defined in P1.
- P2.5 schema push is blocked by a `client_holding_transactions` warning. Exact prompt: `You're about to add client_holding_transactions_holding_id_source_month_source_unique unique constraint to the table, which contains 1 items. If this statement fails, you will receive an error from the database. Do you want to truncate client_holding_transactions table?` Choices: `No, add the constraint without truncating the table` / `Yes, truncate the table`. The safe No choice remained highlighted; the command timed out before proceeding. No truncate option was accepted and no schema/data change was observed. A read-only recheck found 1 row, 0 duplicate groups/excess rows for `(holding_id, source_month, source)`, and an existing validated UNIQUE constraint `client_holding_transactions_holding_id_source_month_source_uniq` on that key. Do not accept this prompt or rerun push as part of Phases 3–4.

### P2 — Net worth service
Plan:
- Port the current client net-worth valuation rules to `artifacts/api-server/src/lib/netWorthService.ts`, using one exported `valueOfHolding` helper backed by the existing price-cache valuation logic.
- Add authenticated client and advisor-owned summary endpoints; update `lib/api-spec/openapi.yaml` and regenerate API client/schema code.
- Replace current net-worth reads in the client Net Worth page, dashboard ring, Sol, investment-client wealth score, coast point portfolio value, and advisor/admin client-list `portfolioValue` with the service result.
- Remove browser snapshot POSTs from client and free-tier pages; keep the snapshot route but return 410 after the browser callers are gone. Have the service upsert today's snapshot and add an idempotent nightly investment-client snapshot script.
- Add API coverage for seeded sources (holding, visible/in-force advised plan, manual asset, liability, mortgage) and assert the shared total across the summary, dashboard, Sol net-worth tool, and advisor list.
- Run the full typecheck and API test suite, verify snapshot and list behavior, record results and changed files, then commit with the required P2 prefix.
Done:
- Added the shared server computation and `valueOfHolding` in `lib/net-worth`, re-exported through `artifacts/api-server/src/lib/netWorthService.ts`; the same valuation helper is now used by goal funding and blended portfolio calculations.
- Added authenticated client and advisor-owned summary endpoints, retained the dashboard endpoint as a compatibility alias, documented the endpoints in OpenAPI, and regenerated API client/Zod outputs.
- Switched the client Net Worth page, dashboard ring, Sol summary tool, wealth score, coast point, and advisor/admin client lists to the shared service. Advisor/admin list `portfolioValue` remains the service's portfolio total; each list also returns `netWorth` from that same summary.
- Removed all browser POST callers for net-worth snapshots. The legacy POST now returns 410. Summary reads upsert one idempotent snapshot for today.
- Added `pnpm --filter @workspace/scripts run nightly-snapshots` to calculate snapshots for all investment clients.
- Seeded acceptance test values: assets $115,100; liabilities $43,000; net worth $72,100; portfolio total $110,100. Client summary, dashboard, Sol, advisor summary, and list `netWorth` agree; coast-point and list `portfolioValue` use the shared portfolio total.
- No Phase 2 database schema changes were made; no schema push was run.
Audit counts / backfills:
- Not applicable in Phase 2.
Tests: `pnpm run typecheck` passed; `pnpm --filter @workspace/api-server test` passed (18 files, 143 tests).
Commit: `b754f93` — `[restructure P2] centralize net worth calculation`.
Replit schedule instructions (documented only; not configured or deployed):
- In Replit's Publishing tool, create a Scheduled Deployment, choose a daily cron schedule and timezone, and set the run command to `pnpm --filter @workspace/scripts run nightly-snapshots`. Set a build command if the Publishing tool requires one. Scheduled Deployments do not serve web traffic. Do not create or publish it as part of this restructure.
Files changed:
- `artifacts/api-server/package.json`
- `artifacts/api-server/src/lib/blendedRate.ts`
- `artifacts/api-server/src/lib/goalProgressSnapshot.ts`
- `artifacts/api-server/src/lib/netWorthService.ts`
- `artifacts/api-server/src/routes/__tests__/netWorthSummary.test.ts`
- `artifacts/api-server/src/routes/admin.ts`
- `artifacts/api-server/src/routes/clientHealthScore.ts`
- `artifacts/api-server/src/routes/clientPortal.ts`
- `artifacts/api-server/src/routes/clients.ts`
- `artifacts/api-server/src/routes/coastPoint.ts`
- `artifacts/api-server/src/routes/networth.ts`
- `artifacts/api-server/src/routes/sol.ts`
- `artifacts/api-server/tsconfig.json`
- `artifacts/wealthapp/src/hooks/useDashboardData.ts`
- `artifacts/wealthapp/src/hooks/useNetWorthItems.ts`
- `artifacts/wealthapp/src/hooks/useNetWorthSummary.ts`
- `artifacts/wealthapp/src/pages/client/ClientNetWorth.tsx`
- `artifacts/wealthapp/src/pages/free/dashboard.tsx`
- `artifacts/wealthapp/src/pages/free/networth.tsx`
- `lib/api-client-react/src/generated/api.schemas.ts`
- `lib/api-client-react/src/generated/api.ts`
- `lib/api-client-react/src/index.ts`
- `lib/api-spec/openapi.yaml`
- `lib/api-zod/src/generated/api.ts`
- `lib/api-zod/src/index.ts`
- `lib/net-worth/package.json`
- `lib/net-worth/src/index.ts`
- `lib/net-worth/tsconfig.json`
- `pnpm-lock.yaml`
- `scripts/package.json`
- `scripts/src/nightly-snapshots.ts`
- `scripts/tsconfig.json`
- `tsconfig.json`

### P2.5 — Align advised-plan statement uniqueness
Plan:
- Inspect the current dev database index/constraint name and type for `advised_plan_statements (advised_plan_id, period_start, period_end)` and verify duplicate count is zero.
- Export `advised_plan_statements` to a fresh ignored data-only backup, then record its row count before any schema change.
- Rename the existing unique constraint or attach the existing unique index as a constraint named `advised_plan_statements_advised_plan_id_period_start_period_end_unique`, without changing table data.
- Verify the row count is unchanged and the expected constraint is valid; run the normal schema push. If it still warns about truncation, drops, renames, or data loss, answer no and record the exact prompt.
- Run full typecheck and API tests, record results and the database operation, then commit with `[restructure P2.5]`.
Observed before schema change:
- Backup created at `backups/2026-10-31-advised_plan_statements-p2.5.sql` (data-only; 2,634 bytes; ignored).
- The table contains 6 rows; duplicate key audit on `(advised_plan_id, period_start, period_end)` found 0 duplicate groups and 0 excess rows.
- PostgreSQL reports an existing validated UNIQUE constraint named `advised_plan_statements_advised_plan_id_period_start_period_end` (`contype = 'u'`), backed by a valid unique btree index of the same name on the expected columns.
- Drizzle's expected literal name is 70 characters, while PostgreSQL's `max_identifier_length` is 63; truncating the expected name yields exactly the existing constraint name. It is already a UNIQUE constraint, not a standalone index, so renaming/attaching would be a no-op and could not produce a distinct 70-character database name.
Done:
- Made the Drizzle declaration explicit with the PostgreSQL-stored 63-character name, equivalent to PostgreSQL's truncation of the auto-generated 70-character name.
- The first normal schema push showed the exact advised-plan prompt: `You're about to add advised_plan_statements_advised_plan_id_period_start_period_end_unique unique constraint to the table, which contains 6 items. If this statement fails, you will receive an error from the database. Do you want to truncate advised_plan_statements table?` Choices: `No, add the constraint without truncating the table` / `Yes, truncate the table`. No truncation was selected; the table stayed at 6 rows.
- After naming alignment, the second normal schema push no longer warned on `advised_plan_statements`, but stopped at the separate `client_holding_transactions` prompt recorded under Blocked. No schema push completed.
- Requeried `advised_plan_statements`: 6 rows before/after, 0 duplicate groups/excess rows, and the same validated UNIQUE constraint/index remain present.
Audit counts / backfills:
- `advised_plan_statements`: 6 rows; 0 duplicate groups / 0 excess rows for `(advised_plan_id, period_start, period_end)`.
Tests: `pnpm run typecheck` passed; `pnpm --filter @workspace/api-server test` passed (18 files, 143 tests).
Decisions made by agent:
- The 70-character generated identifier cannot be stored verbatim; explicitly declaring its 63-character PostgreSQL-stored form aligns Drizzle with the existing constraint without touching data.
- Do not accept the unrelated schema-push prompt for `client_holding_transactions`; the user directed continuing with Phases 3–4 if the push still warns.

## Next agent: start here
- Begin Phase 3 from `docs/client-restructure/MASTER_PROMPT.md`: first record the Phase 3 plan in this file, then work only on goal funding and goal status. Do not repeat Phases 0–2. Before any schema change, back up affected tables; reject and record any schema push warning about data loss, truncation, rename, or drop. Do not publish or deploy.
