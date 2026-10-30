# tala · Investment Client Restructure — Master Prompt

This file is the single brief for every agent working on the investment client
restructure (Replit Agent, Claude Code in the Replit shell, or anyone else).
Read it fully before touching code. Progress is recorded in
`docs/client-restructure/PROGRESS.md`; update that file at the end of every
work session.

Reference pages (read-only context, written by the product owner with Claude):
- Investment Client Function Map — https://claude.ai/artifact/BM4id334Jc9EsGgcSudAs1
- Investment Client Journey — https://claude.ai/artifact/DK52vjkPt1K19Q3rN6ux43

If a link is not reachable from your environment, everything you need is in
this file.

---

## 1. What we are doing and why

The investment client area (`role = investment_client`, routes under
`/client/*`) currently stores the same fact in several places. Net worth alone
can show five different numbers on the same day (browser sum on the Net Worth
page, `net_worth_snapshots` posted by the browser, the Sol tool, the wealth
score, and the admin/advisor `portfolioValue` built from legacy
`portfolio_snapshots`). Onboarding is 8 screens and ~30 inputs, and has its own
copies of the goal, holding and budget forms.

We are restructuring in phases:
1. **Data first**: one owner per fact, derived values computed on the server.
2. **Then the client experience**: 2-question onboarding, a setup checklist on
   Home, a quick budget, and a 5-item navigation.

### Source-of-truth principles (adopted, non-negotiable)

1. **One owner table per fact.** Each fact has exactly one table/column that may
   be written for it. Write the owner in a comment next to the column in
   `lib/db/src/schema/*.ts`. `profiles` owns identity and preferences;
   `client_profiles` owns the relationship (advisor, status, stage, risk).
2. **Derived values are computed, never stored as current.** Net worth,
   portfolio value, goal funding, savings rate, pacing status and wealth score
   are returned by one server-side function each. The browser never sums
   money across sources and never writes a total back.
3. **Snapshots are history, not source.** `net_worth_snapshots`,
   `goal_progress_snapshots`, `health_scores` hold one row per user per day
   (unique index), written from service output. No read uses them as the
   current value.
4. **One vocabulary per state.** Role, goal status, plan status, lead status,
   client status, onboarding stage: a CHECK constraint in Postgres plus a shared
   Zod enum in `lib/db`. A value outside the enum cannot be stored.
5. **Relationships point one way.** "Who is my advisor" is answered only by
   `client_profiles.advisor_id`. Ownership middleware resolves through it.
6. **Ledgers over edited totals.** Money movements are append-only ledger rows;
   balances and monthly contribution lists are queries over them.
7. **Reference data has one door.** Prices, benchmarks, strategy returns, fund
   catalogue: written only by server jobs or `super_admin` routes.
8. **One tier model.** Free and client tiers share the same tables; tier only
   changes limits and which screens are offered.
9. **Legacy is read-only, then gone.** `client_packages`, `portfolio_holdings`,
   scenarios v1, `kyc_documents`, `client_financial_snapshots`, `budget_entries`:
   no new code reads them; export, cut over, then drop (last phase only).

Also: **one form per fact.** A goal is entered only in the Goals sheet, a
holding only in the Wealth/Portfolio sheet, income and expenses only in the
Money/Budget page — whether the user arrives from onboarding, the checklist or
the sidebar.

### Product decisions (approved by the product owner)

| # | Decision | Approved answer |
|---|----------|-----------------|
| D1 | "First focus" question in onboarding | **Keep it.** One tap; orders the checklist and goal templates. |
| D2 | Date of birth at onboarding | **Required, month + year only** (store as first day of that month). |
| D3 | Advisor sees the client's budget | **Read-only summary** (income, spending, surplus, savings rate), **off by default**, client switches it on in Advisor. |
| D4 | Budget detail | **1 take-home figure + 6 main spending lines by default**, "Add detail" reveals the rest. Same table for free and client tiers. |
| D5 | Order of work | **Data restructure first**, then onboarding + checklist, then navigation. |

---

## 2. Codebase orientation

