// Pure calculation — no network calls, no phrasing. Detects the situations Sol
// is allowed to comment on (see SOL_PERSONA.md) from data already loaded by
// useGoals/useClientHoldings/useAdvisedPlans. generateSolCopy (./sol) turns the
// resulting SolObservation into the actual message.

import type { EnrichedGoal, GoalHoldingLink } from "@/hooks/useGoals";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";
import type { ClientHolding } from "@/hooks/useClientHoldings";
import type { SolObservation } from "./sol";

// Mirrors GoalHoldingLinks.tsx's investableHoldings filter — the same set of
// holding types the client can actually link to a goal.
const INVESTABLE_HOLDING_TYPES = new Set(["stock_etf", "crypto", "property", "pension", "cash"]);

export const UNALLOCATED_SOURCE_MIN_USD = 500;
export const NEWLY_ADDED_WINDOW_DAYS = 14;

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function totalAllocatedPct(allLinks: GoalHoldingLink[], sourceType: string, sourceId: string): number {
  return allLinks
    .filter(l => l.sourceType === sourceType && l.sourceId === sourceId)
    .reduce((sum, l) => sum + (parseFloat(l.allocationPct) || 0), 0);
}

export interface UnallocatedSource {
  sourceType: "advised_plan" | "self_holding";
  sourceId: string;
  isNew: boolean;
  observation: SolObservation;
}

interface SourceContext {
  goals: EnrichedGoal[];
  holdings: ClientHolding[];
  plans: AdvisedPlan[];
  allLinks: GoalHoldingLink[];
}

/** One entry per plan/holding that has nothing linked to any goal yet. */
export function detectUnallocatedSources(ctx: SourceContext): UnallocatedSource[] {
  const goalNames = ctx.goals.filter(g => g.status !== "completed" && g.status !== "cancelled").map(g => g.title);
  if (goalNames.length === 0) return [];

  const results: UnallocatedSource[] = [];

  for (const plan of ctx.plans) {
    if (plan.status !== "inforce" || !plan.isVisibleToClient) continue;
    const value = parseFloat(plan.latestAccountValue) || 0;
    if (value < UNALLOCATED_SOURCE_MIN_USD) continue;
    if (totalAllocatedPct(ctx.allLinks, "advised_plan", plan.id) > 0) continue;

    const age = daysSince(plan.createdAt);
    const isNew = age <= NEWLY_ADDED_WINDOW_DAYS;
    const holdingLabel = plan.nickname ?? plan.productName;
    results.push({
      sourceType: "advised_plan", sourceId: plan.id, isNew,
      observation: isNew
        ? { type: "newly_added_holding", holdingLabel, amountUsd: value, daysAgo: age, goalNames }
        : { type: "unallocated_holding", holdingLabel, amountUsd: value, goalNames },
    });
  }

  for (const holding of ctx.holdings) {
    if (!holding.isActive || !INVESTABLE_HOLDING_TYPES.has(holding.holdingType)) continue;
    if (holding.currentValue < UNALLOCATED_SOURCE_MIN_USD) continue;
    if (totalAllocatedPct(ctx.allLinks, "self_holding", holding.id) > 0) continue;

    const age = daysSince(holding.createdAt);
    const isNew = age <= NEWLY_ADDED_WINDOW_DAYS;
    const holdingLabel = holding.ticker ? `${holding.label} · ${holding.ticker}` : holding.label;
    results.push({
      sourceType: "self_holding", sourceId: holding.id, isNew,
      observation: isNew
        ? { type: "newly_added_holding", holdingLabel, amountUsd: holding.currentValue, daysAgo: age, goalNames }
        : { type: "unallocated_holding", holdingLabel, amountUsd: holding.currentValue, goalNames },
    });
  }

  return results;
}

/** Newest first, then largest value — the order suggestions should be offered in. */
export function rankUnallocatedSources(sources: UnallocatedSource[]): UnallocatedSource[] {
  return [...sources].sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    const av = "amountUsd" in a.observation ? a.observation.amountUsd : 0;
    const bv = "amountUsd" in b.observation ? b.observation.amountUsd : 0;
    return bv - av;
  });
}

/**
 * The single suggestion to show right now. Only one shows at a time, but this
 * is what makes the queue actually advance: a source that's been linked
 * already drops out of `sources` on its own (detectUnallocatedSources stops
 * returning it), and a source the client dismissed is skipped here via
 * `isDismissed` — either way, the next-ranked source takes its place instead
 * of the same one blocking the rest forever.
 */
export function pickNextSuggestion(
  sources: UnallocatedSource[],
  isDismissed: (sourceType: string, sourceId: string) => boolean,
): UnallocatedSource | null {
  return rankUnallocatedSources(sources).find(s => !isDismissed(s.sourceType, s.sourceId)) ?? null;
}

/** One entry per active goal that's currently off pace. */
export function detectOffTrackGoals(goals: EnrichedGoal[]): SolObservation[] {
  return goals
    .filter(g => g.status !== "completed" && g.status !== "cancelled" && g.trackStatus === "off_track")
    .map(g => ({ type: "off_track", goalTitle: g.title }));
}

/**
 * Builds the observation for a blocked over-allocation attempt. `remainingPct`
 * comes from the server's 409 response (the same math as goalAllocation.ts);
 * this just adds which other goals are already holding the rest, from data the
 * client already has.
 */
export function buildOverAllocationObservation(
  ctx: Pick<SourceContext, "goals" | "allLinks">,
  params: { sourceType: string; sourceId: string; holdingLabel: string; remainingPct: number; excludeGoalId: string },
): SolObservation {
  const otherGoalNames = ctx.allLinks
    .filter(l => l.sourceType === params.sourceType && l.sourceId === params.sourceId && l.goalId !== params.excludeGoalId)
    .map(l => ctx.goals.find(g => g.id === l.goalId)?.title)
    .filter((t): t is string => !!t);

  return {
    type: "over_allocation_blocked",
    holdingLabel: params.holdingLabel,
    remainingPct: params.remainingPct,
    otherGoalNames,
  };
}
