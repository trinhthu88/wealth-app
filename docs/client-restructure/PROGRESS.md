# Restructure progress

## Current phase
P8 — Navigation 9 → 5 and Sol everywhere — done

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
- RESOLVED in P4.5 (see below): P2.5 schema push was blocked by a `client_holding_transactions` warning. Exact prompt: `You're about to add client_holding_transactions_holding_id_source_month_source_unique unique constraint to the table, which contains 1 items. If this statement fails, you will receive an error from the database. Do you want to truncate client_holding_transactions table?` Choices: `No, add the constraint without truncating the table` / `Yes, truncate the table`. The safe No choice remained highlighted; the command timed out before proceeding. No truncate option was accepted and no schema/data change was observed. A read-only recheck found 1 row, 0 duplicate groups/excess rows for `(holding_id, source_month, source)`, and an existing validated UNIQUE constraint `client_holding_transactions_holding_id_source_month_source_uniq` on that key. Do not accept this prompt or rerun push as part of Phases 3–4.
- RESOLVED (P5): risk normalisation of the deprecated `profiles.risk_profile` ran after product-owner approval; see P5 audit counts.
- RESOLVED (P7, product-owner decision): For the one conflicting free-user month, the existing shared budget month remains the source of truth. Leave the legacy row untouched as deprecated history. No data change was made.

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
- Confirmed the repository's Drizzle declaration uses the PostgreSQL-stored 63-character name, equivalent to PostgreSQL's truncation of the auto-generated 70-character name; the dev database already matches it. No database change was needed.
- The first normal schema push showed the exact advised-plan prompt: `You're about to add advised_plan_statements_advised_plan_id_period_start_period_end_unique unique constraint to the table, which contains 6 items. If this statement fails, you will receive an error from the database. Do you want to truncate advised_plan_statements table?` Choices: `No, add the constraint without truncating the table` / `Yes, truncate the table`. No truncation was selected; the table stayed at 6 rows.
- After naming alignment, the second normal schema push no longer warned on `advised_plan_statements`, but stopped at the separate `client_holding_transactions` prompt recorded under Blocked. No schema push completed.
- Requeried `advised_plan_statements`: 6 rows before/after, 0 duplicate groups/excess rows, and the same validated UNIQUE constraint/index remain present.
Audit counts / backfills:
- `advised_plan_statements`: 6 rows; 0 duplicate groups / 0 excess rows for `(advised_plan_id, period_start, period_end)`.
Tests: `pnpm run typecheck` passed; `pnpm --filter @workspace/api-server test` passed (18 files, 143 tests).
Commit: `9004f7b` — `[restructure P2.5] align Postgres unique constraint name`.
Additional progress/plan commit: `0401111` — `[restructure P2.5] record push blocker and Phase 3 plan`.
Files changed in P2.5:
- `docs/client-restructure/PROGRESS.md` (the Drizzle declaration was already present in the starting repository state).
Decisions made by agent:
- The 70-character generated identifier cannot be stored verbatim; explicitly declaring its 63-character PostgreSQL-stored form aligns Drizzle with the existing constraint without touching data.
- Do not accept the unrelated schema-push prompt for `client_holding_transactions`; the user directed continuing with Phases 3–4 if the push still warns.

### P3 — Goal funding and goal status
Plan:
- Enrich current-user, advisor-client, and advisor-lead goal responses server-side with `funding: { currentAmount, source, breakdown[] }` and derived `pacing` (`no_target`, `on_track`, `at_risk`, `off_track`, or `completed`). Linked goals use shared allocation and holding-value logic; unlinked goals use the manual `current_amount`.
- Remove link-value summing and pacing calculations from the browser goal hook; consume server-computed values while retaining link reads for editing.
- Ensure auto-update and pathway upsert cannot overwrite funding for linked goals or investment clients; make goal PUT updates partial so omitted `currentAmount` and `monthlyContribution` remain unchanged.
- Derive the free-tier health-score goal component from pacing rather than treating lifecycle `active` as pacing; keep pacing derived, never persisted.
- Convert non-USD holdings, plans, assets, liabilities, mortgages, and manual goal funding to USD inside the shared server calculation using the existing USD-base exchange-rate source and its fallback rates.
- Add deterministic API tests for linked/manual funding, partial updates, protected update paths, and a VND property plus EUR liability conversion; update API contracts/generated types as needed.
- Run full typecheck and API suite, note the intended increase for stock/ETF/crypto/bond clients because the old browser page omitted those holdings, record changed files, then commit with `[restructure P3]`.
Decisions made by agent:
- Use the existing public USD-base rate feed (`open.er-api.com/v6/latest/USD`) with the app's one-hour cache and fallback rates; keep tests deterministic with fixed rates.
Done:
- Added server-computed funding, USD breakdowns, target normalization, and derived pacing to current-user and advisor goal lists. The browser now consumes these values instead of summing linked holdings or recomputing pacing.
- Guarded auto-update and pathway upsert against linked goals and investment-client goals. Goal PUT now updates only fields present, preserving omitted current amounts and monthly contributions.
- Updated the free health-score goal component to use derived pacing without writing pacing into lifecycle status.
- Added cached server-side FX conversion using the app's existing USD-base feed and fallback values. Net-worth items, property mortgages, advised plans, manual assets/liabilities, linked/manual goal funding, Sol portfolio totals, and blended portfolio rates now convert to USD.
- Updated OpenAPI and regenerated client/Zod contracts.
- Note: clients with stocks, ETFs, crypto, or bonds will see higher net worth than the old browser page showed because that page omitted those holdings. This is intended.
Audit counts / backfills:
- No schema changes or database backfills in Phase 3.
Tests: `pnpm run typecheck` passed; `pnpm --filter @workspace/api-server test` passed (20 files, 148 tests).
Commit: `2495813` — `[restructure P3] centralize goal funding and currency values`.
Files changed in P3:
- `artifacts/api-server/src/lib/blendedRate.ts`
- `artifacts/api-server/src/lib/goalProgressSnapshot.ts`
- `artifacts/api-server/src/lib/offTrackTasks.ts`
- `artifacts/api-server/src/routes/__tests__/goalsFunding.test.ts`
- `artifacts/api-server/src/routes/__tests__/healthscore.test.ts`
- `artifacts/api-server/src/routes/__tests__/netWorthCurrency.test.ts`
- `artifacts/api-server/src/routes/goals.ts`
- `artifacts/api-server/src/routes/healthscore.ts`
- `artifacts/api-server/src/routes/sol.ts`
- `artifacts/wealthapp/src/components/client/goals/EditGoalSheet.tsx`
- `artifacts/wealthapp/src/hooks/useGoals.ts`
- `lib/api-client-react/src/generated/api.schemas.ts`
- `lib/api-client-react/src/generated/api.ts`
- `lib/api-spec/openapi.yaml`
- `lib/api-zod/src/generated/api.ts`
- `lib/net-worth/src/currencyRates.ts`
- `lib/net-worth/src/index.ts`