- pnpm monorepo, Node 24, TypeScript 5.9. Read `replit.md`.
- DB: PostgreSQL + Drizzle. Schema in `lib/db/src/schema/*.ts`, exported from
  `lib/db/src/schema/index.ts`. Schema changes are applied with
  `pnpm --filter @workspace/db run push` (dev DB). There are no migration files.
- API: Express 5 in `artifacts/api-server/src` (`routes/*.ts`, `lib/*.ts`,
  `middlewares/`). Key files: `routes/clientPortal.ts` (onboarding, holdings,
  budget, advised plans, dashboard), `routes/networth.ts`, `routes/goals.ts`,
  `routes/clients.ts`, `routes/profiles.ts`, `routes/clientHealthScore.ts`,
  `routes/coastPoint.ts`, `routes/sol.ts`, `routes/admin.ts`,
  `lib/blendedRate.ts`, `lib/goalAllocation.ts`, `lib/goalProgressSnapshot.ts`,
  `lib/holdingTransactions.ts`, `lib/advisedPlanBudgetSync.ts`.
- API contract: `lib/api-spec/openapi.yaml` → `pnpm --filter @workspace/api-spec run codegen`
  regenerates `lib/api-zod` and `lib/api-client-react`. Update the spec when you
  add or change an endpoint the frontend uses.
- Shared math: `lib/goal-math`.
- Frontend: `artifacts/wealthapp/src` (React + wouter + react-query).
  Client pages in `pages/client/`, components in `components/client/`,
  shell/nav in `components/client/AppShell.tsx`, onboarding in
  `pages/client/ClientOnboarding.tsx` + `components/client/onboarding/`.
  Net worth browser logic: `hooks/useNetWorthItems.ts`, `hooks/useNetWorthTrend.ts`.
  Goals browser logic: `hooks/useGoals*`.
- Tests: `artifacts/api-server/src/routes/__tests__/*.test.ts` — vitest +
  supertest against the real dev database, Clerk mocked with `vi.mock`. Copy the
  pattern from `goalHoldingLinks.test.ts`. Run with
  `pnpm --filter @workspace/api-server test`.
- Typecheck everything: `pnpm run typecheck`.

---

## 3. Rules of engagement (every phase, every agent)

1. **Work one phase at a time, in order.** Do not start the next phase until the
   current one meets its acceptance criteria and is logged in `PROGRESS.md`.
2. **Before each phase:** read the files named in that phase, then write a
   short plan (files to change, schema changes, tests to add) at the top of the
   phase's section in `PROGRESS.md`.
3. **Never lose data.**
   - Before any schema change, export affected tables:
     `pg_dump "$DATABASE_URL" --data-only -t <table> > backups/<date>-<table>.sql`
     (create `backups/`, add it to `.gitignore`).
   - Never drop a table or column in phases 1–8. Mark it deprecated in a schema
     comment and stop writing to it. Drops happen only in Phase 10.
   - If `drizzle-kit push` warns about data loss, truncation, or asks to
     rename/drop anything: **stop, answer no**, and write the question in
     `PROGRESS.md` under "Blocked".
   - New NOT NULL columns get a default or a backfill script first.
4. **Before adding a CHECK constraint or unique index**, run an audit query for
   violating rows, write the counts in `PROGRESS.md`, and fix them with a script
   in `scripts/src/` (idempotent, logs what it changed). Only then add the
   constraint.
5. **Keep the app working after every phase.** Old endpoints the frontend still
   calls keep responding until the frontend is moved off them in the same phase.
6. **Tests:** each phase adds supertest tests for its new endpoints/behaviour.
   `pnpm run typecheck` and `pnpm --filter @workspace/api-server test` must pass
   before a phase is marked done. Paste the final summary lines into `PROGRESS.md`.
7. **Commits:** one commit per logical step, message prefix `[restructure P<n>]`.
   Use Replit checkpoints too. Do **not** publish/deploy to production.
8. **Match the surrounding code**: naming, comment density, Zod v4 (`zod/v4`),
   existing middleware (`requireAuth`, `requireRole`, ownership helpers).
