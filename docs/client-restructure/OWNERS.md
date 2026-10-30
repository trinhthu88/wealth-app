# Investment client fact ownership

This inventory follows the target ownership map in `MASTER_PROMPT.md` §5.
It distinguishes current storage from the approved target so later phases can
move consumers without treating legacy copies as authoritative.

| Fact | Target owner | Current extra copies / divergence | Phase that removes or contains the copies |
|---|---|---|---|
| Net worth and portfolio value | `netWorthService` computed from `client_holdings`, visible/in-force `advised_plans`, `assets`, `liabilities`, and `price_cache` | Browser-side net-worth sums; browser-posted `net_worth_snapshots`; legacy `portfolio_snapshots`; rough `client_financial_snapshots` | P2 moves current-value consumers to the service and stops browser snapshot writes; P10 retires legacy sources after export/cutover |
| Goal current amount | `goal_holding_links` when links exist, otherwise `financial_goals.current_amount` | Browser link sums; auto-update and pathway writes to `financial_goals.current_amount` | P3 |
| Goal status | `financial_goals.status` stores lifecycle only; pacing is derived | `paused` and pacing values such as `on_track`, `at_risk`, and `off_track` are currently mixed into status | P1 standardizes stored vocabulary; P3 separates lifecycle from derived pacing |
| Preferred currency | `profiles.preferred_currency` | `client_profiles.preferred_display_currency` | P5 |
| Risk profile | `client_profiles.risk_profile` with `risk_profile_source` | `profiles.risk_profile` | P5 |
| Onboarding state | `client_profiles.onboarding_stage` | `client_profiles.onboarding_step`, `prospect_onboarding_complete`, `full_onboarding_complete`, `onboarding_track_complete`, and `profiles.onboarding_complete` | P1 defines the shared enum; P5 adds/backfills the owner column and deprecates flags |
| Client track | Derived from visible advised plans | `client_profiles.client_track` | P5 |
| Advisor assignment | `client_profiles.advisor_id`, with history in `advisor_assignments` | Advisor IDs on plans, financial plans, conversations, and request bodies | P4 |
| Budget | `client_budget_months` | Legacy `budget_entries`; duplicated aggregate values within month rows are recalculated in the existing save flow | P7 |
| Investment contributions | Holding transaction ledger plus the planned plan-contribution ledger | `client_budget_months.investment_contributions` JSON and contribution totals on holding/plan rows | P9 |
| Wealth score | One scoring service; `health_scores` is historical output | Separate free/client formulas and write-on-read behavior | P9 |
| KYC status | `documents` with KYC category | `kyc_documents` and `client_profiles.kyc_status` | P9 |
| Scenarios | `scenario_runs` with `created_by_role` | Legacy `scenarios` v1 | P9 |
| Prices | Planned server-fed prices table | Request-time writes to `price_cache`; `fund_prices` is also present for fund data | P9 |
| Client status | `client_profiles.status`, writable only by advisor/admin | Client-writable status fields/routes | P1 constrains the vocabulary; P5 removes client write access |

## Phase 0 backup scope

The dated data exports cover the §5 owner and legacy-copy tables, plus their
direct client-data dependencies and Phase 1 lifecycle tables:

`profiles`, `client_profiles`, `leads`, `financial_goals`, `goal_holding_links`,
`goal_progress_snapshots`, `client_holdings`, `client_holding_transactions`,
`advised_plans`, `advised_plan_statements`, `advised_plan_holdings`,
`advised_plan_transactions`, `assets`, `liabilities`, `net_worth_snapshots`,
`client_budget_months`, `budget_entries`, `budget_transactions`,
`health_scores`, `portfolio_snapshots`, `client_financial_snapshots`,
`client_packages`, `portfolio_holdings`, `package_allocations`,
`package_transactions`, `price_cache`, `funds`, `fund_prices`, `documents`,
`kyc_documents`, `scenarios`, and `scenario_runs`.

The exports are ignored by Git and must remain local; they contain sensitive
client and financial records.
