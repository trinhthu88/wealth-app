# tala wealth-app — User & Function Audit

Repository: https://github.com/trinhthu88/wealth-app (commit `249d6ff`, audited 2026-10-25)
Stack: pnpm monorepo · Express 5 + Drizzle/PostgreSQL API (`artifacts/api-server`) · React + wouter + Clerk frontend (`artifacts/wealthapp`) · Anthropic-backed assistant "Sol".

## 1. Summary

| Item | Result |
|---|---|
| API handlers inventoried | **187** (23 route files), every one listed in Appendix A with caller, input and output |
| Frontend pages mapped | 7 free · 13 client · 6 advisor · 8 admin (Appendix B) |
| Typecheck (`pnpm run typecheck`) | pass |
| Frontend tests | 66 / 66 pass |
| API integration tests (run against a local Postgres 16) | 136 / 136 pass |
| Findings | 10 High · 19 Medium · ~25 Low. **12 of the High/Medium findings were reproduced with live requests** (marked ✅ below) |

**Verdict.** Identity (Clerk) and the role model are sound in design, and the advisor ↔ client ownership middleware is well built and tested. The problems are concentrated in three places: (1) a super_admin bootstrap that trusts a client-supplied email, (2) a handful of routes that take a `:planId`, `:milestoneId`, `userId` or `advisorId` without checking it against the caller, and (3) the entire "investment client" API surface being gated by `requireAuth` only, so the free tier exists only in the UI. None of the 187 handlers validate request bodies with a schema. The app is not safe to expose to untrusted sign-ups until items 1–5 in §4 are fixed.

## 2. User types

Role lives in `profiles.role` (free text, no DB enum). Clerk owns identity; the API reads the role from the DB on every guarded request, never from the client. The Clerk sign-up page is open, so anyone can create an account.

| Role | How it is obtained | Lifecycle |
|---|---|---|
| **free_user** (default) | Automatic on first login: the frontend calls `POST /profiles/me/upsert` with the Clerk user's email, which creates the profile | Can become a lead (`POST /leads/from-interest`) and be promoted to investment_client by an advisor |
| **investment_client** | (a) super_admin creates it via `POST /admin/users`, (b) an advisor converts a lead (`POST /leads/:id/convert`, Clerk account created with an advisor-chosen password), or (c) a lead linked to an existing account is set to status `client` (`PUT /leads/:id` → `promoteLeadToClient`), which flips the existing profile's role | Has a `client_profiles` row with `advisorId`, track A (advised plan) or B (self-managed), onboarding flags, KYC status |
| **advisor** | Only via `POST /admin/users` or `PUT /admin/users/:id` by a super_admin (or seed scripts) | Sees only clients where `client_profiles.advisor_id` = self and leads where `assigned_advisor_id` = self |
| **super_admin** | Set when the email posted to `/profiles/me/upsert` equals the `SUPER_ADMIN_EMAIL` env var, or via `PUT /admin/users/:id` | Bypasses every advisor-ownership check |

Demo accounts created by `scripts/src/seed-users.ts` and `seed-demo-data.ts` (emails only): `contact@erickson.vn` (free), `trang.tt@erickson.vn` (client), `trang.tt@hsp.consulting` (advisor), `sofia.chen@`, `marcus.reyes@` (free), `elena.novak@`, `james.whitfield@demo.wealthapp.io` (clients). All share one hard-coded password defined in each seed script (line 17 and line 25 respectively) and sent to Clerk with `skip_password_checks: true`. No super_admin is seeded.

## 3. Functions per user type — input → output

Each row is a user-facing function, the input the user supplies, the endpoint, and what comes back. Full field-level detail, status codes and side effects are in Appendix A; the page-by-page view is in Appendix B.

### 3.1 Everyone (unauthenticated)

| Function | Input | Endpoint | Output |
|---|---|---|---|
| Read published blog | – | GET /blog | published posts |
| Read a post by slug | slug | GET /blog/:slug | the post **(drafts included — see F-9)** |
| Submit a lead (quiz / landing CTA) | email, firstName, source, quizResult, healthScore, status, notes | POST /leads **(no auth — F-6)** | lead row |
| Health check | – | GET /healthz | `{status:"ok"}` |
| Sign up / sign in | Clerk hosted forms | Clerk | session → `/dashboard` role redirect |

### 3.2 free_user