9. **Do not redesign visuals** beyond what a phase asks. Use existing design
   tokens and components in `components/shared` and `components/client`.
10. **Out of scope unless a phase says so:** advisor/admin UI redesign, free-tier
    redesign, Sol persona changes, pricing, auth provider.
11. **When unsure, choose the option that keeps one owner per fact**, note the
    choice in `PROGRESS.md` under "Decisions made by agent", and continue. Stop
    only for data-loss risk or a contradiction with this file.

---

## 4. Phases

Each phase: Goal · Tasks · Acceptance criteria. File lists are starting points;
search for every other caller before changing a contract
(`grep -rn "<endpoint or column>" artifacts lib`).

### Phase 0 — Baseline and guardrails

Goal: a safe starting point and an honest record of the current state.

Tasks
- Create `docs/client-restructure/PROGRESS.md` from the template in §6.
- Add `backups/` to `.gitignore`. Export all client-area tables listed in §5.
- Run `pnpm run typecheck` and the API tests; record results (failures that
  already exist are recorded, not fixed, unless trivial).
- Write `docs/client-restructure/OWNERS.md`: a table of every fact in §5 with
  its owner table/column, current extra copies, and the phase that removes them.

Acceptance: PROGRESS.md and OWNERS.md exist; baseline test/typecheck results
recorded; backups taken.

### Phase 1 — Enums, constraints, unique indexes

Goal: make invalid states impossible before moving any logic.

Tasks
- Add a shared enums module `lib/db/src/schema/enums.ts` exporting `as const`
  arrays + Zod enums for:
  - `role`: free_user, investment_client, advisor, super_admin (default is `free_user` in `profiles.ts`; confirm no other values exist)
  - `goalLifecycle`: active, completed, cancelled (map existing `paused` → `active`; record the mapping)
  - `advisedPlanStatus`, `leadStatus`, `clientStatus` (active | paused | churned) — take the real current values from the schema comments and routes
  - `onboardingStage`: not_started, profile, complete
  - `firstFocus`: know_my_money, start_investing, save_for_big, organise_existing, plan_retirement
- Audit and fix existing rows (script per table in `scripts/src/`), then add
  CHECK constraints for those columns.
- Unique indexes: `client_budget_months (user_id, month)`,
  `net_worth_snapshots (user_id, snapshot_date)`, `health_scores (user_id, score_date, tier)`
  (add `tier` text column, default `'client'` for rows with `details` not null,
  `'free'` otherwise), `goal_progress_snapshots` (goal + day; check the real column names). Deduplicate
  first, keeping the latest row per key.
- Route validators use the shared Zod enums instead of string literals.

Acceptance: audit counts and fixes recorded; constraints exist (show with
`\d+ <table>`); inserting an invalid status via API returns 400; tests added.

### Phase 2 — Net worth service (the most important phase)

Goal: one server-side net worth number used everywhere.

Tasks
- Create `artifacts/api-server/src/lib/netWorthService.ts` exporting
  `computeNetWorth(userId, { currency })` returning:
  `{ asOf, currency, totalAssets, totalLiabilities, netWorth,
     portfolio: { selfManaged, advised, total },
     items: [{ source: 'holding'|'advised_plan'|'asset'|'liability'|'mortgage', id, label, category, value, currency }] }`.
  Formula = the one the Net Worth page uses today in
  `hooks/useNetWorthItems.ts`: active `client_holdings` (live price × units via
  the price cache, else stored current value) + in-force/visible
  `advised_plans` (latest account value) + manual `assets`
  − manual `liabilities` − `client_holdings.outstanding_mortgage`.
  Port the browser logic exactly; do not invent a new formula. Holding values
  must come from one helper (`valueOfHolding`) that goal funding will reuse.
- New endpoint `GET /client/networth/summary` (and
  `GET /advisor/clients/:id/networth/summary` behind the existing advisor
  ownership middleware). Add to `openapi.yaml`, run codegen.