### P4 — One advisor pointer
Read-only baseline before the phase:
- `advisor_assignments` does not exist in the development database.
- `client_profiles` has 4 rows; all 4 currently have `advisor_id` set.
- The existing `client_profiles.advisor_id` pointer and lead assignment fallback are the authorization sources; several legacy plan/conversation rows also store advisor IDs.
Plan:
- Add the additive `advisor_assignments` table and backfill one open row for each currently assigned client. Keep `assigned_by` nullable for historical backfill rows and use the migration cutover time for `started_at`; do not invent historical assignment actors or dates.
- Before changing schema, export `client_profiles` to `backups/2026-10-31-client_profiles-p4.sql`, record its row count, and verify the count is unchanged afterwards. The table is new, so there is no existing `advisor_assignments` table to back up.
- Do not run `drizzle-kit push`: the previously recorded unrelated `client_holding_transactions` truncate warning still blocks a clean push. Create only the new table with additive development-database SQL, then backfill and audit before adding a partial unique index for one open assignment per client. Do not drop or alter existing columns/tables.
- Make admin reassignment update `client_profiles.advisor_id` and close/open assignment history in one transaction; write `assigned_by` for new assignments. Create initial assignment history for newly created clients when an advisor is already assigned.
- Resolve authorization for advised plans, financial plans, milestones, conversations, and documents from the current client pointer; retain the lead assignment fallback for pre-promotion leads. Keep legacy advisor ID columns, but stop reading them for authorization.
- Make review requests ignore request-body `advisorId` and route to the current advisor. Restrict milestone comments to the client, current advisor, or super_admin, and record the authenticated profile role.
- Add API tests for A→B reassignment (B access, A gets 403, review request reaches B), assignment history, milestone comment roles/access, and admin-created plans remaining manageable by the current advisor.
- Run full typecheck and API suite, record the final counts and changed files, then commit with `[restructure P4]`.
Done:
- Created `advisor_assignments` using additive SQL only; backfilled one open row per assigned client with nullable `assigned_by` and the database cutover timestamp.
- Backed up `client_profiles` to `backups/2026-10-31-client_profiles-p4.sql` before the schema change. The backup contains 4 rows; the table remained at 4 rows afterwards.
- Audited the backfill before creating the partial unique index: 4 assigned clients, 4 assignment rows, 0 duplicate open-client groups, and 0 assigned clients missing a matching open history row. Verified `advisor_assignments_one_open_per_client_uidx` exists.
- Admin reassignment now updates the current pointer and closes/opens assignment history transactionally. New-client creation and lead promotion also create/synchronize assignment history.
- Authorization for advised plans, financial plans, milestones, conversations, and documents now follows the current client advisor; legacy advisor columns remain and are marked deprecated. Review requests ignore body `advisorId`; milestone comments check current parties and store the authenticated profile role.
- Added A→B reassignment coverage, including B access and A 403s, review routing to B, stale conversation/document/plan ownership, real comment roles, and admin-created plans remaining manageable by the current advisor.
- No schema push was run because the previously recorded unrelated `client_holding_transactions` truncate warning remains; no tables or columns were dropped, no publish/deploy was performed.
Audit counts / backfills:
- Before: `client_profiles` 4 rows, 4 assigned; backup row count 4.
- After backfill and after the test suite: `client_profiles` 4 rows; `advisor_assignments` 4 rows, 4 open; 0 duplicate open-client groups; 0 assigned clients missing matching open history; partial unique index present.
Tests: `pnpm run typecheck` passed; `pnpm --filter @workspace/api-server test` passed (21 files, 151 tests).
Commit: `c3c68bf` — `[restructure P4] centralize advisor ownership and assignment history`.
Files changed in P4:
- `artifacts/api-server/src/lib/createUserWithProfile.ts`
- `artifacts/api-server/src/lib/currentAdvisor.ts`
- `artifacts/api-server/src/lib/promoteLead.ts`
- `artifacts/api-server/src/middlewares/requireAuth.ts`
- `artifacts/api-server/src/routes/__tests__/advisedPlanOwnership.test.ts`
- `artifacts/api-server/src/routes/__tests__/advisorAssignments.test.ts`
- `artifacts/api-server/src/routes/__tests__/leadPromotion.test.ts`
- `artifacts/api-server/src/routes/admin.ts`
- `artifacts/api-server/src/routes/clientPortal.ts`
- `artifacts/api-server/src/routes/leads.ts`
- `artifacts/api-server/src/routes/messages.ts`
- `artifacts/api-server/src/routes/plans.ts`
- `docs/client-restructure/PROGRESS.md`
- `lib/db/src/schema/advisedPlans.ts`
- `lib/db/src/schema/clients.ts`
- `lib/db/src/schema/messages.ts`

