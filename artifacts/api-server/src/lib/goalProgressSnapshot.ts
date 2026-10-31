import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db, goalProgressSnapshotsTable, goalHoldingLinksTable,
  advisedPlansTable, clientHoldingsTable, financialGoalsTable, priceCacheTable,
} from "@workspace/db";
import { computeGoalProgress } from "@workspace/goal-math";
import { convertToUsd, getCurrencyRatesFor, type CurrencyRates } from "@workspace/net-worth";
import { TICKER_BASED_TYPES, valueOfHolding } from "./netWorthService";

export { valueOfHolding as resolveHoldingValueUsd };

export interface LinkBreakdownEntry {
  sourceType: string;
  sourceId: string;
  allocationPct: number;
  sourceValueUsd: number;
  contributionUsd: number;
}

export type GoalPacing = "no_target" | "on_track" | "at_risk" | "off_track" | "completed";

/**
 * Rebuilds a goal's current funding picture in USD: linked source values are
 * valued by the shared net-worth helper, otherwise the manual amount is
 * converted from the goal's currency.
 */
export async function computeCurrentBreakdown(
  userId: string,
  goalId: string,
  rates?: CurrencyRates,
): Promise<{
  computedCurrentAmount: number;
  linkBreakdown: LinkBreakdownEntry[];
}> {
  const links = await db.select().from(goalHoldingLinksTable)
    .where(and(eq(goalHoldingLinksTable.goalId, goalId), eq(goalHoldingLinksTable.userId, userId)));

  if (links.length === 0) {
    const [goal] = await db.select({
      currentAmount: financialGoalsTable.currentAmount,
      currency: financialGoalsTable.currency,
    })
      .from(financialGoalsTable).where(eq(financialGoalsTable.id, goalId));
    const currencyRates = rates ?? await getCurrencyRatesFor([goal?.currency]);
    const currentAmount = parseFloat(goal?.currentAmount ?? "0") || 0;
    return {
      computedCurrentAmount: convertToUsd(currentAmount, goal?.currency, currencyRates),
      linkBreakdown: [],
    };
  }

  const planIds = links.filter(l => l.sourceType === "advised_plan").map(l => l.sourceId);
  const holdingIds = links.filter(l => l.sourceType === "self_holding").map(l => l.sourceId);

  const [plans, holdings] = await Promise.all([
    planIds.length > 0
      ? db.select({
          id: advisedPlansTable.id,
          value: advisedPlansTable.latestAccountValue,
          currency: advisedPlansTable.currency,
        })
          .from(advisedPlansTable).where(eq(advisedPlansTable.userId, userId))
      : Promise.resolve([]),
    holdingIds.length > 0
      ? db.select().from(clientHoldingsTable).where(eq(clientHoldingsTable.userId, userId))
      : Promise.resolve([] as (typeof clientHoldingsTable.$inferSelect)[]),
  ]);
  const currencyRates = rates ?? await getCurrencyRatesFor([
    ...plans.map((plan) => plan.currency),
    ...holdings.map((holding) => holding.currency),
  ]);
  const planValueById = new Map(plans.map(p => [
    p.id,
    convertToUsd(parseFloat(p.value ?? "0") || 0, p.currency, currencyRates),
  ]));

  const symbols = holdings
    .filter(h => TICKER_BASED_TYPES.has(h.holdingType) || h.holdingType === "crypto")
    .map(h => (h.holdingType === "crypto" ? h.coinSymbol : h.ticker)?.toUpperCase())
    .filter((s): s is string => !!s);
  const priceRows = symbols.length > 0
    ? await db.select({ symbol: priceCacheTable.symbol, priceUsd: priceCacheTable.priceUsd })
        .from(priceCacheTable).where(inArray(priceCacheTable.symbol, symbols))
    : [];
  const priceBySymbol = new Map(priceRows.map(p => [p.symbol.toUpperCase(), parseFloat(p.priceUsd) || 0]));

  const holdingValueById = new Map(holdings.map(h => [h.id, valueOfHolding(h, priceBySymbol, currencyRates)]));

  const linkBreakdown: LinkBreakdownEntry[] = links.map(l => {
    const allocationPct = parseFloat(l.allocationPct) || 0;
    const sourceValueUsd = l.sourceType === "advised_plan"
      ? (planValueById.get(l.sourceId) ?? 0)
      : (holdingValueById.get(l.sourceId) ?? 0);
    return {
      sourceType: l.sourceType,
      sourceId: l.sourceId,
      allocationPct,
      sourceValueUsd,
      contributionUsd: sourceValueUsd * (allocationPct / 100),
    };
  });

  const computedCurrentAmount = linkBreakdown.reduce((sum, l) => sum + l.contributionUsd, 0);
  return { computedCurrentAmount, linkBreakdown };
}