- Point every consumer at the service: Net Worth page, dashboard ring
  (`GET /client/dashboard/networth`), Sol net-worth tool (`routes/sol.ts`),
  client wealth score (`routes/clientHealthScore.ts`), coast point portfolio
  value, admin `/admin/clients` and advisor client list `portfolioValue`
  (stop reading `portfolio_snapshots` there).
- Snapshots: deprecate `POST /client/networth/snapshot` (keep the route,
  return 410 once the frontend no longer calls it). The service upserts today's
  `net_worth_snapshots` row from its own output (idempotent thanks to the
  Phase 1 unique index). Add `scripts/src/nightly-snapshots.ts` that computes
  and upserts for all investment clients; document how to schedule it on
  Replit in PROGRESS.md (do not deploy it).
- Frontend: the Net Worth page and dashboard read the summary endpoint. Remove
  browser summing and the debounced snapshot POST from `useNetWorthItems.ts`
  (the hook may still group `items` for display).

Acceptance: for a seeded test client with a holding, an advised plan, a manual
asset, a liability and a mortgage, every consumer returns the same `netWorth`
(test asserts summary = dashboard = Sol tool output = advisor list value);
browser no longer POSTs snapshots; typecheck + tests pass.

### Phase 3 — Goal funding and goal status

Goal: one computed goal amount and one lifecycle vocabulary.

Tasks
- `GET /goals` (and client goal routes) return computed
  `funding: { currentAmount, source: 'links'|'manual', breakdown[] }` and derived
  `pacing: 'no_target'|'on_track'|'at_risk'|'off_track'|'completed'`, using
  `lib/goalAllocation.ts` + `valueOfHolding` from Phase 2.
  Rule: links exist → sum of links; else `financial_goals.current_amount`.
- Remove the browser re-implementation of link sums (`useGoals*`).
- Block `POST /goals/auto-update` and `/goals/upsert-from-pathway` from
  overwriting `current_amount` on goals that have links or belong to an
  investment client.
- Fix the edit sheet silently resetting `monthlyContribution` (PUT only updates
  fields that are present in the body).
- Free-tier health score treats lifecycle `active` via derived pacing, not as
  "off track".
- Pacing is never stored; `status` column stores lifecycle only.

Acceptance: test goal with links returns link sum; manual goal returns manual
amount; editing a goal without `monthlyContribution` keeps it; tests pass.

### Phase 4 — One advisor pointer

Goal: reassigning an advisor is one update and takes effect everywhere.

Tasks
- New table `advisor_assignments (id, client_user_id, advisor_id, assigned_by, started_at, ended_at)`.
  Backfill one open row per client from `client_profiles.advisor_id`.
- Admin reassignment (`routes/admin.ts`) updates `client_profiles.advisor_id`
  and closes/opens assignment rows in one transaction.
- Ownership checks for plans, financial plans, milestones, conversations and
  documents resolve the advisor through `client_profiles.advisor_id`, not the
  row's own `advisor_id`. Keep the old columns (deprecated, stop reading them
  for authorization).
- `POST /client/plan/review-request` ignores any `advisorId` in the body and
  uses the client's current advisor.
- Milestone comments: enforce that the commenter is the client or their
  current advisor/super_admin, and record the real author role.
- Admin creating an advised plan must not lock the real advisor out of status
  changes.

Acceptance: test — reassign client from advisor A to B; B can edit plan and
reply to conversation, A gets 403; review request goes to B.

### Phase 5 — Profile fields and onboarding state

Goal: one field per preference, one onboarding stage, derived track.

Tasks
- Currency: `profiles.preferred_currency` is the owner. Backfill from
  `client_profiles.preferred_display_currency` where profiles is null/default
  and they differ (log), then stop reading/writing the latter.
- Risk: `client_profiles.risk_profile` is the owner; add
  `risk_profile_source` (`self` | `advisor`). Backfill from
  `profiles.risk_profile` as `self` where client_profiles is empty. Free tier
  and `PUT /profiles/me` write to client_profiles (create the row if missing).
- Onboarding: add `client_profiles.onboarding_stage` (enum from Phase 1),
  backfill (`onboarding_track_complete = true` → `complete`; basics saved →
  `profile`; else `not_started`). Routing reads only the stage. Old flags
  deprecated.
