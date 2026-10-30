# Restructure progress

## Current phase
P0 — Baseline and guardrails — done

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
- Added `backups/` to `.gitignore`.
- Exported all 32 client-area/Phase 1 tables to `backups/2026-10-30-<table>.sql`; each export completed and was non-empty.
- Wrote `docs/client-restructure/OWNERS.md` for every §5 fact.
- Captured full typecheck and API test baselines.
Audit counts / backfills:
- Not applicable in Phase 0.
Tests: typecheck passed; API suite 16 files and 136 tests passed.
Decisions made by agent:
- Backups are local, ignored files and will not be committed because they contain client financial and identity data.

## Blocked / questions for the product owner
- None identified.

## Next agent: start here
- Read the Phase 1 schema, validators, routes, and database state; write the Phase 1 plan here before changing enums, audits, or constraints.
