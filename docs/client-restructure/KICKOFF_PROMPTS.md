# Kickoff prompts

Paste one of these into the agent. Both point at `MASTER_PROMPT.md`, which
must be in the repo (`docs/client-restructure/`) before you start.

---

## Tonight — Replit Agent (Phases 0, 1, 2)

```
You are working on the tala wealth-app in this Replit. Tonight's job is the first
part of the investment client restructure.

1. Read docs/client-restructure/MASTER_PROMPT.md completely, then read replit.md.
   That file is the brief. Its rules in section 3 override any default habit,
   especially: never drop tables or columns, never accept a drizzle-kit push that
   warns about data loss, back up tables before schema changes, and do not
   publish/deploy.

2. Do Phase 0, then Phase 1, then Phase 2, in that order. Before each phase,
   write your plan into docs/client-restructure/PROGRESS.md. After each phase,
   run `pnpm run typecheck` and `pnpm --filter @workspace/api-server test`, fix
   what you broke, record the results, and make a commit prefixed
   "[restructure P<n>]".

3. Stop after Phase 2. Do not start Phase 3.

4. If something blocks you (data-loss warning, a test you cannot fix, a
   contradiction with the master prompt), write it under "Blocked / questions
   for the product owner" in PROGRESS.md, skip only that step, and continue
   with the rest of the phase if it is safe.

5. Before you finish, fill "Next agent: start here" in PROGRESS.md with the
   exact next step, and list every file you changed per phase.

Phase 2 is the most important: one server-side net worth number
(GET /client/networth/summary) that the Net Worth page, dashboard ring, Sol,
wealth score, coast point and the advisor/admin lists all use. Port the formula
from artifacts/wealthapp/src/hooks/useNetWorthItems.ts exactly; do not invent a
new one. The acceptance test is that all these consumers return the same
netWorth for one seeded client.
```

---

## Tomorrow — Claude Code in the Replit shell

Start it from the repo root with `claude`, then paste:

```
Read docs/client-restructure/MASTER_PROMPT.md and docs/client-restructure/PROGRESS.md.

First, review what the Replit Agent did last night for Phases 0–2:
- Check every acceptance criterion in the master prompt for P0, P1 and P2
  against the code and the database, not against PROGRESS.md's claims.
- Run `pnpm run typecheck` and `pnpm --filter @workspace/api-server test`.
- Verify the net worth service matches the old browser formula in
  useNetWorthItems.ts (git show the version from before P2), and that no
  consumer still sums net worth on its own or reads portfolio_snapshots.
- Verify no table or column was dropped and the backups exist.
Report findings to me and fix anything incomplete or wrong before moving on.

Then continue with Phase 3 (goal funding and status) and Phase 4 (one advisor
pointer), following the rules in section 3. Show me your plan for each phase
before you edit, update PROGRESS.md as you go, commit per step with
"[restructure P<n>]", and stop after Phase 4 so I can review.
```

---

## Later sessions (one or two phases each)

```
Read docs/client-restructure/MASTER_PROMPT.md and PROGRESS.md. Verify the last
completed phase's acceptance criteria still hold, then do Phase <n> (and <n+1>)
following section 3. Plan first, update PROGRESS.md, commit per step, stop
after Phase <last>.
```

Suggested grouping: P5 alone (data backfills) · P6 (onboarding + checklist) ·
P7 + P8 (budget, advisor summary, navigation). Phases 9 and 10 only after the
new client experience has been used for a while.