- Add `client_profiles.first_focus` (enum, nullable).
- Date of birth (D2): **no DOB column exists today** — the current onboarding
  asks for it but `PUT /client/profile/basics` drops it. Add
  `profiles.date_of_birth date` (owner: profiles), stored as the 1st of the
  chosen month. Required (month + year) in the new onboarding; nullable in the
  DB for existing users. Coast point / retirement logic reads it from here.
- Track (`client_track`) becomes derived: `advised` if the client has at least
  one advised plan visible to them, else `self_managed`. Return it from
  `GET /client/profile/track`; stop writing the column.
- Remove `status` from the client-writable allowlist of `PUT /client-profile/me`
  and any other client-writable route; restrict `PUT /client/holdings/:id` to
  an explicit field allowlist (never `userId`).

Acceptance: tests for each backfill rule and for the derived track; a client
cannot change their own status or a holding's owner.

### Phase 6 — New onboarding + setup checklist

Goal: the 2-question onboarding and Home checklist from the Journey page.

Tasks
- Onboarding (`pages/client/ClientOnboarding.tsx`), 3 screens:
  1. **Welcome** — greets by name, shows advisor name and anything already set
     up (advised plans, goals, budget months). No inputs.
  2. **About you** — full name (prefilled), date of birth (month + year,
     required), country of residence + "I'm an expat", currency.
     Writes `profiles` only. Sets stage `profile`.
  3. **What do you want to sort out first?** — one choice from `firstFocus`
     (labels: Know where my money goes · Start investing · Save for something
     big · Organise what I already have · Plan for retirement). Writes
     `client_profiles.first_focus`, sets stage `complete`, routes to Home.
  Delete screens 2–7 components and the free-tier pathway bridge code once the
  new flow works. No localStorage except an unsaved draft of screen 2.
- New endpoint `GET /client/setup-checklist` returning ordered items with
  `done` derived from data (never stored):
  1. `budget` — a `client_budget_months` row exists for the current month → opens Money
  2. `goal` — ≥1 active goal → opens Goals (templates: safety net, home, education, retirement, travel)
  3. `wealth` — ≥1 holding/asset/liability, or the user chose "I'm starting from zero" → opens Wealth
  4. `goal_link` — some goal has ≥1 link → opens Goals › link
  5. `risk` — `risk_profile` set → opens the risk check
  6. `advisor_hello` — a message from the client exists → opens Advisor
  Order by `first_focus` (e.g. `organise_existing` puts `wealth` first;
  `know_my_money` puts `budget` first; `save_for_big` uses the order above).
  Also return `wealthScoreUnlock: { monthsWithBudget, required: 3 }`.
- View preferences (`starting_from_zero`, `checklist_hidden`) may be stored
  flags on `client_profiles` — they are preferences, not financial facts.
- Home shows the checklist card at the top until all items are done or hidden,
  with the "Wealth score unlocks after 3 months of budget: n of 3" bar.
- Risk check: a short self-assessed quiz (5 questions) writing
  `risk_profile` with source `self`. Reuse any existing quiz component if present.

Acceptance: a new client reaches Home after 2 input screens; checklist items
flip to done only when the data exists; order changes with first focus; tests
for the checklist endpoint.

### Phase 7 — Quick budget + advisor budget summary

Goal: D3 and D4.

Tasks
- Money/Budget page default view: 1 take-home income figure + 6 main spending
  lines (housing, food, transport, utilities, entertainment, other), "Add
  detail" reveals the full 4 income / 10 expense lines. New month starts as a
  copy of last month. Same `client_budget_months` table.
- Free tier: move `/free/budget` reads/writes to `client_budget_months`
  (free fields are a subset). Backfill `budget_entries` into it (script,
  idempotent). Deprecate `budget_entries` (no drop).
- Consent: `client_profiles.share_budget_with_advisor boolean default false`,
  toggle on the Advisor page ("Share my monthly budget summary with my advisor").
- `GET /advisor/clients/:id/budget-summary` → last 12 months of
  income, spending, surplus, savings rate only (no line items); 403 when
  consent is off. Show it as a read-only card on the advisor client detail page.