| Function | Input | Endpoint(s) | Output |
|---|---|---|---|
| Create / sync profile | email, fullName (sent automatically) | POST /profiles/me/upsert | profile (role) |
| Edit profile / preferences | fullName, preferredCurrency, countryCode, isExpat, riskProfile, avatarUrl, totalSavings, totalInvestments, savings/investment rate % | PUT /profiles/me | profile |
| Pathway wizard (6 steps) | life stage, income, 6 expense lines, one goal, savings/investments/debts, 5 risk answers | PUT /pathway/:n, POST /budget, POST /goals/upsert-from-pathway, POST /assets/upsert-by-name, POST /liabilities/upsert-by-name, POST /health-score | step progress, budget row, single goal, two assets + one liability, health score |
| Monthly budget | income + 6 expense estimates | POST /budget, PUT /budget/:id | entry with needs/wants/savings and savings-rate % |
| Budget transactions | description, amount, type, category, date, recurring | POST/DELETE /budget/transactions, carry-forward | transaction rows (**edit is broken — F-19**) |
| Goals (max 1, enforced server-side) | title, type, target, current, monthly contribution, target date | POST/PUT/DELETE /goals, POST /goals/auto-update | goal rows; 403 on second goal |
| Net worth | assets (name, category, value), liabilities (name, category, balance, rate) | POST/PUT/DELETE /assets, /liabilities | asset/liability rows |
| Health score | – (computed from the above) | POST /health-score, GET /health-score(/history) | overall ≤100 + 4 sub-scores + insights |
| Express interest in an advisor | source | POST /leads/from-interest | lead linked to the account |
| Sol chat (mobile only) | free-text message | POST /sol/chat, GET /sol/conversation | assistant reply (tool access to the caller's goals, budget, net worth, health) |
| Notifications | – | GET /notifications, POST /notifications/read-all | own notifications |
| **Also reachable by direct API call (not in the UI)** | everything in §3.3 marked "auth only" | all `/client/*`, `/packages`, `/scenarios`, `/portfolio`, `/tasks`, `/conversations`, `/documents`, `/kyc/documents`, `/plans` | the full client tier — see F-5 |

### 3.3 investment_client

| Function | Input | Endpoint(s) | Output |
|---|---|---|---|
| Client onboarding (8 screens) | basics, income, track A/B, holdings, goal, expenses | PUT /client/profile/basics, POST /client/budget, POST /client/holdings, POST /goals, POST /client/onboarding/complete | client_profiles row, holdings, goal, budget month; `onboardingTrackComplete=true` |
| Dashboard | – | GET /client/dashboard/{goals,networth,advisor,scenario-alert}, /client/health-score, /client/budget/:month | net worth ring, top-3 goals, advisor card, wealth score (gated for 3 months), scenario alerts |
| Self-managed holdings | type-specific forms (ticker/units/cost, coin, property, cash, pension, other) | POST/PUT/DELETE /client/holdings, /symbols/search, /prices/stock/:ticker, benchmark-preview | holding rows with live price and benchmark deviation |
| Holding ledger | date, in/out, amount, units, note | POST/DELETE /client/holdings/:id/transactions | ledger rows; balance updated |
| Advised plans (read-only, track A) | – | GET /client/advised-plans, …/statements, …/transactions, …/holdings | plans, statements, fund holdings entered by the advisor |
| Client budget | 4 income lines, 10 expense lines, investment contributions per holding | POST /client/budget, POST /client/budget/sync-contributions | month row with totals, savings rate, surplus sweep into a cash holding |
| Goals (unlimited) | type, title, target, currency, date, priority, notes; links to holdings/plans with allocation % | POST/PUT /goals, PATCH /goals/:id/status, POST/DELETE /client/goals/:id/links, GET …/progress-movement, POST …/ensure-off-track-task | goal rows, pacing status, Sol progress card, auto-created advisor task when off track |
| Scenarios (6 types) | parameters per type, years, assumed return | POST/DELETE /client/scenarios, PATCH …/status | projection runs; advisor-pushed scenarios appear as alerts |
| Financial plan | – ; review request {urgency, message}; milestone comment {text} | GET /client/plan, /client/plan/coast-point, POST /client/plan/review-request, POST /client/plan/milestones/:id/comments | plan, milestones, coast point, a conversation message to the advisor |
| Net worth | assets, liabilities (synced holdings read-only) | POST/PUT/DELETE /assets, /liabilities, POST /client/networth/snapshot | rows + daily snapshot (client-computed totals) |
| Documents / KYC | request {requestType, details}; (API: title, category, fileUrl) | GET /documents, POST /documents, POST /kyc/documents | document rows (URL strings only; the server stores no files) |
| Messages | content | GET/POST /conversations…, POST /conversations/:id/messages | conversation with the assigned advisor |
| Packages / transactions (legacy) | – | GET /packages, GET /transactions/all | packages, allocations, snapshots, transactions |
| Also: every free-tier function in §3.2 | | | writes into the **same** goals/assets tables — see F-10 |

### 3.4 advisor

| Function | Input | Endpoint(s) | Output |
|---|---|---|---|
| Client book | – | GET /advisor/clients | assigned clients with KYC, risk, portfolio value, plan count |
| Client detail | status, riskProfile, kycStatus, notes (+13 more fields via API) | GET/PUT /advisor/clients/:id/client-profile, GET …/profile, …/goals, …/tasks, …/documents, …/portfolio, …/packages, …/transactions | client profile, goals, tasks, documents, holdings |
| Advised plan lifecycle | provider, product, policy no., premiums, dates, status, visibility | POST /advisor/clients/:id/advised-plans, PUT /advised-plans/:id/status, PUT …/contribution | plan row; "inforce" syncs contributions into the client's budget |
| Statement entry | period, opening/closing value, contributions, 6 fee lines, funds[], transactions[] | POST /advisor/clients/:clientId/advised-plans/:planId/statements | statement + holdings + transactions; plan latest values updated |
| Legacy packages | nickname, type, amounts, allocations[], transactions, snapshots | POST/PUT /packages…, /allocations, /transactions, /snapshots | package rows |
| Model portfolio for a client | holdings[] | PUT /advisor/clients/:id/portfolio | replaces all advisor-managed holdings |
| Financial plan + milestones | title, status, planData, nextReviewDate; milestone title/date/notes | POST /advisor/clients/:id/plan, PUT /plans/:id, POST /plans/:id/milestones | plan + milestones |
| Leads | email, firstName, source, status, notes; convert {password, riskProfile} | GET /leads, GET/PUT /leads/:id, POST /leads, POST /leads/:id/convert; lead reads: /advisor/leads/:id/{goals,networth,holdings,documents} | lead rows; on convert a Clerk user + investment_client profile |
| Tasks | title, description, priority, status, dueDate, clientId | GET/POST/PUT/DELETE /tasks | own task rows (plus auto "goal off track" tasks) |
| Messaging | content, senderRole, attachmentUrl | GET/POST /conversations, POST /conversations/:id/messages | conversations where advisorId = self |
| Documents for client/lead | title, category, fileUrl | POST /advisor/clients/:id/documents, /advisor/leads/:id/documents | document rows flagged admin-uploaded |
| Fund prices (global) | fundId, priceDate, priceNative, priceUsd; refresh | POST /fund-prices, POST /prices/refresh | global price rows used in every client's valuation (F-14) |
| Blog | title, slug, excerpt, category, markdown, status, cover | POST /blog, PUT /blog/:id/admin (any post) | posts |
| Also: every free-tier function in §3.2 on their own rows | | | |

### 3.5 super_admin

| Function | Input | Endpoint(s) | Output |
|---|---|---|---|
| User management | email, password, fullName, role (any string), advisorId, riskProfile, status | GET/POST /admin/users, GET/PUT/DELETE /admin/users/:id, GET /admin/advisors, GET /admin/stats | profiles; Clerk user created/deleted |
| Client oversight | advisorId reassignment | GET /admin/clients, PUT /admin/users/:id | client summaries with advisor, portfolio value |
| Lead assignment | advisorId | PUT /leads/:id/assign, GET /leads (all) | lead → active |
| Funds catalogue | name, assetClass, ticker, isin, currency, geography, manager, type, expense ratio, benchmark, factsheet, price-API symbol | POST /funds, PUT /funds/:id (raw body), GET /funds/all | fund rows |
| Benchmarks & strategy returns | assetClass (6), label, 10-yr CAGR; planType (3), label, target return | CRUD /admin/asset-class-benchmarks, /admin/advised-strategy-returns | reference rates used by coast point, health score, Sol |
| Prices | refresh; manual override | POST /prices/refresh, POST /fund-prices | fund_prices |
| Everything an advisor can do, on any client/lead/plan/package | | all /advisor/* routes (ownership checks bypassed) | |
| Everything a client can do, on their own (empty) account | | all /client/* pages are role-allowed | effectively dead pages |

## 4. Findings (ranked)

✅ = reproduced in this audit with live HTTP requests against the test harness and a local Postgres. Line numbers refer to files under `artifacts/api-server/src/`.

### High

| # | Finding | Where | Scenario |
|---|---|---|---|
| F-1 ✅ | **Any signed-up user can become super_admin.** The upsert route compares `req.body.email` with `SUPER_ADMIN_EMAIL` and sets the role on match; the email is never checked against the Clerk session. | routes/profiles.ts:16-22,32 | PoC: new account → `POST /profiles/me/upsert {email:"<admin email>"}` → role=super_admin → `GET /admin/stats` returns 200. |
| F-2 ✅ | **Advisor writes statements into any other advisor's plan.** `:planId` is never checked against `:clientId` or the caller; the same gap lets any advisor read any plan's statement history. | routes/clientPortal.ts:170-176, 215-290 | PoC: advisor A posted a statement to advisor B's client plan (201) and overwrote `latestAccountValue` to 999999; the cross-read returned the row. |
| F-3 ✅ | **Mass assignment on holdings lets a user move a holding into another user's account.** Every body key is written as a column (`userId`, `id`, `isActive`, …). | routes/clientPortal.ts:447-458 | PoC: `PUT /client/holdings/:id {userId:"<victim>"}` → holding now belongs to the victim. |
| F-4 ✅ | **Milestone comments have no ownership check.** Any signed-in user can read and write comments on any client's plan milestone by UUID. | routes/clientPortal.ts:1154-1193 | PoC: free_user wrote a comment (201) and read the thread (200) on another client's milestone. |
| F-5 ✅ | **The entire investment-client tier is `requireAuth` only.** 41 `/client/*` routes plus packages, scenarios, portfolio, plans, tasks, conversations and documents have no role check; `GET /client-profile/me` even creates an *active* `client_profiles` row for any role. The free/paid boundary exists only in React route arrays. | routes/clientPortal.ts, investments.ts:137-147, tasks.ts:13, messages.ts | PoC: free_user called `GET /client-profile/me` → row created with status `active`; free_user created a conversation with an arbitrary advisor via review-request (201). |
| F-6 ✅ | **`POST /leads` is public and unvalidated.** No auth, no rate limit, no email format check; accepts `status` (e.g. `client`), `notes`, `healthScore`. Also reachable from any HTML form (CORS reflects any origin with credentials). | routes/leads.ts:71-80, app.ts:36 | PoC: anonymous POST with `status:"client"` stored verbatim (201). |
| F-7 ✅ | **Cross-advisor lead read/write via `PUT /leads/:id`.** The ownership guard used on GET is missing on PUT, so any advisor can read the full lead (email, notes) and change its status, including triggering the irreversible promotion to client. | routes/leads.ts:97 | PoC: advisor A `GET` → 404 (correct) but `PUT` → 200 with advisor B's private notes and status changed to churned. |
| F-8 ✅ | **Forged package transactions / snapshots under another user's id.** `userId` comes from the body and is not compared with the package owner. | routes/investments.ts:359-372, 384-396 | PoC: advisor A inserted a transaction tagged with advisor B's client; that client's `GET /transactions/all` now shows a $12,345 transaction they never made. |
| F-9 ✅ | **Draft blog posts are public by slug.** `GET /blog/:slug` has no status filter. | routes/blog.ts:13-18 | PoC: unauthenticated GET of a draft slug returned its markdown. |
| F-10 | **`POST /goals/upsert-from-pathway` deletes every goal but one, for any role.** The free pathway is reachable by investment clients, so finishing step 4 wipes their advisor-linked goals (cascading links and snapshots). | routes/goals.ts:96-110, App.tsx:222 | Verified in code; not executed. |

### Medium

| # | Finding | Where |
|---|---|---|
| F-11 | `POST /leads/:id/convert` has no ownership check, assigns the lead to the caller if unassigned, and creates the client's Clerk account with an advisor-chosen password (`skip_password_checks`) with no forced reset or invite flow. | leads.ts:143-164, lib/createUserWithProfile.ts:34-47 |
| F-12 | `promoteLeadToClient` demotes advisor/super_admin profiles to investment_client if their own interest-lead is set to `client` (combine with F-7). | lib/promoteLead.ts:38-40 |
| F-13 | Unbounded LLM spend: `POST /sol/chat` has no rate limit, no message length cap, replays the full conversation every turn, and runs up to 5 Sonnet + 1 Haiku calls per request for any role. The guardrail classifier receives the reply as a plain user message and is itself injectable; user- and advisor-entered text (goal titles, plan nicknames) is passed to the model unsanitised. | sol.ts:254-265, 278-391 |
| F-14 | Any advisor can overwrite global fund prices (`POST /fund-prices`) and hammer the paid Twelve Data refresh; `priceUsd` is set equal to `priceNative` regardless of currency; a 500 leaks the env var name. | investments.ts:76-88, 527-579 |
| F-15 | Messaging between unrelated users: `GET /conversations` creates a conversation as a side effect, `POST /conversations` only checks the caller is one party, `senderRole` and `attachmentUrl` are caller-supplied (impersonate "advisor", phishing links). | messages.ts:12-28, 40-45, 70 |
| F-16 | `POST /tasks` is open to every role with an unchecked `clientId`, so strangers can inject tasks into an advisor's client view. | tasks.ts:13-22 |
| F-17 | Goal progress and links: `/client/goals/:id/progress-movement` reads a foreign goal by id and pre-empts the victim's daily snapshot; `/client/goals/:id/links` does not verify the goal or source belongs to the caller. | goals.ts:152-194, lib/goalProgressSnapshot.ts:62-121 |
| F-18 | Non-transactional multi-step financial writes (budget save ≈10 writes, statement entry 4 writes, allocation replace, advisor portfolio replace, ledger delete + balance reversal). A failure mid-way leaves balances inconsistent with ledgers. | clientPortal.ts:215-290, 510-535, 618-735; investments.ts:301-323; portfolio.ts:51-66 |
| F-19 | Free budget page calls `PUT /budget/transactions/:id`, which does not exist — editing a transaction always fails. | pages/free/budget.tsx:198, routes/budget.ts |
| F-20 | Destructive partial updates: `PUT /goals/:id` zeroes `currentAmount`/`monthlyContribution` when omitted (the client edit sheet never sends monthlyContribution); `PUT /client/profile/basics` nulls name/country; `PUT /tasks/:id` and `PUT /blog/:id/admin` null omitted fields. | goals.ts:56-60, clientPortal.ts:32-40, tasks.ts:29-31, blog.ts:35-38 |
| F-21 | No schema validation on any of the 187 handlers. Non-numeric strings, wrong types or malformed UUIDs surface as unhandled Postgres errors (500 with stack in non-production). `drizzle-zod` insert schemas already exist and are unused; the OpenAPI spec covers 42 of 133 paths and the generated client is unused. | all route files; lib/api-spec |
| F-22 | URLs stored verbatim with no scheme/host check (`fileUrl` for KYC and documents, `attachmentUrl`, `avatarUrl`, `coverImageUrl`, notification `link`). The server never receives files; KYC documents are just third-party URLs. | documents.ts, kyc.ts, messages.ts, profiles.ts, blog.ts |
| F-23 | Shared `price_cache` is writable by any user through `/prices/stock/:ticker` and `/prices/batch` (which also accepts unbounded arrays and unencoded crypto ids), and may store `price_usd = "0"`, feeding every user's valuation. | clientPortal.ts:881-983 |
| F-24 | Plan write access keys on `financial_plans.advisorId` at creation, so a reassigned former advisor keeps write access; super_admin-created advised plans get the admin's id as advisorId, locking out the real advisor. | plans.ts:27-71, clientPortal.ts:135-136 |
| F-25 | Clients can edit/delete advisor-managed portfolio rows; clients can forge `isAdvisorPushed` scenarios. | portfolio.ts:26-44, investments.ts:433-442 |
| F-26 | `DELETE /admin/users/:id` deletes only the profile (orphaning client_profiles, documents, conversations, tasks), 500s if a lead references the user, swallows Clerk errors, and allows self-delete. | admin.ts:68-82 |
| F-27 | `GET /client/health-score` and `POST /health-score` insert rows on read / on every call with no per-day uniqueness; `POST /budget` has no per-month uniqueness (pathway creates duplicates). | clientHealthScore.ts:51-55, healthscore.ts:196-212, budget.ts:29-43 |
| F-28 | CORS `origin: true` with `credentials: true` reflects any origin (verified: `evil.example` echoed back). Bearer tokens limit the impact, but `express.urlencoded` plus this setting makes the public lead route form-postable from anywhere. | app.ts:36-38 |
| F-29 | Advisor UI has no net-worth or budget view for promoted clients (only lead routes exist); `/admin/blog` lists only published posts so drafts disappear. | networth.ts:188-191, pages/admin/blog.tsx:26 |

### Low (abridged)

Free-tier limit is cosmetic except the 1-goal cap (the "Add goal" button stays enabled and the 403 shows as a generic error) · `/free/*` pages open to every role and label investment clients "Free plan" · free goals auto-update overwrites a client's funded amount · unordered `existing[0]` / `goals[0]` picks a nondeterministic "top goal" · `PATCH /goals/:id/status` vocabulary (active/paused) differs from the rest of the app (on_track/off_track) · dead `/book` links and a "Book a call" button with no handler · `pages/client/packages.tsx`, `transactions.tsx` unreferenced · `GET /client-profile` returns advisor internal notes to the client · `GET /client/advised-plans` returns `advisorNotes` and `introducerCode` · `PUT /funds/:id` passes the raw body to `.set()` · Sol chat UI exists only in the free mobile nav · `ProtectedRoute` renders before the profile loads · errors swallowed as `[]`/204 in several goal routes · seed scripts hard-code and print passwords.

## 5. Recommended fix order

1. **F-1**: derive the email from the Clerk session (`clerkClient.users.getUser(userId)` or session claims), never from the body; better, drop the env-based bootstrap and set super_admin by a one-off script.
2. **F-2, F-3, F-4, F-7, F-8, F-17**: add the missing ownership checks (`planId` ↔ `clientId`, milestone → plan → client, body `userId` ↔ package owner, `requireAdvisorOwnsLeadById` on PUT/convert) and replace the raw-body `.set()` with an explicit allowlist.
3. **F-5**: add `requireRole("investment_client","super_admin")` (or a `requireClientTrack` guard) to the `/client/*`, packages, scenarios, portfolio and plan routers; put a role check on `POST /tasks`; stop auto-creating `client_profiles` on GET.
4. **F-6, F-28**: require auth or a CAPTCHA + rate limit on `POST /leads`, strip `status`/`notes` from the public path, and set an explicit CORS allowlist.
5. **F-21**: introduce Zod validation (the `drizzle-zod` insert schemas in `lib/db` are a ready starting point) and an error handler that maps bad input to 400.
6. **F-13, F-14, F-23**: per-user rate limits and a token budget on Sol, restrict fund-price writes to super_admin, and make price_cache writes server-initiated only.
7. **F-18, F-20, F-27**: wrap multi-step writes in `db.transaction`, make PUTs true partial updates, add unique constraints `(user_id, month)` and `(user_id, score_date)`.
8. Then: F-10/F-19 UX bugs, URL validation (F-22), orphan cleanup on user delete (F-26).

## 6. Method

Read every route file, middleware, schema and page; four parallel reviewers each covered a route group and reported in a fixed format, then every High finding was re-verified by hand. Installed dependencies, ran the typecheck and both test suites, started a local Postgres 16, pushed the Drizzle schema, and ran 16 proof-of-concept requests through the existing supertest harness (which mocks Clerk and uses a test-user header). All probe files were removed; the checkout is unchanged (`git status` clean).
## Appendix A — Full route inventory (187 handlers, all under `/api`)

Legend: **auth only** = `requireAuth` → any signed-in role (free_user, investment_client, advisor, super_admin). **adv/SA** = `requireRole("advisor","super_admin")`. **SA** = `requireRole("super_admin")`. Ownership guards are named as in `artifacts/api-server/src/middlewares/requireAuth.ts`. No route file except `health.ts` uses Zod; all bodies are read raw from `req.body`.

### A.1 Profiles, admin, leads, clients, KYC, documents, messages, tasks, notifications, blog, health (56)

| Method | Path | Who can call | Input | Output | Side effects |
|---|---|---|---|---|---|
| POST | /profiles/me/upsert | auth only, own row | body `email` (required, **not checked against Clerk's verified email**), `fullName?` | 200 Profile; 400; 401 | insert profiles (role = super_admin if body email matches `SUPER_ADMIN_EMAIL` else free_user) or update email/fullName and **set role=super_admin** on match |
| GET | /profiles/me | auth only, own row | none | 200 Profile; 404 | none |
| PUT | /profiles/me | auth only, own row | `fullName, preferredCurrency, countryCode, isExpat, onboardingComplete, riskProfile, avatarUrl, totalSavings, totalInvestments, savingsRatePercent, investmentRatePercent` — untyped; `role`/`email` not accepted | 200 Profile; 404; 500 on bad numeric | update profiles |
| GET | /admin/users | SA | none | 200 Profile[] (all users, all fields) | none |
| GET | /admin/users/:id | SA | path id | 200 Profile; 404 | none |
| POST | /admin/users | SA | `email`, `password` (required), `fullName?`, `role` (any string, default free_user), `advisorId?`, `riskProfile?`, `status?` | 201 Profile; 400; 500 | Clerk `POST /v1/users` (`skip_password_checks`), insert profiles, insert client_profiles if investment_client |
| PUT | /admin/users/:id | SA | `fullName?`, `role?` (any string), `preferredCurrency?`, `advisorId?` (not verified as advisor) | 200 Profile; 404 | update profiles; upsert client_profiles.advisorId |
| DELETE | /admin/users/:id | SA (can delete self) | path id | 204 always | Clerk delete (errors swallowed); delete profiles only — client_profiles/docs/conversations/tasks orphaned; 500 if a lead references the user |
| GET | /admin/clients | SA | none | 200 client summary rows (email, status, kyc, advisorName, portfolioValue, plansCount) | none |
| GET | /admin/advisors | SA | none | 200 `{id,email,fullName}[]` for advisor+super_admin | none |
| GET | /admin/stats | SA | none | 200 `{totalUsers, byRole}` | none |
| GET/POST/PUT/DELETE | /admin/asset-class-benchmarks[/:id] | SA | POST: `assetClass` (enum of 6), `label`, `tenYearCagrPct`, `source?`; PUT: `label?`, `tenYearCagrPct?`, `source?` | 200/201 row; 400; 404; 204 | insert/update/delete asset_class_benchmarks |
| GET/POST/PUT/DELETE | /admin/advised-strategy-returns[/:id] | SA | POST: `planType` (rsp/lump_sum/combination), `label`, `targetAnnualReturnPct`; PUT: `label?`, `targetAnnualReturnPct?` | 200/201 row; 400; 404; 204 | insert/update/delete advised_strategy_returns |
| GET | /leads | adv/SA; advisor sees assigned only | none | 200 Lead[] (email, notes, healthScore, quizResult) | none |
| GET | /leads/:id | adv/SA + requireAdvisorOwnsLeadById | path id | 200 Lead; 404 | none |
| POST | /leads/from-interest | auth only (every role) | `source` (required, any) | 200 updated lead or 201 new Lead; 400; 404 | insert/update leads linked to caller's userId |
| POST | /leads | **public, no auth** | `email` (required, no format check), `firstName?`, `source?`, `quizResult?`, `healthScore?`, `status?` (any, incl. "client"), `notes?` | 201 Lead; 400 | insert leads |
| PUT | /leads/:id | adv/SA, **no ownership check** | `status?`, `notes?` | 200 Lead (full row); 404; 409 | status→"client" runs promoteLeadToClient (profiles.role→investment_client, upsert client_profiles, set convertedUserId) |
| PUT | /leads/:id/assign | SA | `advisorId` (required, not validated as advisor) | 200 Lead; 400; 404 | update leads.assignedAdvisorId, status→active |
| POST | /leads/:id/convert | adv/SA, **no ownership check** | `password` (required), `riskProfile?` | 201 `{lead, profile}`; 404; 409; 400 | Clerk create user with advisor-chosen password; insert profiles (investment_client); insert client_profiles (advisorId = lead.assignedAdvisorId **or caller**); update lead |
| GET | /client-profile | auth only, own row | none | 200 ClientProfile incl. `internalNotes`, `advisorInternalNotes` | none |
| GET | /advisor/clients/:id/profile | adv/SA + requireAdvisorOwnsClient | path id | 200 Profile; 404 | none |
| GET | /advisor/clients/:id/client-profile | adv/SA + owns client | path id | 200 ClientProfile | none |
| PUT | /advisor/clients/:id/client-profile | adv/SA + owns client | allowlist of 16 fields (riskProfile, riskScore, investmentStyle, indicativeAmount, preCallNotes, preferredContactTime, onboardingStep, prospect/fullOnboardingComplete, relationshipStartDate, annualReviewDate, internalNotes, advisorInternalNotes, clientTrack, preferredDisplayCurrency, onboardingTrackComplete), untyped | 200 ClientProfile | update or insert client_profiles |
| GET | /advisor/clients | adv/SA; advisor sees assigned | none | 200 client summary rows | none |
| GET | /kyc/documents | auth only, own rows | none | 200 KycDocument[] | none |
| POST | /kyc/documents | auth only | `documentType`, `fileUrl` (required, **no URL validation**), `fileName?` | 201 KycDocument (pending); 400 | insert kyc_documents (URL string only; server stores no file) |
| GET | /documents | auth only, own rows | none | 200 Document[] | none |
| POST | /documents | auth only | `title`, `category`, `fileUrl` (required, unvalidated), `fileName?`, `fileSizeBytes?` | 201 Document; 400 | insert documents |
| GET/POST | /advisor/leads/:id/documents | adv/SA + requireAdvisorOwnsLead | POST: `title`, `category`, `fileUrl`, `fileName?`, `fileSizeBytes?` | 200 Document[] / 201 Document | insert documents (isAdminUploaded) |
| GET/POST | /advisor/clients/:id/documents | adv/SA + owns client | same as above | 200 / 201 | insert documents |
| GET | /conversations | auth only; caller must be clientId or advisorId or SA | query `clientId?`, `advisorId?` (unvalidated) | 200 Conversation[]; 403 | **GET creates a conversation** if the pair has none |
| POST | /conversations | auth only; caller must be one party; other party unchecked | `clientId`, `advisorId` | 201 Conversation; 403 | insert conversations (duplicates allowed) |
| GET | /conversations/:id/messages | participant or SA | path id | 200 Message[]; 403; 404 | none (readAt never set) |
| POST | /conversations/:id/messages | participant or SA | `content` (required), `senderRole?` (**caller-supplied**), `attachmentUrl?` (unvalidated) | 201 Message; 400 | insert messages |
| GET | /tasks | auth only; rows where advisorId = caller | none | 200 AdvisorTask[] | none |
| POST | /tasks | auth only (**any role**) | `title` (required), `clientId?` (unchecked), `description?`, `dueDate?`, `priority?`, `status?` | 201 AdvisorTask; 400 | insert advisor_tasks (advisorId = caller) |
| PUT | /tasks/:id | owner only | `clientId`, `title?`, `description`, `dueDate`, `priority?`, `status?` — omitted clientId/description/dueDate reset to null | 200; 404 | update advisor_tasks |
| DELETE | /tasks/:id | owner only | path id | 204 always | delete advisor_tasks |
| GET | /advisor/clients/:id/tasks | adv/SA + owns client | path id | 200 AdvisorTask[] (any creator) | none |
| GET | /notifications | auth only, own | none | 200 Notification[] (no pagination) | none |
| POST | /notifications | auth only, self | `type`, `title` (required), `message?`, `link?` | 201; 400 | insert notifications |
| POST | /notifications/read-all | auth only | none | 204 | update read=true |
| GET | /blog | public | none | 200 published BlogPost[] | none |
| GET | /blog/:slug | public | path slug | 200 BlogPost **regardless of status**; 404 | none |
| POST | /blog | adv/SA | `title`, `slug` (required), `excerpt?`, `contentMarkdown?`, `category?`, `status?`, `coverImageUrl?` | 201; 400; 500 on dup slug | insert blog_posts |
| PUT | /blog/:id/admin | adv/SA, **any advisor edits any post** | same fields; omitted excerpt/content/category/cover reset to null | 200; 404 | update blog_posts |
| GET | /healthz | public | none | 200 `{status:"ok"}` | none |

### A.2 Client portal, coast point, client health score (48)

| Method | Path | Who can call | Input | Output | Side effects |
|---|---|---|---|---|---|
| GET | /client/profile/track | auth only | none | 200 `{clientTrack, onboardingTrackComplete, preferredDisplayCurrency, advisorId}` | none |
| PUT | /client/profile/basics | auth only | `fullName?`, `countryCode?`, `isExpat?`, `preferredDisplayCurrency?` (omitted name/country → null, isExpat → false) | 200 client_profiles row | update profiles; **upsert client_profiles for any role** |
| POST | /client/onboarding/complete | auth only | `preferredDisplayCurrency?` | 200 row | profiles.onboardingComplete=true; client_profiles.onboardingTrackComplete=true |
| GET | /client/advised-plans | auth only, own + isVisibleToClient | none | 200 plans with latestStatement/latestHoldings (incl. `advisorNotes`, `introducerCode`) | none |
| POST | /advisor/clients/:id/advised-plans | adv/SA + requireAdvisorOwnsClientOrLead | `providerName`, `productName` (required); `productCode, policyNumber, introducerCode, planType, currency, termYears, annualPremium, initialPremium, effectiveDate, maturityDate, status (any), latestAccountValue, latestNetContribution, latestStatementDate, nickname, advisorNotes, isVisibleToClient` | 201 plan; 400 | insert advised_plans (advisorId = caller); client_profiles.clientTrack = track_a |
| GET | /advisor/clients/:id/advised-plans | adv/SA + owns client-or-lead | path id | 200 plan[] | none |
| GET | /advisor/clients/:clientId/advised-plans/:planId/statements | adv/SA + owns :clientId; **:planId not checked** | path | 200 statement[] | none |
| GET | /client/advised-plans/:planId/statements | auth only, plan.userId = caller | path | 200 statement[]; 403 | none |
| GET | /client/advised-plans/:planId/transactions | auth only, own plan | path | 200 last 50 tx | none |
| GET | /client/advised-plans/:planId/statements/:stmtId/holdings | auth only, holdings scoped to caller | path | 200 holding[] | none |
| POST | /advisor/clients/:clientId/advised-plans/:planId/statements | adv/SA + owns :clientId; **:planId not checked** | required `periodStart, periodEnd, openingValue, closingValue`; optional `statementDate, entryMode, contributions, extraAllocations, policyFee, assetManagementFee, adminCharges, advisoryServicesFee, bidOfferSpread, surrenders, surrenderCharges, investmentReturns, funds[], transactions[], newLatestAccountValue, newLatestNetContribution` | 201 statement; 400; 500 on dup period | insert statements, holdings, transactions; update advised_plans.latest* (non-transactional) |
| PUT | /advised-plans/:id/status | adv/SA + requireAdvisorOwnsPlan | `status` (required, any string), `policyNumber?` | 200 plan; 400; 404 | update plan; if "inforce" → sync contributions into client_budget_months |
| PUT | /advised-plans/:id/contribution | adv/SA + owns plan | `annualPremium?`, `initialPremium?` | 200 plan; 400; 404 | update plan; budget sync |
| GET | /client/holdings | auth only, own active | none | 200 holding[] | none |
| GET | /advisor/leads/:id/holdings | adv/SA + requireAdvisorOwnsLead | path | 200 holding[] | none |
| POST | /client/holdings | auth only | `holdingType`, `label` (required); ~27 optional type-specific fields (ticker, unitsHeld, averageCostPrice, coinSymbol, propertyAddress, purchasePrice, currentEstimatedValue, outstandingMortgage, monthlyRentalIncome, bankName, currentBalance, interestRatePct, schemeName, currentBalancePension, monthlyContribution, employerContribution, currentValueOther, totalInvestedOther, expectedAnnualReturnPct, currency, purchaseDate, notes …) | 201 holding; 400 | insert client_holdings |
| PUT | /client/holdings/:id | auth only, WHERE id AND userId | **every body key written as a column** (incl. `userId`, `id`, `isActive`, `holdingType`) | 200; 404 | update client_holdings (mass assignment) |
| DELETE | /client/holdings/:id | auth only, own | path | 204 always | soft delete (isActive=false) |
| GET | /client/holdings/:id/transactions | auth only, own holding | path | 200 tx[]; 404 | none |
| POST | /client/holdings/:id/transactions | auth only, own holding | `type` ∈ in/out/fee/value_update, `amount` > 0, `description?`, `transactionDate?`, `units?` | 201; 400; 404 (any error) | insert ledger row; update holding balance |
| DELETE | /client/holdings/:id/transactions/:txId | auth only, own, manual only | path | 204; 404 | delete ledger row; reverse balance |
| GET | /advisor/leads/:id/holdings/:holdingId/transactions | adv/SA + owns lead | path | 200 tx[]; 404 | none |
| POST | /client/holdings/benchmark-preview | auth only | `holdingType` (required), `ticker?`, `coinSymbol?`, `interestRatePct?`, `expectedAnnualReturnPct?` | 200 `{value, source, isOverride, benchmarkValue, benchmarkLabel, deviation}` | outbound Yahoo/CoinGecko fetch |
| GET | /client/holdings/:id/benchmark | auth only, own | path | 200 same shape; 404 | outbound fetch |
| GET | /client/advised-strategy-returns | auth only | none | 200 rows | none |
| GET | /client/budget | auth only, own | query `limit` (parseInt, unclamped) | 200 month rows | none |
| GET | /client/budget/:month | auth only, own | path month | 200 row; 404 | none |
| POST | /client/budget | auth only | `month` (required); `currency?`; 14 income/expense numerics; `investmentContributions?` (arbitrary JSON array); `notes?` | 200 row; 400 | upsert client_budget_months; upsert/delete budget_contribution ledger rows; surplus sweep; may create "Surplus (auto)" cash holding; update cash balances (~10 writes, no transaction) |
| POST | /client/budget/sync-contributions | auth only | none | 200 `{synced, contributions[]}` | upsert current month |
| GET | /client/scenarios | auth only, own | query `saved`, `advisor` | 200 scenario_runs[] | none |
| POST | /client/scenarios | auth only | `scenarioType` (required); `scenarioName?, sourceType?, sourceId?, linkedGoalId? (not ownership-checked), parameters?, projectionData?, baselineFinalValue?, scenarioFinalValue?, deltaValue?, deltaPct?, isSaved?` | 201; 400 | insert scenario_runs |
| DELETE | /client/scenarios/:id | auth only, own | path | 204 always | delete |
| GET | /symbols/search | auth only | query `q`, `type` | 200 `[{symbol,name,type}]` | outbound CoinGecko/Yahoo |
| GET | /prices/stock/:ticker | auth only | path ticker | 200 `{symbol, price_usd, change_1d_pct, fetched_at, is_stale}`; 404 | upsert shared price_cache; outbound Yahoo |
| POST | /prices/batch | auth only | `stocks?: string[]`, `cryptos?: string[]` (unbounded, unvalidated) | 200 map | N outbound fetches; upsert price_cache (may write `price_usd="0"`) |
| GET | /client/dashboard/scenario-alert | auth only | none | 200 row or null | none |
| GET | /client/dashboard/scenario-alert-count | auth only | none | 200 `{count}` | none |
| PATCH | /client/scenarios/:id/status | auth only, own | `status` ∈ new/viewed/dismissed | 200; 400; 404 | update |
| GET | /client/dashboard/networth | auth only | none | 200 `{totalAssets, totalLiabilities, netWorth, source}` | none |
| GET | /client/dashboard/advisor | auth only | none | 200 `{id, fullName}` or null | none |
| GET | /client/dashboard/goals | auth only | none | 200 first 3 goals | none |
| GET | /client/plan | auth only, own plan | none | 200 `{plan, milestones[], advisorId, advisorName, nextReviewDate}` | none |
| GET | /client/plan/milestones/:id/comments | auth only, **no ownership check** | path | 200 comment[] (userId, authorName) | none |
| POST | /client/plan/milestones/:id/comments | auth only, **no ownership check** | `content` (required) | 201; 400; 503 | insert milestone_comments (authorRole "client") |
| POST | /client/plan/review-request | auth only; **advisorId from body** | `advisorId`, `message` (required) | 201 `{conversationId, message}`; 400 | insert conversations + messages |
| GET | /client/plan/coast-point | auth only | query `extraMonthly` | 200 `{available, goalId, goalTitle, monthlyContribution, blendedAnnualReturnPct, portfolioValue, base, accelerated, extraMonthly}` | outbound CAGR fetches per ticker |
| GET | /client/health-score | auth only | none | 200 `{gated:true, monthsActive}` / null / score row + `gated:false` | **GET writes** health_scores row for today (no unique constraint) |
| GET | /client/health-score/history | auth only | none | 200 last 12 rows | none |

### A.3 Investments, Sol, portfolio, financial plans (43)

| Method | Path | Who can call | Input | Output | Side effects |
|---|---|---|---|---|---|
| GET | /funds | auth only | none | 200 active Fund[] (incl. priceApiSymbol/exchange) | none |
| GET | /funds/all | adv/SA | none | 200 Fund[] incl. inactive | none |
| POST | /funds | SA | `name`, `assetClass` (required); `ticker, isin, geography, currency, fundManager, fundType, expenseRatio, benchmarkIndex, factsheetUrl, priceApiSymbol, priceApiExchange` | 201; 400 | insert funds |
| PUT | /funds/:id | SA | **raw body → `.set()`** (any column) | 200; 404; 500 on empty body | update funds |
| GET | /fund-prices | auth only | query `fundIds` (csv) | 200 latest FundPrice[]; 400 | none |
| GET | /fund-prices/:fundId/history | auth only | path | 200 ≤180 rows | none |
| POST | /fund-prices | adv/SA (**any advisor**) | `fundId, priceDate, priceNative, priceUsd` (required), `change1d?, change1dPercent?, source?` | 200 upserted; 400 | upsert fund_prices (global valuation input) |
| GET | /fund-prices/latest | auth only | none | 200 all funds + latestPrice (incl. inactive) | none |
| POST | /prices/refresh | adv/SA | `fundIds?: string[]` | 200 `{refreshed, total}`; 500 if key missing (leaks env var name); 502 | Twelve Data API call; upsert fund_prices (priceUsd := priceNative) |
| GET | /client-financial-snapshot | auth only, own | none | 200 snapshot; 404 | none |
| POST | /client-financial-snapshot | auth only | `monthlyIncome, savingsRange, hasInvestments, investmentsRoughValue, hasDebts, debtsRoughValue` (untyped) | 200 upserted | upsert client_financial_snapshots |
| GET | /client-profile/me | auth only (**any role**) | none | 200 ClientProfile (incl. internal notes) | **inserts client_profiles (status active) if missing** |
| PUT | /client-profile/me | auth only | `riskProfile, riskScore, investmentStyle, indicativeAmount, onboardingStep, prospectOnboardingComplete, status` (unrestricted) | 200 | upsert client_profiles |
| GET | /packages | auth only, own | none | 200 packages + latestSnapshot + allocations | none |
| GET | /packages/:id | auth only, own | path | 200 package + allocations + transactions + snapshots; 404 | none |
| POST | /packages | auth only (**no requireRole**); advisor must own body.userId | `userId` (advisor), `goalId?`, `nickname`, `type` (required), `monthlyAmount?, lumpSumAmount?, startDate?, endDate?, currency?, expectedAnnualReturn?, advisorNotes?, allocations[]?` | 201; 400; 403 | insert client_packages, package_allocations, initial portfolio_snapshot (non-transactional) |
| PUT | /packages/:id | adv/SA + requireAdvisorOwnsPackage | `goalId, nickname, status, type, monthlyAmount, lumpSumAmount, startDate, endDate, currency, expectedAnnualReturn, advisorNotes` | 200; 404 | update |
| PUT | /packages/:id/allocations | adv/SA + owns package | `allocations[]` `{fundId, weightPercent, unitsHeld?, notes?}` | 200 active allocations; 400; 404 | deactivate all then insert (non-transactional) |
| GET | /packages/:id/transactions | requirePackageReadAccess | path | 200 tx[]; 404 | none |
| POST | /packages/:id/transactions | adv/SA + owns package | `userId` (required, **not checked vs package owner**), `transactionDate, transactionType, amountUsd` (required), `fundId?, units?, pricePerUnitUsd?, notes?` | 201; 400; 404 | insert package_transactions |
| GET | /packages/:id/snapshots | requirePackageReadAccess | path | 200 snapshot[]; 404 | none |
| POST | /packages/:id/snapshots | adv/SA + owns package | `userId` (unchecked), `snapshotDate`, `totalInvestedUsd`, `totalValueUsd`, `totalReturnPercent?`, `fundBreakdown?` | 200 upserted; 404; 500 | upsert portfolio_snapshots |
| GET | /transactions/all | auth only; rows where tx.userId = caller | none | 200 tx[] with fund + package | none |
| GET | /scenarios | auth only, own (≤20) | none | 200 Scenario[] | none |
| POST | /scenarios | auth only | `scenarioType, inputData, outputData` (required), `linkedGoalId?, linkedPackageId? (unchecked), isAdvisorPushed? (client-settable), advisorNote?` | 201; 400 | insert scenarios |
| PUT | /scenarios/:id | auth only, own | `status` (any) | 200; 404; 500 if missing | update |
| GET | /advisor/clients/:clientId/packages | adv/SA + owns client | path | 200 packages + snapshots + allocations | none |
| GET | /advisor/clients/:clientId/transactions | adv/SA + owns client | path | 200 tx[] | none |
| POST | /sol/chat | auth only (every role) | `message` (required, no max length), `conversationId?` | 200 `{conversationId, message:{id, role, content, sentAt}}`; 400; 502; 503 | insert sol_conversations/sol_messages; up to 5 Sonnet calls + 1 Haiku guardrail call per request; tool calls read goals/budget/holdings/plans/health; outbound Yahoo/CoinGecko per ticker |
| GET | /sol/conversation | auth only, own latest | none | 200 `{conversationId, messages[]}` | none |
| GET | /portfolio | auth only, own | none | 200 PortfolioHolding[] | none |
| POST | /portfolio | auth only | `assetName, assetClass, currentValueUsd` (required; 0 rejected), `currencyOriginal?, weightPercent?, tickerSymbol?, notes?` | 201; 400 | insert portfolio_holdings |
| PUT | /portfolio/:id | auth only, own (**incl. advisor-managed rows**) | same fields | 200; 404 | update |
| DELETE | /portfolio/:id | auth only, own (incl. advisor-managed) | path | 204 always | delete |
| GET | /advisor/clients/:id/portfolio | adv/SA + owns client | path | 200 holdings[] | none |
| PUT | /advisor/clients/:id/portfolio | adv/SA + owns client | `holdings[]` `{assetName, assetClass, currentValueUsd, currencyOriginal, weightPercent, tickerSymbol}` | 200 full list; 400 | delete all advisor-managed then insert (non-transactional) |
| GET | /plans | auth only; clientId = caller OR advisorId = caller | none | 200 FinancialPlan[] | none |
| GET | /plans/:id | client, advisor-of-plan, or SA | path | 200; 403; 404 | none |
| PUT | /plans/:id | advisor-of-plan or SA | `title?, status?, planData, nextReviewDate` (omitted → null) | 200; 403; 404 | update financial_plans |
| GET | /plans/:id/milestones | client/advisor-of-plan/SA | path | 200 PlanMilestone[] | none |
| POST | /plans/:id/milestones | advisor-of-plan or SA | `title` (required), `targetDate?, status?, notes?` | 201; 400 | insert plan_milestones |
| GET | /advisor/clients/:id/plan | adv/SA + owns client | path | 200 first plan; 404 | none |
| POST | /advisor/clients/:id/plan | adv/SA + owns client | `title` (required), `status?, planData?, nextReviewDate?` | 201; 400 | insert financial_plans (duplicates allowed) |

### A.4 Goals, net worth, budget (free tier), health score (free tier), pathway (40)

| Method | Path | Who can call | Input | Output | Side effects |
|---|---|---|---|---|---|
| GET | /goals | auth only, own | none | 200 FinancialGoal[] | none |
| POST | /goals | auth only; **free_user capped at 1 goal (server-side, the only tier limit in the API)** | `title`, `goalType` (required); `targetAmount?, currentAmount?, monthlyContribution?, targetDate?, currency?, priority?, status?, notes?` | 201; 400; 403 cap | insert financial_goals |
| PUT | /goals/:id | auth only, own | same fields; **omitted targetAmount/targetDate → null, currentAmount/monthlyContribution → 0** | 200; 404 | update |
| DELETE | /goals/:id | auth only, own | path | 204 always | delete (cascades links, snapshots) |
| POST | /goals/auto-update | auth only, own | `goalId`, `newCurrentAmount` (client-computed, trusted) | 200; 400; 404 | update current_amount |
| POST | /goals/upsert-from-pathway | auth only (**any role**) | `title`, `goalType` (required); `targetAmount?, targetDate?, currency?` | 200 updated / 201 created | **deletes every goal except the first returned row**, then updates it |
| GET | /advisor/clients/:id/goals | adv/SA + owns client | path | 200 goals[] | none |
| GET | /advisor/leads/:id/goals | adv/SA + owns lead | path | 200 goals[] | none |
| GET | /client/goals/:id/links | auth only, own links | path | 200 GoalHoldingLink[] (errors → `[]`) | none |
| POST | /client/goals/:id/links | auth only; **goal ownership not checked** | `sourceType` (advised_plan/self_holding, not enforced), `sourceId` (unchecked), `allocationPct?` | 201; 400; 409 over-allocation / duplicate | insert goal_holding_links |
| GET | /client/goals/:id/progress-movement | auth only; **goal read by id only when caller has no links** | path | 200 `{hasPrior, fromDate, toDate, deltaTotal, marketDelta, contributionDelta, reallocationDelta}` | **inserts today's goal_progress_snapshot** |
| POST | /client/goals/:id/ensure-off-track-task | auth only, own | path | 200 `{created, status}` | may insert/close advisor_tasks (goal_off_track) |
| DELETE | /client/goals/links/:linkId | auth only, own | path | 204 always | delete link |
| PATCH | /goals/:id/status | auth only, own | `status` ∈ active/completed/paused/cancelled | 200; 400; 404 | update |
| GET | /assets | auth only, own | none | 200 Asset[] | none |
| POST | /assets | auth only | `name`, `category`, `valueUsd` (required, truthy — 0 rejected), `currencyOriginal?, valueOriginal?, notes?` | 201; 400 | insert assets |
| PUT | /assets/:id | auth only, own, uuid-checked | same fields | 200; 400; 404 | update |
| DELETE | /assets/:id | auth only, own | path | 204; 400 | delete |
| POST | /assets/upsert-by-name | auth only | `name`, `category`, `valueUsd`, `currencyOriginal?` | 201; 400 | **deletes all caller assets with same name**, then insert |
| GET | /liabilities | auth only, own | none | 200 Liability[] | none |
| POST | /liabilities | auth only | `name`, `category`, `balanceUsd` (required), `interestRatePercent?, monthlyPaymentUsd?, currencyOriginal?, balanceOriginal?` | 201; 400 | insert |
| PUT | /liabilities/:id | auth only, own | same | 200; 400; 404 | update |
| POST | /liabilities/upsert-by-name | auth only | `name`, `category`, `balanceUsd` | 201; 400 | delete-by-name then insert |
| DELETE | /liabilities/:id | auth only, own | path | 204; 400 | delete |
| GET | /client/networth/snapshots | auth only, own | none | 200 last 24 snapshots | none |
| POST | /client/networth/snapshot | auth only | `totalAssetsUsd`, `totalLiabilitiesUsd`, `netWorthUsd` (client-computed, trusted), `notes?` | 200/201; 400 | upsert by (user, today) |
| GET | /advisor/leads/:id/networth | adv/SA + owns lead | path | 200 `{assets, liabilities}` | none |
| GET | /budget | auth only, own | none | 200 BudgetEntry[] | none |
| POST | /budget | auth only | `periodMonth` (required), `currency?`, `income?, housing?, food?, transport?, utilities?, entertainment?, other?, notes?` | 201 entry + computed needs/wants/savings/rate; 400 | insert (**no uniqueness per month → duplicates**) |
| PUT | /budget/:id | auth only, own | same; derived fields recomputed from body only | 200; 404 | update |
| GET | /budget/transactions | auth only, own | query `month?` | 200 BudgetTransaction[] | none |
| POST | /budget/transactions | auth only | `periodMonth`, `description`, `amount`, `transactionDate` (required), `type?`, `category?`, `isRecurring?` | 201; 400 | insert |
| DELETE | /budget/transactions/:id | auth only, own | path | 204 always | delete |
| POST | /budget/transactions/carry-forward | auth only | `targetMonth` (required) | 200 `{copied, transactions}`; 400 | insert copies of recurring rows (not idempotent) |
| GET | /budget/transactions/carry-forward-pending | auth only | query `month` (required) | 200 `{pending, count, prevMonth, recurringItems}`; 400 | none |
| GET | /health-score | auth only, own | none | 200 latest row; 404 | none |
| GET | /health-score/history | auth only, own | none | 200 last 12 | none |
| POST | /health-score | auth only | none (reads budget, goals, pathway, assets, liabilities, profile) | 200 row `{overallScore, savingsScore, budgetScore, goalsScore, netWorthScore, insights{…}}` | **inserts a row on every call** |
| GET | /pathway | auth only, own | none | 200 PathwayProgress[] | none |
| PUT | /pathway/:stepNumber | auth only, own | `stepName`, `status` (required, enum not validated), `formData?` (arbitrary JSON) | 200; 400 | upsert by (user, step) |

**Missing route:** the free budget page calls `PUT /budget/transactions/:id` to edit a transaction, but only `PUT /budget/:id` exists, so every edit fails.

### A.5 Shared calculation library (`lib/goal-math`)

| Function | Input | Output |
|---|---|---|
| `calculateProjection` (free-tier compound model) | currentAmount, targetAmount, targetDate, monthlyCashSaved, savingsBalance, savingsRatePercent, investmentValue, investmentRatePercent | monthsRemaining, amountStillNeeded, requiredMonthlySaving, projectedAmount, projectedShortfall, gapPercent, monthlyShortfall, monthlyGrowthFromReturns, onTrack, status (on_track / almost / off_track) |
| `applyMonthlyGrowth` | current, cash, savings balance + rate, investment value + rate | one month's accrued balance |
| `computeGoalProgress` (client pacing model) | currentAmount, targetAmount, targetDate, createdAt | progressPct, expectedPct, status (no_target / completed / on_track / at_risk / off_track), monthsRemaining, projectedCompletionDate |
| `solveCoastPoint` | currentValue, targetAmount, targetDate, monthlyContribution, blendedAnnualReturnPct | canCoastNow, coastMonthsFromNow, coastDate, valueAtCoastPoint |

## Appendix B — Frontend map: pages, user inputs, and the endpoints they call

Routing rules (`artifacts/wealthapp/src/App.tsx`): `/dashboard` redirects by role (super_admin → `/admin/dashboard`, advisor → `/advisor/dashboard`, investment_client → `/client/onboarding` until the track is complete, then `/client/dashboard`, everyone else → `/free/dashboard`). `/free/*` routes carry **no role restriction**, so every signed-in role can open them. `ProtectedRoute` renders the page while the profile is still loading, so role gating is deferred rather than blocking. No form in the frontend uses Zod; validation is ad-hoc state checks and disabled buttons.

### B.1 free_user

| Page | User inputs | Endpoints called |
|---|---|---|
| /free/dashboard | none (links, dismiss banner) | GET /health-score, /goals, /budget, /pathway, /assets, /liabilities, /budget/transactions?month=; one-time PUT /budget/:id backfill |
| /free/pathway (6-step wizard) | S1 age, lifeStage, isExpat, currency · S2 income (>0), incomeTypes[], stability · S3 housing, food, transport, utilities, entertainment, other · S4 goalType (required), goalTitle, goalTarget, goalMonth/Year · S5 savings, investments, debts, savingsRatePercent, investmentRatePercent · S6 five risk answers | PUT /pathway/:n (autosaved), PUT /profiles/me, POST /budget (new row each time), POST /goals/upsert-from-pathway, POST /assets/upsert-by-name, POST /liabilities/upsert-by-name, POST /health-score |
| /free/budget | monthly estimates (income + 6 expense lines); transaction sheet: description (required), amount (>0), type income/expense, category, transactionDate, isRecurring; carry-forward | PUT /budget/:id or POST /budget; POST /budget/transactions; PUT /budget/transactions/:id (**route missing**); DELETE /budget/transactions/:id; GET …/carry-forward-pending; POST …/carry-forward |
| /free/goals | title (required), goalType (11 options), currency USD/VND, targetAmount (> currentAmount), currentAmount, monthlyContribution, targetDate (month) | POST /goals (403 at 1-goal cap, shown as generic error), PUT /goals/:id, DELETE /goals/:id, POST /goals/auto-update (monthly, localStorage-gated) |
| /free/networth | asset: name, category (cash/savings/investment/property/other), valueUsd (>0), currency · liability: name, category (6), balanceUsd (>0), interestRatePercent | POST /assets, POST /liabilities, DELETE /assets/:id, DELETE /liabilities/:id (no edit UI) |
| /free/health-score | "Recalculate" button | GET /health-score (+history), POST /health-score (auto when none) |
| /free/milestones | none | localStorage only |
| Sol chat (mobile bottom nav only) | free-text message | GET /sol/conversation, POST /sol/chat |

### B.2 investment_client

| Page | User inputs | Endpoints called |
|---|---|---|
| /client/onboarding (8 screens) | S1 fullName (≥2), dateOfBirth, countryCode, isExpat, preferredCurrency · S2 monthlyIncome (>0), currency, incomeType[], stable · S3 track A/B · S4 one mini-form per holding type (ticker/units/avgCost/broker; coin/exchange; purchase/current value/mortgage; bank/balance; scheme/pension balance; other value) · S6 goalType (required), name, targetAmount, currency, targetDate · S7 six expense lines + extraInvestment · S8 confirm | PUT /client/profile/basics, POST /client/budget, POST /client/holdings (each), POST /goals or PUT /goals/:id, POST /client/onboarding/complete; reads /pathway, /goals, /client/profile/track, /client/advised-plans |
| /client/dashboard | scenario-alert dismiss/acknowledge, currency toggle | GET /client/dashboard/{goals,networth,scenario-alert,advisor}, /client/budget/:month, /client/health-score (+history), /client/networth/snapshots; PATCH /client/scenarios/:id/status |
| /client/portfolio | AddHoldingSheet per type: Ticker {label*, ticker*, units*, avgCost*, broker, purchaseDate, expectedReturn} · Crypto {label*, coin*, units*, avgCost*, exchange} · Property {label*, purchasePrice*, currentValue*, mortgage, rentalIncome, address, country} · Cash {label*, bankName*, balance*, accountType, rate} · Pension {label*, schemeName*, balance*, country, contributions} · Other {label*, currentValue*, costBasis, notes}; edit/delete | POST /client/holdings, PUT /client/holdings/:id, DELETE /client/holdings/:id, GET /symbols/search, GET /prices/stock/:ticker, POST /client/holdings/benchmark-preview; advised tab: GET /client/advised-plans, …/statements, …/holdings |
| /client/portfolio/holding/:id | transaction: date, type in/out, amount (>0), units, note | POST /client/holdings/:id/transactions, DELETE …/:txId |
| /client/portfolio/:planId | none (read-only statements) | GET /client/advised-plans/:planId/* |
| /client/scenarios | six scenario types: increase_monthly {newMonthly}, add_lump_sum {amount, when}, reduce_monthly, pause_contributions {months 1–36}, market_drop {%}, retire_earlier {goal, targetAmount, newDate}; shared years 1–40, assumedReturn 0–15 | POST /client/scenarios, DELETE /client/scenarios/:id, PATCH …/status; reads /client/scenarios?saved|advisor, /client/advised-strategy-returns, /client/holdings/:id/benchmark |
| /client/plan | RequestReviewSheet {urgency, message}; AddCommentForm {text} | GET /client/plan, /client/plan/coast-point?extraMonthly=; POST /client/plan/review-request; POST /client/plan/milestones/:id/comments |
| /client/goals | AddGoalSheet {type*, title*, targetAmount, currency, targetDate, priority, notes}; EditGoalSheet (+currentAmount); complete/cancel/reopen; GoalHoldingLinks {source, allocationPct}; interest CTA | POST /goals, PUT /goals/:id, PATCH /goals/:id/status, POST/DELETE /client/goals/:id/links, GET …/progress-movement, POST …/ensure-off-track-task, POST /leads/from-interest |
| /client/networth | AddAssetSheet {category*, label*, value*, currency}; AddLiabilitySheet {category*, label*, balance*, monthlyPayment, interestRate 0–50}; edit/delete | POST/PUT/DELETE /assets, /liabilities; POST /client/networth/snapshot (debounced, client totals); reads /client/holdings, /client/advised-plans |
| /client/budget | numeric keypad per line: income (primary, secondary, rental, other), 10 expense lines, investmentContributions[] via holding picker | POST /client/budget, POST /client/budget/sync-contributions; reads /client/budget/:month, /client/budget?limit=12 |
| /client/documents | "Request a document" {requestType, details} (no upload UI) | GET /documents, /conversations; POST /conversations/:id/messages |
| /client/messages | composer {content} | GET /conversations, /conversations/:id/messages; POST /conversations/:id/messages |
| plus every /free/* page | as free_user, writing to the same goals/assets tables | see B.1 (this is how the goal-wipe in Finding 10 is reachable) |

### B.3 advisor

| Page | User inputs | Endpoints called |
|---|---|---|
| /advisor/dashboard | none | GET /advisor/clients, /tasks, /leads |
| /advisor/clients | search | GET /advisor/clients |
| /advisor/clients/:id | client-profile form {status, riskProfile, kycStatus, notes}; message composer; StatementEntryForm create plan {providerName*, productName*, productCode, policyNumber, nickname, planType, annualPremium, initialPremium, effectiveDate*, maturityDate, status}; statement {periodStart*, periodEnd*, statementDate, openingValue*, closingValue*, contributions, fees…, funds[]}; plan status/contribution; DocumentsManager {title, category, fileUrl} | GET /advisor/clients/:id/{profile,client-profile,goals,tasks,advised-plans,documents}; PUT /advisor/clients/:id/client-profile; POST /advisor/clients/:id/advised-plans; POST …/advised-plans/:planId/statements; PUT /advised-plans/:id/status, /contribution; POST /advisor/clients/:id/documents; GET/POST /conversations…; (no net worth or budget view exists for promoted clients) |
| /advisor/tasks | {title, description, priority, status, dueDate} | POST/PUT/DELETE /tasks |
| /advisor/leads | {email, firstName, source, status, notes}; status change; convert {password} | POST /leads (the public route), PUT /leads/:id, POST /leads/:id/convert |
| /advisor/leads/:id | {status, notes}; messages; DocumentsManager | GET /leads/:id, /advisor/leads/:userId/{goals,networth,holdings,documents}; PUT /leads/:id; POST /advisor/leads/:id/documents |
| /admin/blog | {title, slug, excerpt, category, contentMarkdown, status, coverImageUrl} | POST /blog, PUT /blog/:id/admin; list = GET /blog (published only, so drafts vanish from the list) |
| plus every /free/* page | own rows | see B.1 |

### B.4 super_admin

| Page | User inputs | Endpoints called |
|---|---|---|
| /admin/dashboard | none | GET /admin/users, /leads, /blog, /admin/clients |
| /admin/users | create {fullName, email*, password*, role (4), advisorId, riskProfile}; inline role select; delete | POST /admin/users, PUT /admin/users/:id, DELETE /admin/users/:id; GET /admin/users, /admin/advisors |
| /admin/clients | reassign advisor | PUT /admin/users/:id {advisorId}; GET /admin/clients, /admin/advisors |
| /admin/leads | assign {advisorId} | PUT /leads/:id/assign; GET /leads |
| /admin/prices | refresh; override {price, priceDate, change1dPct} | POST /prices/refresh, POST /fund-prices; GET /fund-prices/latest |
| /admin/benchmarks | {label, tenYearCagrPct}; {label, targetAnnualReturnPct} | PUT /admin/asset-class-benchmarks/:id, PUT /admin/advised-strategy-returns/:id |
| /admin/funds | {name*, ticker, isin, assetClass*, currency, geography, fundManager, fundType, expenseRatio, priceApiSymbol, factsheetUrl}; price {priceDate, priceUsd} | POST /funds, PUT /funds/:id, POST /fund-prices; GET /funds/all |
| /admin/blog | as advisor | as advisor |
| all /advisor/* and all /client/* pages | same forms as those roles; backend bypasses every advisor-ownership check for super_admin; /client/* pages act on the admin's own user id (effectively empty) | as above |