### P4.5 — Clean schema push (no data change)
Plan:
- Name the `client_holding_transactions` unique constraint to match the database; verify `advisor_assignments` (created with raw SQL in P4) matches its schema; run the normal push and resolve any remaining drift with no-data-change schema declarations only (approved by the product owner before applying).
Observed:
- `advisor_assignments` matches its schema exactly: columns, types, nullability, defaults, `advisor_assignments_client_user_id_idx`, `advisor_assignments_advisor_id_idx`, partial unique `advisor_assignments_one_open_per_client_uidx (client_user_id) WHERE ended_at IS NULL`; no foreign keys on either side.
- Naming the constraint alone did not clear the prompt. drizzle-kit compares unique constraints as `name;columns` in order, and reads columns from `information_schema.constraint_column_usage`, which returns table-column order (`holding_id, source, source_month`); the schema declared `holdingId, sourceMonth, source`. The prompt shown (not answered; stdin closed) was the same truncate question recorded in P2.5.
- A read-only diff (drizzle-kit `pushSchema` API, `apply()` never called) revealed a second hidden mismatch: two `statement_id` FKs whose generated names exceed 63 characters, so PostgreSQL stored them truncated and Drizzle wanted to drop/re-add them.
- `pg_constraint` before applying: `advised_plan_holdings_statement_id_advised_plan_statements_id_f` and `advised_plan_transactions_statement_id_advised_plan_statements_` (63 chars each), both `FOREIGN KEY (statement_id) REFERENCES advised_plan_statements(id) ON DELETE CASCADE`, `confupdtype = a` (no action).
Done:
- `lib/db/src/schema/clientHoldings.ts`: unique constraint named `client_holding_transactions_holding_id_source_month_source_uniq`, columns declared as `(holdingId, source, sourceMonth)`. The live constraint (index order `holding_id, source_month, source`) is untouched; uniqueness and `ON CONFLICT` inference depend on the column set, not order.
- `lib/db/src/schema/advisedPlans.ts`: both `statement_id` FKs declared with explicit `foreignKey({ name: <stored 63-char name> }).onDelete("cascade")`.
- Backups (ignored): `backups/2026-11-01-{client_holding_transactions,advisor_assignments,advised_plan_holdings,advised_plan_transactions,advised_plan_statements}-p4.5.sql`.
- Normal push output: `[✓] Pulling schema from database...` / `[i] No changes detected` — no prompts, no statements, exit 0.
Audit counts / backfills:
- Row counts before/after: client_holding_transactions 1/1, advisor_assignments 4/4, advised_plan_holdings 6/6, advised_plan_statements 6/6. No data changed.
Tests: `pnpm run typecheck` passed; `pnpm --filter @workspace/api-server test` passed (21 files, 151 tests).
Decisions made by agent:
- None beyond the approved fixes. Later phases can use the normal `pnpm --filter @workspace/db run push`.

### P5 — Profile fields and onboarding state
Plan:
- Back up `profiles` and `client_profiles`, then add with the normal schema push (additive, nullable or defaulted): `profiles.date_of_birth date` (owner: profiles; 1st of chosen month), `client_profiles.risk_profile_source` (`self`|`advisor`, nullable), `client_profiles.onboarding_stage` (NOT NULL default `not_started`), `client_profiles.first_focus` (nullable), each with a CHECK from the shared enums (deferred from P1). No drops/renames.
- Backfills (idempotent `scripts/src/` scripts with `--dry-run`; audit counts and exact rows shown to the product owner and approved before each real run):
  1. Currency: copy `client_profiles.preferred_display_currency` → `profiles.preferred_currency` where profiles is the default `USD` and they differ.
  2. Risk: copy `profiles.risk_profile` → `client_profiles.risk_profile` with source `self` where client_profiles has none (creating the row if missing).
  3. Onboarding stage: `onboarding_track_complete` → `complete`; basics saved → `profile`; else `not_started`.
- Code: currency reads/writes go to `profiles.preferred_currency`; risk reads/writes (free tier, `PUT /profiles/me`, self-service, advisor) go to `client_profiles` with source; onboarding routes write and routing reads only `onboarding_stage`; `GET /client/profile/track` derives track from visible advised plans and stops writing `client_track`; `PUT /client/profile/basics` stores `dateOfBirth`; coast point reads DOB from profiles where it needs age; remove `status` from client-writable allowlists; `PUT /client/holdings/:id` uses an explicit field allowlist.
- Super-admin branch of `GET /advisor/clients` filters to `investment_client` so free users' new client_profiles rows do not appear as clients.
- Tests: each backfill rule, derived track, a client cannot change own status or a holding's owner, DOB round-trip, risk source.
Audit counts (read-only, before any change):
- profiles 15 (11 without a client_profiles row); client_profiles 4; 0 orphan client_profiles.
- Currency: all 15 profiles `USD`; all 4 client_profiles `USD` → 0 rows to change.
- Risk: all 4 client_profiles already have a risk value → 0 updates; 6 free users have `profiles.risk_profile` and no client_profiles row (4 are `onboardtest_*@example.com` test leftovers).
- Onboarding: all 4 client_profiles have `onboarding_track_complete = true`.
- Track: 2 client_profiles have visible advised plans (stored `track_a`), 2 have none (stored `track_b`) → derived track matches stored for all 4.

