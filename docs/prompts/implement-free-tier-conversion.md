# Implement the free-tier conversion journey

Paste everything below this line into a new Claude Code session opened in the Replit shell of this repository.

---

You are working in the tala wealth-app monorepo (pnpm workspaces, TypeScript 5.9, Express 5 + Drizzle/PostgreSQL in `artifacts/api-server`, React + wouter + Clerk in `artifacts/wealthapp`, shared schema in `lib/db`). Read `replit.md`, `PRODUCT.md` and `SOL_PERSONA.md` first.

## Goal

Turn the free tier into a limited edition of the investment-client product with server-driven conversion checkpoints. The full design is in the repo on branch `audit/users-and-functions`:

- `docs/maps/free-tier-conversion-journey.html` (the design you are implementing)
- `docs/maps/free-user-function-map.html` and `docs/maps/investment-client-function-map.html` (current state)
- `docs/AUDIT_USERS_AND_FUNCTIONS.md` (security findings referenced below as F-n)

Run `git fetch origin audit/users-and-functions && git show origin/audit/users-and-functions:docs/maps/free-tier-conversion-journey.html > /tmp/design.html` and read it before coding. If the branch is already merged, the files are in `docs/`.

## The design in one paragraph

A free user is a Track B investment client without an advisor and with limits. Promotion to client changes `profiles.role` and `client_profiles.advisorId`, removes the limits, and moves no data. Every screen is the existing client screen; a tier policy decides per capability whether it is full, limited (a cap), preview (client feature rendered with the user's data plus an ask) or locked. Conversion checkpoints fire on the server when the user's own data crosses a threshold, are recorded, and create or re-touch one lead per user with the checkpoint code as source. The free user sees their conversion state on the dashboard advisor card, driven by `leads.status`.

## Principles you must follow (source of truth)

1. Tier is derived from `profiles.role` and `client_profiles.clientTrack`. Never add an `isFree` flag or a tier column to feature tables.
2. Limits live in exactly one file, `lib/tier-policy`, imported by the API guard and serialised to the UI through `GET /api/me/entitlements`. The browser never decides a gate.
3. Checkpoint state (shown, dismissed, accepted) is a database row, never localStorage.
4. One lead per user. For a linked lead, name, email and score are read through the `userId` join, not copied.
5. Computed values are computed on read, never written (no auto-growth writes, no browser totals persisted).
6. Keep the existing 136 API tests and 66 frontend tests green. Add tests for every new guard and every checkpoint trigger.
7. Zod-validate every new request body (`zod/v4` is already a dependency; `drizzle-zod` insert schemas exist in `lib/db/src/schema`).

## Phase 0, prerequisite fixes (small, do first, one commit)

- `artifacts/api-server/src/routes/profiles.ts`: `POST /profiles/me/upsert` grants `super_admin` when `req.body.email` equals `SUPER_ADMIN_EMAIL`. Take the email from Clerk instead (`clerkClient.users.getUser(userId)` from `@clerk/express`, primary email address), never from the body. Add a test that a body email matching the env var does not change the role. (F-1)
- `artifacts/api-server/src/routes/investments.ts`: `GET /client-profile/me` inserts a `client_profiles` row for any role. Remove the insert; return 404 when none exists. (part of F-5)
- `artifacts/wealthapp/src/pages/free/budget.tsx` calls `PUT /budget/transactions/:id`, which does not exist. Add the route in `routes/budget.ts`, scoped to the caller, Zod-validated. (F-19)

## Phase 1, tier policy and entitlements

Create `lib/tier-policy` (package `@workspace/tier-policy`, mirror the structure of `lib/goal-math`):

```ts
export type Tier = "free" | "track_b" | "track_a";
export type Gate = "full" | "limited" | "preview" | "locked" | "after_assign";
export const TIER_LIMITS = {
  free:    { goals: 1, holdings: 5, budgetMonths: 3, trendMonths: 3, scenarioTypes: ["increase_monthly"], solPerDay: 10,
             coastPoint: "preview", advisedPlans: "preview", messages: "after_assign", documents: "after_assign", plan: "locked" },
  track_b: { goals: Infinity, holdings: Infinity, budgetMonths: 12, trendMonths: 24, scenarioTypes: ALL_SCENARIO_TYPES, solPerDay: 100,
             coastPoint: "full", advisedPlans: "preview", messages: "full", documents: "full", plan: "full" },
  track_a: { ...track_b, advisedPlans: "full" },
} as const;
export function resolveTier(role: string, clientTrack: string | null, hasInforcePlan: boolean): Tier;
export function entitlementsFor(tier: Tier, usage: Usage, leadStatus: string | null, openCheckpoint: Checkpoint | null): Entitlements;
```

Server:

- `requireAllowance(capability)` middleware in `artifacts/api-server/src/middlewares/requireAuth.ts`. It loads the profile, resolves the tier, counts current usage (active goals, active holdings, Sol messages today) and returns `403 { code: "LIMIT", capability, limit, checkpoint }` when exceeded. Replace the hard-coded one-goal check in `routes/goals.ts` with it. Apply it to: `POST /goals`, `POST /client/holdings`, `POST /client/scenarios` (scenarioType must be allowed), `POST /sol/chat`, `GET /client/plan/coast-point` (preview = return the shape with `blurred: true` and the goal name only), `GET /client/plan` and `/client/plan/*` (locked for free), `/conversations*` and `/documents*` (after_assign for free: allowed only when the user's lead is `active` or later).
- `GET /api/me/entitlements` returning `{ tier, limits, usage, gates, leadStatus, advisor: { id, name } | null, openCheckpoint }`. One query path, cached per request.
- Add `requireRole("investment_client","super_admin")` nowhere new; the entitlement gates replace the missing role checks on the client routers (F-5), so free users may reach client routes only through `requireAllowance`.

Frontend:

- `useEntitlements()` hook (react-query, key `["entitlements"]`), invalidated after any mutation that changes usage or lead status.
- Remove the `role` arrays on `/client/*` routes in `App.tsx` so free users can open the client screens. `RoleRedirect` sends `free_user` to `/client/onboarding` when `onboardingTrackComplete` is false, else `/client/dashboard`. Keep `/free/*` routes working for one release, then delete in Phase 4.
- Gate components: `<Gated capability="...">` wrapper that renders children for `full`, children plus a cap notice for `limited` at the cap, a blurred/preview variant for `preview`, and `<LockedFeature>` for `locked`, all from entitlements. Disable the Add-goal and Add-holding buttons at the cap with the checkpoint message instead of letting the API 403 surface as a generic error.
- Onboarding for free: screens 1, 2, 4 (holdings capped at 5), 6, 7, 8; track fixed to B; screen 3 skipped.

Tests: tier resolution table; `requireAllowance` at and over each cap for free and client; entitlements endpoint shape for a free user with no lead, with an unassigned lead, with an active lead, and for a Track A client.

## Phase 2, direct ask and conversion state

- One interest action: extend `POST /leads/from-interest` to accept `{ source: CheckpointCode }` (Zod enum) and to be idempotent per user: re-touch the existing non-churned lead, update `source` and `updatedAt`, never create a second row.
- Replace every upgrade control with it: `components/FreeTierBanner.tsx` (mailto), `components/LockedGoalSlotCard.tsx` (`/book`), `pages/free/dashboard.tsx` and `components/shared/GoalCard.tsx` (`/book`), `components/SmartUpgradeCard.tsx` (`ctaHref` default `/book`), the handler-less "Book a free discovery call" button in `pages/free/goals.tsx`. Delete the `/book` and mailto destinations.
- Advisor card on the client dashboard (`components/client/dashboard/*`) reads `entitlements.leadStatus`:
  - none: "No advisor yet" + Talk to an advisor (C7)
  - unassigned: "We are matching you with an advisor" + the checkpoint they accepted
  - active: advisor name + Say hello (opens messages)
  - client: existing advisor card
  - cold/churned: back to C7
- When a lead becomes `active`, messages and documents open for that user and their assigned advisor (the `after_assign` gate). Add the advisor-side lead routes that are missing for leads: `GET /advisor/leads/:id/budget`, `/score`, `/engagement` (Phase 3), scoped with `requireAdvisorOwnsLead`.

Tests: idempotent lead creation; lead status → card state; after_assign gate opens and closes with lead status.

## Phase 3, checkpoint engine

Schema (`lib/db/src/schema/conversionCheckpoints.ts`): `conversion_checkpoints(id, userId, code, firedAt, snapshot jsonb, shownAt, dismissedAt, acceptedAt, leadId)`, unique `(userId, code, firedAt::date)`. Enum of codes: `C1_score_ready, C2_goal_slot, C3_off_track, C4_surplus, C5_investable, C6_engaged, C7_direct, C8_plan_preview, C9_under_management, C10_coast_point`.

`lib/checkpoints` (package `@workspace/checkpoints`): `evaluate(ctx): CheckpointCandidate[]` is a pure function over `{ tier, goals, holdings, budgetMonths, scores, engagement, existingCheckpoints, leadStatus }`. Triggers, implement in this order:

| Code | Trigger |
|---|---|
| C2 | free user hits the goal cap (raised by `requireAllowance`, not by evaluate) |
| C4 | `netSurplus >= 0.15 * totalIncome` in 2 of the last 3 `client_budget_months` |
| C5 | active holdings = 5 and a sixth is attempted (from `requireAllowance`), or Σ holding value ≥ 25 000 USD, or benchmark deviation ≤ −2 pp on any ticker holding |
| C3 | `computeGoalProgress` = `off_track` on 2 consecutive daily snapshots |
| C1 | `onboardingTrackComplete` and first `health_scores` row exists; soft, no lead |
| C6 | streak ≥ 4 weeks and score ≥ 70, or 90 days since sign-up and score < 50 |

Rules: at most one open checkpoint per user; priority C2 > C5 > C3 > C4 > C6 > C1 > C7; a code re-fires no sooner than 30 days after its last `dismissedAt`; while the user's lead is `unassigned` or `active`, nothing new fires. Run `evaluate` in a post-write hook after `POST /client/budget`, `POST/PUT /goals`, `POST /client/holdings`, and the score routes. Write the winning candidate as a row with the data snapshot.

Routes: `GET /api/me/checkpoint` (the open one, with copy keys and the snapshot), `POST /api/me/checkpoint/:id/dismiss`, `POST /api/me/checkpoint/:id/accept` (calls the interest action with the code as source and stores `leadId`). Advisor: `GET /advisor/leads/:id/checkpoints`.

Frontend: wire the existing components to the open checkpoint instead of their own conditions: `SmartUpgradeCard` (C1, C6), `LockedGoalSlotCard` (C2), `GoalScenarioCTA` (C3), `SurplusCTA` and `BudgetTrackBCTA` (C4), `BringUnderManagementCompare` (C5, C9), `TrackBConversionCTA` and `ConversionCTASection` (C8), coast-point preview (C10). For free users the action is accept-checkpoint; for Track B clients it opens messages as today.

Tests: one fixture per trigger proving fire/no-fire at the boundary; priority and cool-down rules; accept creates exactly one lead with the right source.

## Phase 4, engagement and advisor lead view

- `user_engagement(userId pk, streakWeeks, lastCheckinAt, milestones jsonb, lastTipWeek, updatedAt)`. Port `artifacts/wealthapp/src/lib/milestones.ts` logic to the server; the browser keeps a cache for instant render. Check-in happens on `GET /api/me/entitlements` once per day. C6 reads this table.
- Advisor lead detail (`pages/advisor/lead-detail.tsx`) renders the client screens in read-only mode (goals, net worth, holdings, budget, score, engagement, fired checkpoints) instead of its own summary.
- Delete the free pages (`pages/free/*`), the pathway wizard routes (`routes/pathway.ts`) and `budget_entries` only after a migration script in `scripts/src/` copies `budget_entries` into `client_budget_months` and pathway step formData into any still-empty owner row. Keep the script idempotent and log counts.

## Metrics

Add `scripts/src/funnel-report.ts` that prints, per cohort week: sign-ups, activation (first score within 7 days), checkpoints fired/shown/accepted per code, leads by source, promoted within 30 days.

## Working rules

- Work phase by phase. After each phase: `pnpm run typecheck`, `pnpm --filter @workspace/api-server test`, `pnpm --filter @workspace/wealthapp test`, then one commit with a message that names the phase. Do not start the next phase with a red build.
- Schema changes: edit `lib/db/src/schema`, export from `index.ts`, run `pnpm --filter @workspace/db run push`. Never edit generated files under `lib/api-client-react` or `lib/api-zod` by hand.
- Do not add new tables for data that already has an owner table. Do not store anything in localStorage except the engagement cache and unsent form drafts.
- Copy for every checkpoint and gate goes through `SOL_PERSONA.md` tone: calm, specific, never pressure. Sol may suggest "talk to an advisor" but never gives investment advice.
- If a design decision is ambiguous, prefer the stricter source-of-truth reading and leave a `// DECISION:` comment explaining it.
- At the end, write `docs/IMPLEMENTATION_NOTES.md` listing what shipped per phase, what was deferred, and every `// DECISION:` comment.
