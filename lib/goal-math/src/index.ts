/**
 * Canonical goal-progress math, shared between the API server and the frontend so
 * "on track" never means two different things depending on which surface renders it.
 *
 * There are two genuinely different models here, scoped by tier — not an accidental
 * duplication:
 *
 * - `calculateProjection` / `applyMonthlyGrowth` (compoundProjection.ts) — the FREE-tier
 *   model, also reused by the backend health-score route. A free-tier goal's stored
 *   `current_amount` is a ledger the monthly auto-update job accumulates (cash saved +
 *   interest/gains *earned on* the user's savings/investment balances — see
 *   `applyMonthlyGrowth`), which never itself contains the savings/investment principal.
 *   Callers pass `currentAmount + savingsBalance + investmentValue` as the "effective"
 *   starting point, and the projection only adds *future* growth on top (via
 *   `pow(rate, months) - 1`, growth-only, not the principal again) — so the balances are
 *   counted once as today's principal and never re-added. This is intentional, not a bug:
 *   free-tier users are capped at one goal, so there's no risk of one balance funding
 *   multiple goals at once.
 *
 * - `computeGoalProgress` (pacingProgress.ts) — the INVESTMENT-CLIENT-tier model, driven
 *   by elapsed-time-vs-target-date pacing. A client's goal `currentAmount` here means
 *   something entirely different: either the live value of holdings explicitly linked to
 *   that goal (`goal_holding_links`), or a manually entered "amount saved" when no
 *   holdings are linked — never the client's whole savings/investment balance. Clients can
 *   have unlimited goals and often link the *same* underlying holding to more than one, so
 *   summing whole-balance principal into every goal would double- (or triple-) count it
 *   across goals. Elapsed-time pacing also matches how advisors set target dates against a
 *   plan, rather than a forward compounding assumption.
 *
 * Do not add a third variant inline — import from here.
 */
export { calculateProjection, applyMonthlyGrowth } from "./compoundProjection";
export type { ProjectionInput, ProjectionResult } from "./compoundProjection";
export { computeGoalProgress } from "./pacingProgress";
export type { GoalStatus, GoalProgressResult } from "./pacingProgress";
export { solveCoastPoint } from "./coastPoint";
export type { CoastPointInput, CoastPointResult } from "./coastPoint";
