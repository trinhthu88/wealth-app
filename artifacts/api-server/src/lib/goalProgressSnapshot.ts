import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db, goalProgressSnapshotsTable, goalHoldingLinksTable,
  advisedPlansTable, clientHoldingsTable, financialGoalsTable, priceCacheTable,
} from "@workspace/db";

// Mirrors useClientHoldings.ts's enrichHolding() valuation exactly — a holding's
// "current value" depends on its type, and for ticker/crypto types on a live price
// this snapshot has to look up itself (the frontend hook does the same lookup via
// usePriceCache). Falls back to cost basis (units * average cost) when no cached
// price exists yet, same as the frontend does.
const TICKER_BASED_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "commodity", "bond"]);

export function resolveHoldingValueUsd(holding: {
  holdingType: string;
  unitsHeld: string | null;
  averageCostPrice: string | null;
  ticker: string | null;
  coinSymbol: string | null;
  currentEstimatedValue: string | null;
  currentBalance: string | null;
  currentBalancePension: string | null;
  currentValueOther: string | null;
}, priceBySymbol: Map<string, number>): number {
  const type = holding.holdingType;

  if (TICKER_BASED_TYPES.has(type) || type === "crypto") {
    const symbol = (type === "crypto" ? holding.coinSymbol : holding.ticker)?.toUpperCase() ?? "";
    const units = parseFloat(holding.unitsHeld ?? "0") || 0;
    const avgCost = parseFloat(holding.averageCostPrice ?? "0") || 0;
    const livePrice = priceBySymbol.get(symbol);
    return units * (livePrice ?? avgCost);
  }
  if (type === "property") return parseFloat(holding.currentEstimatedValue ?? "0") || 0;
  if (type === "cash") return parseFloat(holding.currentBalance ?? "0") || 0;
  if (type === "pension") return parseFloat(holding.currentBalancePension ?? "0") || 0;
  return parseFloat(holding.currentValueOther ?? "0") || 0;
}

export interface LinkBreakdownEntry {
  sourceType: string;
  sourceId: string;
  allocationPct: number;
  sourceValueUsd: number;
  contributionUsd: number;
}

/**
 * Rebuilds a goal's current funding picture the same way the frontend's
 * `useGoals` does (see the tier note in `@workspace/goal-math`): sum of each
 * linked holding's value at its allocation %, falling back to the goal's own
 * manually-entered `currentAmount` when nothing is linked.
 */
export async function computeCurrentBreakdown(userId: string, goalId: string): Promise<{
  computedCurrentAmount: number;
  linkBreakdown: LinkBreakdownEntry[];
}> {
  const links = await db.select().from(goalHoldingLinksTable)
    .where(and(eq(goalHoldingLinksTable.goalId, goalId), eq(goalHoldingLinksTable.userId, userId)));

  if (links.length === 0) {
    const [goal] = await db.select({ currentAmount: financialGoalsTable.currentAmount })
      .from(financialGoalsTable).where(eq(financialGoalsTable.id, goalId));
    return { computedCurrentAmount: parseFloat(goal?.currentAmount ?? "0") || 0, linkBreakdown: [] };
  }

  const planIds = links.filter(l => l.sourceType === "advised_plan").map(l => l.sourceId);
  const holdingIds = links.filter(l => l.sourceType === "self_holding").map(l => l.sourceId);

  const [plans, holdings] = await Promise.all([
    planIds.length > 0
      ? db.select({ id: advisedPlansTable.id, value: advisedPlansTable.latestAccountValue })
          .from(advisedPlansTable).where(eq(advisedPlansTable.userId, userId))
      : Promise.resolve([]),
    holdingIds.length > 0
      ? db.select().from(clientHoldingsTable).where(eq(clientHoldingsTable.userId, userId))
      : Promise.resolve([] as (typeof clientHoldingsTable.$inferSelect)[]),
  ]);
  const planValueById = new Map(plans.map(p => [p.id, parseFloat(p.value ?? "0") || 0]));

  const symbols = holdings
    .filter(h => TICKER_BASED_TYPES.has(h.holdingType) || h.holdingType === "crypto")
    .map(h => (h.holdingType === "crypto" ? h.coinSymbol : h.ticker)?.toUpperCase())
    .filter((s): s is string => !!s);
  const priceRows = symbols.length > 0
    ? await db.select({ symbol: priceCacheTable.symbol, priceUsd: priceCacheTable.priceUsd })
        .from(priceCacheTable).where(inArray(priceCacheTable.symbol, symbols))
    : [];
  const priceBySymbol = new Map(priceRows.map(p => [p.symbol.toUpperCase(), parseFloat(p.priceUsd) || 0]));

  const holdingValueById = new Map(holdings.map(h => [h.id, resolveHoldingValueUsd(h, priceBySymbol)]));

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
