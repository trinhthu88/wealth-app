# Restructure progress

## Current phase
P1 — Enums, constraints, unique indexes — implementation and verification complete; commit pending

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
Decisions made by agent:
- Define `onboardingStage` and `firstFocus` shared enums in P1, but defer their CHECK constraints until P5 adds the columns; neither column exists today.
- Before deleting duplicate snapshot rows, keep the newest `created_at` row, with `id` as a deterministic tie-breaker, as required by the brief's “keep latest” rule.
- The standard schema push proposed truncating 6 rows in `advised_plan_statements`; it was declined and not retried. Applied only the audited P1 additions using targeted scripts, leaving that unrelated schema drift untouched.

## Blocked / questions for the product owner
- P1 CHECK constraints for `onboarding_stage` and `first_focus` are deferred until P5 introduces their columns; their shared enums are defined in P1.
- `pnpm --filter @workspace/db run push` remains blocked by pre-existing drift: Drizzle proposed truncating 6 `advised_plan_statements` rows to add a unique constraint. The safe “No” option was selected. Do not rerun or accept a truncation prompt; targeted P1 changes have been applied without touching that table.

## Next agent: start here
- Finish the P1 commit, then read the complete Phase 2 section and listed callers in the master prompt. Before coding P2, add its plan to this file; implement the single server-side net-worth service and summary endpoint, move every listed consumer to it, stop browser snapshot POSTs, and add the cross-consumer seeded-client acceptance test. Do not start Phase 3.
