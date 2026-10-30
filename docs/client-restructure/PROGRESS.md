# Restructure progress

## Current phase
P1 — Enums, constraints, unique indexes — in progress

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
- Fresh P1 backups exported for all nine affected tables before the first schema change; files are ignored.
Audit counts / backfills:
- Preliminary read-only audit: profiles 15 (all 4 requested roles); client_profiles 4 (all active); financial_goals 24 (21 `on_track`, 3 `behind`, both require lifecycle mapping); advised_plans 4 (all `inforce`); leads 0.
- Preliminary duplicate-key audit: client_budget_months 0; net_worth_snapshots 4 groups (4 excess rows); health_scores 3 groups (27 excess rows when tier is derived from `details`); goal_progress_snapshots 0.
- The live database already has the budget-month and goal-progress unique indexes; it has no unique index yet for net worth snapshots or health scores.
- All 24 goals have a target date, so Phase 1's legacy free-score fallback for goals without a target is not used by current rows.
Tests: pending.
Decisions made by agent:
- Define `onboardingStage` and `firstFocus` shared enums in P1, but defer their CHECK constraints until P5 adds the columns; neither column exists today.
- Before deleting duplicate snapshot rows, keep the newest `created_at` row, with `id` as a deterministic tie-breaker, as required by the brief's “keep latest” rule.
- Because the standard schema push stopped at the existing `advised_plan_statements` truncation prompt, do not rerun it; if safe to proceed, apply only P1's audited additive column/constraints with an idempotent script and leave that unrelated drift untouched.

## Blocked / questions for the product owner
- P1 CHECK constraints for `onboarding_stage` and `first_focus` are deferred until P5 introduces their columns; their shared enums are defined in P1.
- `pnpm --filter @workspace/db run push` stopped at a pre-existing drift prompt: Drizzle proposed adding `advised_plan_statements_advised_plan_id_period_start_period_end_unique` on a table with 6 rows and asked whether to truncate it. The safe “No” option was selected; no schema changes occurred (verified: `health_scores.tier` is still absent). Do not rerun or accept a truncation prompt.

## Next agent: start here
- Finish the P1 audits and idempotent repairs, then add the P1 constraints and route validators; do not start P2 until P1 checks pass and its commit is recorded.