export async function computeGoalFundingSummary(
  userId: string,
  goal: typeof financialGoalsTable.$inferSelect,
) {
  const { computedCurrentAmount, linkBreakdown } = await computeCurrentBreakdown(userId, goal.id);
  const rawTarget = goal.targetAmount == null ? null : parseFloat(goal.targetAmount);
  const targetRates = await getCurrencyRatesFor([goal.currency]);
  const targetAmountUsd = rawTarget != null && Number.isFinite(rawTarget)
    ? convertToUsd(rawTarget, goal.currency, targetRates)
    : null;
  const progress = computeGoalProgress({
    currentAmount: computedCurrentAmount,
    targetAmount: targetAmountUsd,
    targetDate: goal.targetDate,
    createdAt: goal.createdAt.toISOString(),
  });

  return {
    ...goal,
    funding: {
      currentAmount: computedCurrentAmount,
      currency: "USD" as const,
      source: linkBreakdown.length > 0 ? "links" as const : "manual" as const,
      breakdown: linkBreakdown,
    },
    targetAmountUsd,
    pacing: (goal.status === "completed" ? "completed" : progress.status) as GoalPacing,
    progressPct: progress.progressPct,
    expectedPct: progress.expectedPct,
    monthsRemaining: progress.monthsRemaining,
    projectedCompletionDate: progress.projectedCompletionDate,
  };
}

/**
 * Writes today's snapshot for a goal if one doesn't already exist for today.
 * Cheap to call on every goal-detail view — it's a no-op past the first call
 * of the day (unique constraint on goalId+snapshotDate backs this up too).
 */
export async function recordSnapshotIfStale(userId: string, goalId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const [existingToday] = await db.select({ id: goalProgressSnapshotsTable.id })
    .from(goalProgressSnapshotsTable)
    .where(and(eq(goalProgressSnapshotsTable.goalId, goalId), eq(goalProgressSnapshotsTable.snapshotDate, today)));
  if (existingToday) return;

  const { computedCurrentAmount, linkBreakdown } = await computeCurrentBreakdown(userId, goalId);
  await db.insert(goalProgressSnapshotsTable).values({
    goalId, userId, snapshotDate: today,
    computedCurrentAmount: String(computedCurrentAmount),
    linkBreakdown,
  }).onConflictDoNothing();
}

export interface ProgressMovement {
  hasPrior: boolean;
  fromDate: string | null;
  toDate: string | null;
  deltaTotal: number;
  marketDelta: number;
  contributionDelta: number;
  reallocationDelta: number;
}

/** Pure diff — no DB access, no rounding decisions Sol gets to make on its own. */
export function attributeProgressMovement(
  previous: { snapshotDate: string; computedCurrentAmount: string; linkBreakdown: unknown } | undefined,
  current: { snapshotDate: string; computedCurrentAmount: string; linkBreakdown: unknown },
): ProgressMovement {
  const currentTotal = parseFloat(current.computedCurrentAmount) || 0;

  if (!previous) {
    return {
      hasPrior: false, fromDate: null, toDate: current.snapshotDate,
      deltaTotal: 0, marketDelta: 0, contributionDelta: 0, reallocationDelta: 0,
    };
  }

  const previousTotal = parseFloat(previous.computedCurrentAmount) || 0;
  const deltaTotal = currentTotal - previousTotal;

  const prevLinks = new Map(
    (previous.linkBreakdown as LinkBreakdownEntry[]).map(l => [`${l.sourceType}:${l.sourceId}`, l]),
  );
  const currLinks = new Map(
    (current.linkBreakdown as LinkBreakdownEntry[]).map(l => [`${l.sourceType}:${l.sourceId}`, l]),
  );

  let marketDelta = 0;
  let contributionDelta = 0;
  let reallocationDelta = 0;

  for (const [key, curr] of currLinks) {
    const prev = prevLinks.get(key);
    if (!prev) {
      // A holding that wasn't funding this goal yesterday is funding it today.
      contributionDelta += curr.contributionUsd;
    } else if (prev.allocationPct !== curr.allocationPct) {
      // Same holding, different % — a deliberate reallocation, not the market moving.
      reallocationDelta += curr.contributionUsd - prev.contributionUsd;
    } else {
      // Same holding, same %  any change in contribution is the source value moving.
      marketDelta += curr.contributionUsd - prev.contributionUsd;
    }
  }
  for (const [key, prev] of prevLinks) {
    if (!currLinks.has(key)) reallocationDelta -= prev.contributionUsd;
  }

  // No links at all on either side (manually-entered currentAmount) — nothing to
  // attribute, treat the whole move as a contribution.
  if (prevLinks.size === 0 && currLinks.size === 0) contributionDelta = deltaTotal;

  return {
    hasPrior: true,
    fromDate: previous.snapshotDate,
    toDate: current.snapshotDate,
    deltaTotal,
    marketDelta,
    contributionDelta,
    reallocationDelta,
  };
}

/** Ensures today's snapshot exists, then diffs it against the most recent prior one. */
export async function getProgressMovement(userId: string, goalId: string): Promise<ProgressMovement> {
  await recordSnapshotIfStale(userId, goalId);

  const snapshots = await db.select().from(goalProgressSnapshotsTable)
    .where(and(eq(goalProgressSnapshotsTable.goalId, goalId), eq(goalProgressSnapshotsTable.userId, userId)))
    .orderBy(desc(goalProgressSnapshotsTable.snapshotDate))
    .limit(2);

  const [current, previous] = snapshots;
  if (!current) {
    return { hasPrior: false, fromDate: null, toDate: null, deltaTotal: 0, marketDelta: 0, contributionDelta: 0, reallocationDelta: 0 };
  }
  return attributeProgressMovement(previous, current);
}