Done:
- Schema (normal push, additive only; second push `No changes detected`): `profiles.date_of_birth`, `client_profiles.risk_profile_source`, `client_profiles.onboarding_stage` (NOT NULL default `not_started`), `client_profiles.first_focus`; CHECKs `client_profiles_onboarding_stage_check`, `client_profiles_first_focus_check`, `client_profiles_risk_profile_source_check`, and (after backfill 2 and a 0-violation audit) `client_profiles_risk_profile_check` (`conservative`, `balanced`, `growth`). Owner/deprecation comments added in `profiles.ts` and `clients.ts`.
- Shared enums: `riskProfileValues` / `riskProfileSchema`, `normalizeRiskProfile()` (lowercase; `moderate` → `balanced`, `aggressive`/`growth-oriented` → `growth`; anything else → null/400), `riskProfileSourceValues`.
- Risk: every writer stores the vocabulary in `client_profiles` with a source. `PUT /profiles/me` and `PUT /client-profile/me` write `self`; the advisor `PUT /advisor/clients/:id/client-profile`, admin create user and lead convert write `advisor`. Invalid values return 400. `GET`/`PUT /profiles/me` return the owned value; `profiles.risk_profile` is no longer written. The free-tier quiz keeps its 4 display labels but saves the mapped value. The advisor and admin selects offer only the 3 values.
- Currency: `PUT /client/profile/basics` and `POST /client/onboarding/complete` write `profiles.preferred_currency` (they accept `preferredCurrency`, or the legacy `preferredDisplayCurrency` key). `GET /client/profile/track` returns `preferredCurrency` from profiles. `preferred_display_currency` is no longer read or written by the API (it is also removed from the advisor allowlist).
- Onboarding: basics sets stage `profile`, complete sets `complete`, and neither ever steps back. Routing (`RoleRedirect` → `resolveRoleRedirectPath`) reads only `onboardingStage`. The routes no longer write `onboarding_track_complete`.
- Date of birth: basics accepts `YYYY-MM` (or a full date, day discarded) and stores `YYYY-MM-01`; invalid or future dates return 400. `PUT /profiles/me` accepts it too. Client onboarding sends month + year. Coast point currently takes no age input, so there is no DOB consumer yet; `GET /profiles/me` returns it.
- Track: `GET /client/profile/track` derives `track: advised | self_managed` from visible advised plans, plus `hasPendingAdvisorSetup` (hidden plans exist, none visible). Nothing writes `client_track` any more (advised-plan create, lead promotion, advisor allowlist). `useClientTrack` reads the derived value.
- Allowlists: `status` removed from `PUT /client-profile/me` (ignored, not 400). `PUT /client/holdings/:id` uses an explicit text/numeric field allowlist; `id`/`userId` are never writable.
- "Row exists ⇒ client" audit (requested before backfill 2):
  - Lead promotion already updated an existing row; its insert branch now also upserts on `user_id`. It keeps preference fields on the row.
  - `getCurrentAdvisorIdForClient`, `requireAdvisorOwnsClientOrLead` and `getClientUserIdsForAdvisor` treated any row as the advisor pointer. A free-user lead with a risk-only row would resolve to "no advisor", and their advisor would get 403 on the lead's plans. All three now honour the row only when `role = investment_client`, otherwise they fall back to the lead.
  - `GET /advisor/clients` filters `role = investment_client` in both the advisor and super_admin branches (the admin branch already did). `/admin/clients` and the nightly snapshot job already filtered on role.
  - `requireAdvisorOwnsClient`/`requireAdvisorOwnsPackage` match on `advisor_id` (null for free users) and were left as-is. Off-track tasks and Sol's advisor name read only `advisor_id`, so behaviour is unchanged for free users. The frontend redirect is role-based.
- Behaviour change to note: `contact@erickson.vn` is a `free_user` with a client_profiles row that has `advisor_id` set and no lead. They no longer appear in that advisor's list, and plan/conversation ownership no longer resolves to that advisor.
- Follow-up (approved by the product owner): cleared that stale pointer with `scripts/src/p5-unassign-advisor.ts` (`--user`, `--dry-run`; it refuses unless the user is a `free_user` with no lead). It makes the same two writes as `PUT /admin/users/:id` with `advisorId: null`, which needs a Clerk super_admin session and so cannot run from the shell.
  - Backups: `backups/2026-11-01-{client_profiles,advisor_assignments}-p5-unassign.sql`; both confirmed to contain the user's rows.
  - In one transaction: `client_profiles` `00e8f4c3-e74c-4c66-8910-062ee00108eb` `advisor_id` `user_3DrRdwtutIsin4539iRe8N8h53s` (trang.tt@hsp.consulting) → null; `advisor_assignments` `189b736a-3063-4b4a-b6f6-148ab5a76e3d` `ended_at` → 2026-11-01 12:45:44 UTC (row kept as history). Rerun: nothing to change.
  - Verified against the list filters: the user is in no advisor's `GET /advisor/clients` (both advisors and the super_admin), not in `/admin/clients`, and has no lead pointing at an advisor. The client_profiles row (risk `balanced`, stage `complete`) is otherwise unchanged.
- Seed: free users' risk goes to client_profiles (source `self`); `moderate` → `balanced`; client rows get `onboardingStage: "complete"`; no `clientTrack`/`preferredDisplayCurrency`/`profiles.riskProfile` writes for clients.
- OpenAPI `Profile`/`UpdateProfileBody`: risk enum, `riskProfileSource`, `dateOfBirth`; codegen run.
Audit counts / backfills:
- Before: profiles 15, client_profiles 4. Backups: `backups/2026-11-01-{profiles,client_profiles}-p5.sql`, `backups/2026-11-01-client_profiles-p5-risk-check.sql`.
- Backfill 1 currency (`p5-backfill-currency`): 0 candidates and 0 conflicts. Not run (no-op).
- Backfill 3 onboarding stage (`p5-backfill-onboarding-stage`), run after approval: 4 rows `not_started → complete` (contact@erickson.vn, elena.novak, james.whitfield, trang.tt; all had `onboarding_track_complete = true`). Rerun: 0.
- Backfill 2 risk (`p5-backfill-risk-profile`), run after approval and after the promotion test passed: 0 updates; created 2 rows, marcus.reyes `conservative` and sofia.chen `balanced` (from `moderate`), both source `self`. Rerun: 0. The 4 existing client risk values keep `risk_profile_source = NULL` (unknown origin).
- Risk normalisation (`p5-normalize-risk-profile`), run after approval: backup `backups/2026-11-01-profiles-p5-risk-normalize.sql`; updated 3 deprecated `profiles.risk_profile` rows (contact@erickson.vn `Aggressive → growth`, sofia.chen `moderate → balanced`, trang.tt `Conservative → conservative`) and 0 client_profiles rows. Rerun: 0. The only remaining non-vocabulary values are the 4 skipped `onboardtest_*` rows (`Conservative`).
- Risk CHECK audit: 0 violations among 6 client_profiles rows.
- After: profiles 15, client_profiles 6.
- Every backfill script supports `--dry-run` and a repeatable `--user=<id>` scope (tests use it so they touch only fixtures); each excludes `onboardtest_*@example.com`.
Tests: `pnpm run typecheck` passed; `pnpm --filter @workspace/api-server test` passed (22 files, 164 tests). wealthapp `roleRedirect.test.ts` passed (5).
- New `profileFieldsP5.test.ts` (13 tests):
  - A free user with a risk-only row is promoted successfully and appears in the advisor's list only after promotion.
  - The lead's advisor keeps access before promotion; a free user pointing at the advisor stays out of the list.
  - Risk via `PUT /profiles/me` (mapped, source self, deprecated column untouched; 400 on an invalid value).
  - Self-service status is ignored; the holding owner cannot change.
  - DOB stored as the 1st of the month; invalid/future DOB returns 400; currency on profiles; stage never steps back.
  - Derived track (hidden → pending, visible → advised) with no `client_track` write.
  - One test per backfill rule (currency, normalisation, risk, onboarding stage).