Acceptance: tests — advisor gets 403 without consent, data with consent, never
line items; free-tier user's budget appears unchanged after backfill.

### Phase 8 — Navigation 9 → 5 and Sol everywhere

Goal: the 5-place navigation from the Journey page.

Tasks
- `components/client/AppShell.tsx`: sidebar and mobile bottom bar become
  **Home · Money · Wealth · Goals · Advisor** (no "More" menu).
  - Money = Budget page.
  - Wealth = tabs Overview (net worth + trend) · Investments (holdings +
    advised plans, today's Portfolio) · Property & debts (manual assets/liabilities).
  - Goals = tabs Goals · My plan (today's Pathway / milestones) · What-if (Scenarios).
  - Advisor = Messages · Documents & KYC · budget-sharing toggle · review request.
- Keep old URLs working with redirects (`/client/portfolio` → Wealth ›
  Investments, `/client/networth` → Wealth, `/client/plan` → Goals › My plan,
  `/client/scenarios` → Goals › What-if, `/client/messages` and
  `/client/documents` → Advisor tabs, `/client/budget` → Money).
- Floating Sol button on every client page, opening the existing Sol chat.

Acceptance: every old URL lands on the right tab; mobile shows 5 tabs; no page
lost.

### Later phases (do not start without a new instruction)

- **Phase 9 — Ledgers, scores, scenarios, prices, KYC:** plan-contribution
  ledger replacing `investment_contributions` JSON; one scoring service with
  tier column, GET becomes pure read; advisor "push scenario" route; server-fed
  prices table (provider, fetched_at), request-time fetches never write; KYC
  status derived from `documents`.
- **Phase 10 — Retire legacy:** export, cut over and drop the legacy tables and
  deprecated columns listed in OWNERS.md.

---

## 5. Fact → owner table (target)

| Fact | Owner | Extra copies to retire |
|------|-------|------------------------|
| Net worth, portfolio value | `netWorthService` over holdings + advised_plans + assets + liabilities + prices | browser sums, browser-posted snapshots, `portfolio_snapshots`, `client_financial_snapshots` |
| Goal current amount | goal links if any, else `financial_goals.current_amount` | browser link sums, auto-update/pathway overwrites |
| Goal status | `financial_goals.status` lifecycle; pacing derived | stored pacing values, `paused` |
| Preferred currency | `profiles.preferred_currency` | `client_profiles.preferred_display_currency` |
| Risk profile | `client_profiles.risk_profile` + `risk_profile_source` | `profiles.risk_profile` |
| Onboarding state | `client_profiles.onboarding_stage` | 5 boolean flags, `onboarding_step`, localStorage |
| Client track | derived from visible advised plans | `client_profiles.client_track` |
| Advisor | `client_profiles.advisor_id` + `advisor_assignments` | advisorId on plans, financial plans, conversations, request bodies |
| Budget | `client_budget_months` | `budget_entries` |
| Investment contributions | holding ledger + plan-contribution ledger (Phase 9) | `investment_contributions` JSON |
| Wealth score | one scoring service; `health_scores` history | write-on-GET, mixed formulas |
| KYC | `documents` (category kyc) | `kyc_documents`, free-text `kyc_status` |
| Scenarios | `scenario_runs` + `created_by_role` | `scenarios` v1 |
| Prices | prices table fed by a job | request-time writes to `price_cache` |
| Client status | `client_profiles.status` (advisor/admin only) | client-writable status |

---

## 6. PROGRESS.md template

```markdown
# Restructure progress

## Current phase
P<n> — <name> — <status: planning | in progress | done | blocked>

## Baseline (Phase 0)
- typecheck: <result>
- api tests: <passed>/<total>, pre-existing failures: <list>

## Phase log
### P<n> — <name>
Plan:
- ...
Done:
- <commit hash> <summary>
Audit counts / backfills:
- ...
Tests: <summary line>
Decisions made by agent:
- ...

## Blocked / questions for the product owner
- ...

## Next agent: start here
- <exact next step>
```