- Updated tests: `leadPromotion` (derived track instead of the stored column), `advisorAccessControl` (`aggressive` → `growth`, source advisor), `statusEnums` (invalid client status now checked on the admin route with a real super_admin fixture; the self-service route ignores status).
- During development two failing runs of the old track test left fixtures behind (2 lead users, their 2 plans and assignment rows, 2 test advisors, an orphan `enum-test-user` client_profiles row). They were deleted by exact ID; counts returned to the baseline before the backfills ran.
Decisions made by agent:
- "Basics saved" in the onboarding backfill means `profiles.country_code IS NOT NULL`: the basics step is the only writer, while `full_name` also comes from sign-up. No current row needed it.
- The free-tier `profiles.onboarding_complete` flag still drives free-tier routing. Free users have no onboarding stage, and the free-tier redesign is out of scope.
- The free pathway step 6 still stores its display label in `pathway_steps.form_data`, a remaining copy of risk, for a later phase.
- The client onboarding date input is still a day picker; the client sends only `YYYY-MM`. Phase 6 replaces the screen with a month + year control.
Test data to clean up (not deleted; skipped by all P5 backfills):
- `onboardtest_*@example.com` free users created 2026-08-31 19:22–19:31 UTC: `user_3Ih5s4Bej9SHhEgqsmZ5HvdkSZi`, `user_3Ih64lmoG01ZUconwxylnux9ZIs`, `user_3Ih6YN8g7lN71SNigCGumwJASgR`, `user_3Ih6idWcukAGqPxn8bfP2TK3T1P`, `user_3Ih6vUHS3xhaNzJagpQ5jnVRC67`. Four have `profiles.risk_profile = Conservative`; none has a client_profiles row.
- Source: no code in this repo (API tests, scripts, frontend, git history) creates `onboardtest_` users. They have real Clerk IDs and timestamps minutes apart, which matches a browser-driven sign-up run from outside the repo (for example an agent's e2e check), not the API suite (which mocks Clerk and leaves `profiles` unchanged). There was no in-repo test to fix. Whoever runs that e2e flow should delete its users afterwards, or use the Clerk test-mode `+clerk_test` addresses.
### P6 — New onboarding + setup checklist
Plan:
- Before schema changes, export `client_profiles` to a dated ignored SQL backup and record/verify its row count. Add only `starting_from_zero` and `checklist_hidden` boolean preferences with safe defaults using the normal schema push; if it warns about truncation, data loss, renames, or drops, answer no, quote it under Blocked, and stop that schema step.
- Add the authenticated `GET /client/setup-checklist` and preference update API, plus OpenAPI contracts/codegen. Derive all six done states from current-month budget, active goals, holdings/assets/liabilities or starting-from-zero, goal links, client risk profile, and a client-authored advisor message. Return current advisor and setup counts for onboarding Welcome, plus budget-month wealth-score progress.
- Order checklist items by `first_focus`: default/`save_for_big` and `know_my_money` use the master order; `organise_existing` starts with wealth; choose and record sensible orders for `start_investing` and `plan_retirement`.
- Replace investment-client onboarding with Welcome, About you, and first-focus screens. About you writes profile basics and stage `profile`; the final choice writes `first_focus`, advances to `complete`, and routes Home. Keep localStorage only for an unsaved About you draft; remove the free-pathway bridge and obsolete income/track/holdings/summary/goal/expense screens after the replacement works.
- Add the Home checklist at the top with persisted hide/starting-from-zero preferences, wealth-score progress, and links to the existing Budget, Goals, Portfolio/Net Worth, goal-link sheet, and Messages surfaces. Add a five-question self-assessed risk sheet that saves only conservative/balanced/growth with source `self`; do not change free-tier onboarding or create duplicate forms.
- Add API tests for each checklist completion source, preference behavior, first-focus ordering, month+year DOB storage, and forward-only onboarding stage. Run full typecheck and API suite, record exact results/files and manual preview-check screens, then commit with `[restructure P6]`.

Done:
- Backed up `client_profiles` to ignored `backups/2026-11-01-client_profiles-p6.sql`; row count was 6 before and after. Added only `starting_from_zero` and `checklist_hidden`, both NOT NULL DEFAULT false. Normal schema push applied the additions and printed no truncation, data-loss, rename, or drop prompt.
- Added authenticated checklist and preference endpoints with OpenAPI/Zod contracts. All six done states are computed from existing budget, goal, wealth, goal-link, risk, and message data; only starting-from-zero and hidden are stored as preferences.
- Added the three-screen investment-client onboarding, Home checklist, five-question self-assessed risk sheet, and existing goal-link deep link. Removed the old investment-client onboarding form screens and free-tier pathway bridge. The free-tier onboarding files were not changed.
- Checklist order decisions: know-my-money and save-for-big use the master default; organise-existing starts with wealth; start-investing starts wealth, risk, goal; plan-retirement starts goal, wealth, risk. The rest of each order preserves the relative sequence of the remaining setup items.
- Only the investment-client experience changed. No publish or deployment was performed.

Tests and build:
- `pnpm run typecheck` — passed.
- `pnpm --filter @workspace/api-server test` — passed, 23 test files and 169 tests.
- `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/wealthapp run build` — passed. Vite reported existing sourcemap-location warnings in shared UI components and a large-chunk warning; build completed successfully.

Manual product-owner checks (the preview browser cannot sign in, so signed-in screens were not visually verified):
1. `/client/onboarding`, Welcome: verify client/advisor names and visible-plan, goal, and budget-month counts; confirm there are no inputs.
2. `/client/onboarding`, About you: verify name prefill, month/year DOB selects, country, expat option, currency, required validation, save, and return-to-draft behavior.
3. `/client/onboarding`, first focus: verify the five choices, save, and redirect to `/client/dashboard`.
4. `/client/dashboard`: verify checklist order and each item’s done state; test Hide/Show again, starting-from-zero, and the “n of 3” wealth-score progress.
5. `/client/dashboard`, risk check: answer all five questions, save each possible risk tier, and confirm the risk item completes.
6. Follow checklist links to `/client/budget`, `/client/goals`, `/client/portfolio`, `/client/messages`; verify the goal-link item opens the existing link sheet at `/client/goals?openLink=<goalId>`.

Files changed in P6:
- API: `artifacts/api-server/src/routes/clientPortal.ts`; `artifacts/api-server/src/routes/__tests__/profileFieldsP5.test.ts`; `artifacts/api-server/src/routes/__tests__/setupChecklistP6.test.ts`.
- Database and contracts: `lib/db/src/schema/clients.ts`; `lib/api-spec/openapi.yaml`; generated `lib/api-client-react/src/generated/api.ts`, `lib/api-client-react/src/generated/api.schemas.ts`, and `lib/api-zod/src/generated/api.ts`.
- Frontend: `artifacts/wealthapp/src/pages/client/ClientOnboarding.tsx`, `ClientDashboard.tsx`, `ClientGoals.tsx`; `artifacts/wealthapp/src/hooks/useProfile.ts`; `artifacts/wealthapp/src/components/client/ClientSetupChecklistCard.tsx`, `ClientRiskCheckSheet.tsx`, `goals/GoalHoldingLinks.tsx`, `onboarding/OnboardingNav.tsx`, and `onboarding/OnboardingShell.tsx`.
- Removed obsolete client onboarding files: `artifacts/wealthapp/src/components/client/onboarding/HoldingMiniForm.tsx` and the nine screens under `artifacts/wealthapp/src/components/client/onboarding/phases/`.
- Progress record: `docs/client-restructure/PROGRESS.md`.

### P6 review fixes
Plan:
- Fix checklist freshness after risk saves and move risk banding into a small tested scoring function with the requested 3/4/7/8 boundaries.
- Require valid month/year DOB when investment clients save About you; reject onboarding completion before stage `profile`; preserve omitted full name and country fields.
- Count active holdings only, count goal links only for active goals, and calculate the budget month in `Asia/Ho_Chi_Minh` as the fallback client timezone.
- Add API coverage for the onboarding guards, deleted holdings, Vietnam month boundary, and cancelled-goal links. No schema change is planned.
- Run the full typecheck and API suite, record results and changed files, commit as `[restructure P6] review fixes`, and push to GitHub `main`.
- Manually list the signed-in onboarding and Home checklist screens for the product owner to recheck.
Decisions made by agent:
- Read the browser's IANA timezone from `x-client-time-zone` for the checklist request; fall back to `Asia/Ho_Chi_Minh` when the timezone is missing or invalid.
Done:
- After a successful risk-profile save, invalidate and refetch the setup checklist; extracted scoring into `riskProfileFromScore` with bands 0–3 conservative, 4–7 balanced, and 8–10 growth.
- About you now rejects missing or invalid DOB for investment clients; onboarding completion requires stage `profile` or `complete`. Partial About-you requests preserve omitted name, country, and expat fields.
- The wealth item counts active holdings only; the goal-link item counts links only for active goals.
- The checklist uses the browser's IANA timezone when supplied and falls back to Vietnam time when missing or invalid. No schema change was needed.
- No publish or deployment was performed.
Tests:
- `pnpm run typecheck` — passed.
- `pnpm --filter @workspace/api-server test` — passed, 23 test files and 174 tests.
- `pnpm --filter @workspace/wealthapp test` — passed, 7 test files and 70 tests, including risk-band edge cases.
Manual product-owner checks (signed-in screens require a client account; preview browser cannot sign in):
1. `/client/onboarding`, About you: confirm DOB is required, a valid month/year saves, and a partial save does not clear the existing full name or country.
2. `/client/onboarding`, first focus: confirm direct completion is refused until About you has been saved.
3. `/client/dashboard`, risk check: save answers and confirm “Set your risk profile” ticks immediately without reloading; sample totals 3, 4, 7, and 8 to verify the tier boundaries.
4. `/client/dashboard`, budget checklist item: verify the current month follows the browser's local timezone around month change; when unavailable, it follows `Asia/Ho_Chi_Minh`.
5. `/client/dashboard`, wealth item: verify an inactive/deleted holding alone does not complete it.
6. `/client/dashboard`, goal-link item: verify a link on a completed or cancelled goal does not complete it; an active goal link does.
Files changed:
- `artifacts/api-server/src/routes/clientPortal.ts`
- `artifacts/api-server/src/routes/__tests__/setupChecklistP6.test.ts`
- `artifacts/wealthapp/src/components/client/ClientRiskCheckSheet.tsx`
- `artifacts/wealthapp/src/lib/riskScore.ts`
- `artifacts/wealthapp/src/lib/__tests__/riskScore.test.ts`
- `lib/api-client-react/src/custom-fetch.ts`
- `docs/client-restructure/PROGRESS.md`

### P7 — Quick budget + advisor budget summary
Plan:
- Before any schema change or migration write, export `budget_entries`, `client_budget_months`, and `client_profiles` to fresh ignored data-only backups; record and verify each row count. Keep the 38 `budget_transactions` rows and check their foreign-key dependencies before changing budget code.
- Add `client_profiles.share_budget_with_advisor` as a boolean defaulting false. If the normal schema push asks to truncate, drop, rename, or lose data, answer no and record the exact prompt; use only a safe additive operation if needed.
- Add an idempotent migration script for free-tier budget rows. Run and record a dry run first, skip/log rows colliding with an existing shared month, never overwrite a shared row, then apply and verify counts. Audit duplicate free-tier source months and log their handling; do not drop `budget_entries`.
- Keep the free budget route contract while backing monthly reads/writes with `client_budget_months`; move free health-score and Sol budget reads to the same shared month rows. Keep transaction CRUD/carry-forward on `budget_transactions`, and mark `budget_entries` deprecated in the schema.
- Update the investment-client Budget page to show take-home plus the six main spending lines by default, reveal the full lines with “Add detail,” retain entered detail, copy the previous month into an unsaved draft, and save only on explicit save.
- Add the client consent toggle on Messages/Advisor and an advisor-owned, super-admin-accessible last-12-month summary endpoint that returns only income, spending, surplus, and savings rate when consent is on; show a read-only advisor client-detail card and a clear not-shared state.
- Update OpenAPI and generated contracts; add API/UI tests for consent and authorization, no line items, migration dry-run/copy/conflicts/idempotence, unchanged free budget/health-score values, and quick/detail saves to one shared month.
- Run `pnpm run typecheck`, the API suite, and WealthApp tests; record results, audit/backup counts, decisions, and changed files. Commit with `[restructure P7]`, push to GitHub `main`, and do not publish or deploy.
Done:
- Created ignored data-only backups before schema/data changes: `backups/2026-11-01-budget_entries-p7.sql` (12 rows), `backups/2026-11-01-client_budget_months-p7.sql` (14 rows), and `backups/2026-11-01-client_profiles-p7.sql` (6 rows). The schema push applied only the additive `share_budget_with_advisor` column; it showed no truncate/drop/rename warning, and `client_profiles` remained at 6 rows. `budget_transactions` had no FK dependency on `budget_entries`; its 38 rows remain.
- Migration dry run: 9 free-tier source rows across 5 user/month keys; 4 duplicate groups with 4 excess rows (all duplicate values identical); 0 ambiguous groups; 1 existing shared-month conflict; 4 month keys eligible to copy. Apply inserted 4 shared rows, skipped the existing conflict without overwrite, and retained the duplicate source rows. Post-migration counts: 12 legacy rows (9 free-tier), 18 shared budget months (6 free-tier), and 38 budget transactions. A second run is covered by the idempotence test.
- The free monthly budget routes now adapt their legacy request/response fields to the shared table and are limited to free users; transaction CRUD remains on `budget_transactions`, including the update route used by the existing page. Health score and Sol read the shared months.
- Investment client Budget now defaults to take-home plus housing, food, transport, utilities, entertainment, and other; “Add detail” reveals all lines. Prior detail auto-expands and remains included in totals. A new month is an unsaved previous-month draft until explicit save.
- Added the default-off advisor sharing toggle, owner-checked/super-admin-accessible 12-month summary endpoint (aggregate fields only), and read-only advisor client-detail card.
- No publish or deployment was performed.
Decisions made by agent:
- Keep pre-existing shared rows authoritative and never overwrite a conflicting month, per the migration rule. The product owner confirmed the shared month is authoritative; leave the one conflicting legacy row untouched as deprecated history. No data change was made, and the blocker is resolved.
- Keep free-tier monthly route responses in their existing shape while storing them in the shared table; restrict those monthly routes to `free_user` so they cannot overwrite investment-client detail.
Tests:
- OpenAPI code generation and library typecheck — passed.
- `pnpm run typecheck` — passed.
- `pnpm --filter @workspace/api-server test` — passed, 24 test files and 179 tests.
- `pnpm --filter @workspace/wealthapp test` — passed, 7 test files and 70 tests.
Manual product-owner checks (the preview capture shows the sign-in page; the signed-in screens were not verified by the capture browser):
1. Investment client `/client/budget`: quick view has the six requested categories in order; “Add detail” reveals all lines and existing details stay visible/included.
2. Investment client `/client/budget`: switch to a new month, adjust the copied previous-month draft, verify nothing persists until “Save budget,” then check quick and detailed edits are one month.
3. Client `/client/messages`: toggle “Share my monthly budget summary with my advisor”; confirm default off and saved state after reload.
4. Advisor `/advisor/clients/:id` Profile tab: check the not-shared message, then enable consent and confirm the card shows only monthly totals.
5. Free-tier `/budget`: verify existing budget figures, create/update a month, and edit a transaction. The accepted shared-month source-of-truth decision requires no data reconciliation.
Files changed:
- `artifacts/api-server/src/routes/__tests__/budgetP7.test.ts`
- `artifacts/api-server/src/routes/__tests__/healthscore.test.ts`
- `artifacts/api-server/src/routes/budget.ts`
- `artifacts/api-server/src/routes/clients.ts`
- `artifacts/api-server/src/routes/healthscore.ts`
- `artifacts/api-server/src/routes/investments.ts`
- `artifacts/api-server/src/routes/sol.ts`
- `artifacts/wealthapp/src/hooks/useClientBudget.ts`
- `artifacts/wealthapp/src/pages/advisor/client-detail.tsx`
- `artifacts/wealthapp/src/pages/client/ClientBudget.tsx`
- `artifacts/wealthapp/src/pages/client/messages.tsx`
- `lib/api-client-react/src/generated/api.schemas.ts`
- `lib/api-client-react/src/generated/api.ts`
- `lib/api-spec/openapi.yaml`
- `lib/api-zod/src/generated/api.ts`
- `lib/db/src/schema/budget.ts`
- `lib/db/src/schema/clients.ts`
- `scripts/package.json`
- `scripts/src/migrate-free-budget-entries.ts`
- `docs/client-restructure/PROGRESS.md`

### P8 — Navigation 9 → 5 and Sol everywhere
Plan:
- Replace only the investment-client `ClientAppShell` navigation with Home, Money, Wealth, Goals, and Advisor on desktop and mobile; confirm free users remain on their separate shell with current access unchanged.
- Add linkable Wealth, Goals, and Advisor tabs using URL paths; reuse the existing pages and forms for Overview, Investments, Property & debts, Goals, My plan, What-if, Messages, and Documents.
- Add canonical routes and redirects for every old client page and detail URL while preserving IDs, query parameters, the goal-link setup-checklist deep link, and browser history. Update checklist destinations and internal client links.
- Add a floating Sol chat control to every investment-client shell page, reusing the existing Sol chat/conversation API without changing its behavior or persona; position it above the mobile bar and safe areas.
- Add routing coverage for legacy URL destinations/tabs and assert the mobile bar has exactly five items. Run full typecheck, API tests, WealthApp tests, and the production web build.
- No schema change is planned. Do not publish or deploy. Record the signed-in desktop and phone-width screens for manual review; commit with `[restructure P8]` and push to GitHub `main`.
Done:
- Commit `db02683` — `[restructure P8] implement five-place navigation and floating Sol`.
- Replaced the investment-client desktop and mobile navigation with the five required places and linkable section tabs. Free-tier routes continue using the separate free shell and navigation unchanged.
- Added canonical routes and replace-style redirects for legacy client pages, including holding, advised-plan, fund, and package detail routes. Query strings and goal-link deep links are retained; internal links and checklist destinations now use canonical URLs.
- Reused the existing net-worth page and forms for Overview and Property & debts, and removed the duplicate Goals/My plan tabs in favor of the shared Goals section tabs.
- Added a floating Sol chat control for signed-in investment clients on every `/client/*` page, backed by the existing conversation and chat endpoints. No Sol API behavior or persona, database schema, or database data changed.
- No schema push, publish, or deployment was performed.
Audit counts / backfills:
- Not applicable. Phase 8 made no schema or database changes.
Tests:
- `pnpm run typecheck` — passed across libraries and all four scoped workspace projects.
- `pnpm --filter @workspace/api-server test` — passed, 24 files and 179 tests.
- `pnpm --filter @workspace/wealthapp test` — passed, 8 files and 88 tests, including legacy URL/tab routing and five-item navigation coverage.
- `PORT=24415 BASE_PATH=/ pnpm --filter @workspace/wealthapp run build` — passed. Vite reported existing sourcemap-location warnings and a large-chunk warning; no build errors.
- Restarted the WealthApp and API Server workflows; both started successfully. The preview capture loaded the sign-in page, so the signed-in client UI was not verified by the capture browser.
Decisions made by agent:
- Free users do not share the investment-client shell: `/free/*` continues through its separate `AppShell` and `BottomNav`; investment routes remain role-protected.
- The mobile Sol control is positioned above the five-item bar and safe area; on onboarding it sits at the top-right so it does not cover the bottom primary action.
Manual product-owner checks (signed-in screens were not visually verified because the preview capture browser cannot sign in):
1. Desktop and phone: `/client/dashboard` — confirm the Home place and setup checklist render, the bottom bar has exactly Home, Money, Wealth, Goals, Advisor, and Sol does not cover the bar or page actions.
2. Desktop and phone: `/client/money` and legacy `/client/budget` — confirm both land on Budget and Money is selected.
3. Desktop and phone: `/client/wealth/overview`, `/client/wealth/investments`, and `/client/wealth/property-debts` — check each selected tab and its existing content/forms; open a holding and advised-plan detail from Investments and use their back links.
4. Desktop and phone: `/client/goals/goals`, `/client/goals/my-plan`, and `/client/goals/what-if` — verify tab selection; open the checklist goal-link item and confirm its link sheet opens the intended goal.
5. Desktop and phone: `/client/advisor/messages` and `/client/advisor/documents` — verify the budget-sharing toggle, request-a-review action, and Documents tab.
6. Phone: open Sol on Home, Money, Wealth, Goals, Advisor, and onboarding; confirm the chat sheet opens, can send a message, and respects safe areas.
Files changed:
- `artifacts/api-server/src/routes/__tests__/setupChecklistP6.test.ts`
- `artifacts/api-server/src/routes/clientPortal.ts`
- `artifacts/wealthapp/src/App.tsx`
- `artifacts/wealthapp/src/components/client/AppShell.tsx`
- `artifacts/wealthapp/src/components/client/FloatingSolChat.tsx`
- `artifacts/wealthapp/src/components/client/SolNarration.tsx`
- `artifacts/wealthapp/src/components/client/TrackBConversionCTA.tsx`
- `artifacts/wealthapp/src/components/client/budget/SurplusCTA.tsx`
- `artifacts/wealthapp/src/components/client/dashboard/DashboardPendingState.tsx`
- `artifacts/wealthapp/src/components/client/dashboard/sections/BudgetSnapshotSection.tsx`
- `artifacts/wealthapp/src/components/client/dashboard/sections/ConversionCTASection.tsx`
- `artifacts/wealthapp/src/components/client/dashboard/sections/GoalsProgressSection.tsx`
- `artifacts/wealthapp/src/components/client/dashboard/sections/NetWorthRingSection.tsx`
- `artifacts/wealthapp/src/components/client/dashboard/sections/PortfolioSnapshotSection.tsx`
- `artifacts/wealthapp/src/components/client/dashboard/sections/QuickActionsSection.tsx`
- `artifacts/wealthapp/src/components/client/dashboard/sections/ScenarioAlertSection.tsx`
- `artifacts/wealthapp/src/components/client/goals/GoalScenarioCTA.tsx`
- `artifacts/wealthapp/src/components/client/networth/LiabilitySection.tsx`
- `artifacts/wealthapp/src/components/client/networth/NetWorthItemRow.tsx`
- `artifacts/wealthapp/src/components/client/plan/MilestoneCard.tsx`
- `artifacts/wealthapp/src/components/client/plan/PlanHeader.tsx`
- `artifacts/wealthapp/src/components/client/plan/RequestReviewSheet.tsx`
- `artifacts/wealthapp/src/components/client/portfolio/advised/AdvisedPlanSection.tsx`
- `artifacts/wealthapp/src/components/client/scenarios/BringUnderManagementCompare.tsx`
- `artifacts/wealthapp/src/components/client/scenarios/inputs/RetireEarlierForm.tsx`
- `artifacts/wealthapp/src/lib/clientNavigation.ts`
- `artifacts/wealthapp/src/lib/__tests__/clientNavigation.test.ts`
- `artifacts/wealthapp/src/pages/client/AdvisedPlanDetail.tsx`
- `artifacts/wealthapp/src/pages/client/ClientDashboard.tsx`
- `artifacts/wealthapp/src/pages/client/ClientGoals.tsx`
- `artifacts/wealthapp/src/pages/client/ClientNetWorth.tsx`
- `artifacts/wealthapp/src/pages/client/ClientPlan.tsx`
- `artifacts/wealthapp/src/pages/client/FundDetail.tsx`
- `artifacts/wealthapp/src/pages/client/HoldingDetail.tsx`
- `artifacts/wealthapp/src/pages/client/messages.tsx`
- `artifacts/wealthapp/src/pages/client/package-detail.tsx`
- `artifacts/wealthapp/src/pages/client/packages.tsx`
- `docs/client-restructure/PROGRESS.md`

## Next agent: start here
- Phase 8 is complete. Wait for a new user instruction before starting Phase 9 or Phase 10.
