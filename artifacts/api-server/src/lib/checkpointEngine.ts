import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  db, clientBudgetMonthsTable, clientHoldingsTable, clientProfilesTable, conversionCheckpointsTable,
  financialGoalsTable, goalProgressSnapshotsTable, healthScoresTable, membershipsTable, profilesTable, advisedPlansTable,
  type ConversionCheckpoint,
} from "@workspace/db";
import {
  decide, evaluate, isSuppressed,
  type CheckpointCandidate, type CheckpointContext, type ExistingCheckpoint,
} from "@workspace/checkpoints";
import { computeGoalProgress } from "@workspace/goal-math";
import { membershipGraceUntil, resolveTier, type CheckpointCode, type MembershipStatus } from "@workspace/tier-policy";
import { resolveHoldingBenchmark } from "./benchmarks";
import { computeGoalFundingSummary, recordSnapshotIfStale } from "./goalProgressSnapshot";
import { getLeadForUser } from "./entitlements";
import { TICKER_BASED_TYPES, computeNetWorth } from "./netWorthService";
import { loadEngagementStreak } from "./engagementRead";
import { logger } from "./logger";

const SCORE_DIMENSIONS = [
  ["budget", "budgetScore"], ["goals", "goalsScore"], ["net worth", "netWorthScore"],
  ["savings", "savingsScore"], ["debt", "debtToAssetScore"],
] as const;

type ScoreRow = typeof healthScoresTable.$inferSelect;
function weakestDimension(row: ScoreRow): string | null {
  const scored = SCORE_DIMENSIONS
    .map(([label, key]) => ({ label, value: row[key] }))
    .filter((d): d is { label: (typeof SCORE_DIMENSIONS)[number][0]; value: number } => d.value !== null);
  if (scored.length === 0) return null;
  return scored.reduce((low, d) => (d.value < low.value ? d : low)).label;
}

async function loadExisting(userId: string): Promise<ExistingCheckpoint[]> {
  return db.select({
    id: conversionCheckpointsTable.id,
    code: conversionCheckpointsTable.code,
    firedAt: conversionCheckpointsTable.firedAt,
    dismissedAt: conversionCheckpointsTable.dismissedAt,
    acceptedAt: conversionCheckpointsTable.acceptedAt,
  }).from(conversionCheckpointsTable).where(eq(conversionCheckpointsTable.userId, userId));
}

async function loadGoals(userId: string): Promise<CheckpointContext["goals"]> {
  const goals = (await db.select().from(financialGoalsTable)
    .where(eq(financialGoalsTable.userId, userId)))
    .filter(goal => goal.status !== "draft");
  return Promise.all(goals.map(async (goal) => {
    if (goal.status === "active") await recordSnapshotIfStale(userId, goal.id);
    const [summary, snapshots] = await Promise.all([
      computeGoalFundingSummary(userId, goal),
      db.select({ date: goalProgressSnapshotsTable.snapshotDate, amount: goalProgressSnapshotsTable.computedCurrentAmount })
        .from(goalProgressSnapshotsTable)
        .where(eq(goalProgressSnapshotsTable.goalId, goal.id))
        .orderBy(desc(goalProgressSnapshotsTable.snapshotDate))
        .limit(2),
    ]);
    return {
      id: goal.id,
      title: goal.title,
      goalType: goal.goalType,
      status: goal.status,
      hasTargetAndDate: !!goal.targetAmount && !!goal.targetDate,
      snapshotStatuses: snapshots.map((s) => computeGoalProgress({
        currentAmount: parseFloat(s.amount) || 0,
        targetAmount: summary.targetAmountUsd,
        targetDate: goal.targetDate,
        createdAt: goal.createdAt.toISOString(),
      }, new Date(`${s.date}T12:00:00Z`)).status),
      gapUsd: summary.targetAmountUsd === null ? null : Math.max(0, Math.round(summary.targetAmountUsd - summary.funding.currentAmount)),
      monthsRemaining: summary.monthsRemaining,
    };
  }));
}

async function loadHoldings(userId: string): Promise<CheckpointContext["holdings"]> {
  const holdings = await db.select().from(clientHoldingsTable)
    .where(and(eq(clientHoldingsTable.userId, userId), eq(clientHoldingsTable.isActive, true)));
  const netWorth = await computeNetWorth(userId, { currency: "USD" });
  const valueById = new Map(netWorth.items.map((item) => [item.id, item.value]));
  return Promise.all(holdings.map(async (holding) => {
    let deviationPp: number | null = null;
    if (TICKER_BASED_TYPES.has(holding.holdingType) && holding.expectedAnnualReturnPct !== null) {
      const benchmark = await resolveHoldingBenchmark({
        holdingType: holding.holdingType,
        ticker: holding.ticker,
        coinSymbol: holding.coinSymbol,
        interestRatePct: holding.interestRatePct,
        expectedAnnualReturnPct: holding.expectedAnnualReturnPct,
      });
      if (benchmark.isOverride && benchmark.benchmarkValue !== null) {
        deviationPp = Math.round((benchmark.value - benchmark.benchmarkValue) * 10) / 10;
      }
    }
    return { id: holding.id, label: holding.label, valueUsd: valueById.get(holding.id) ?? 0, deviationPp };
  }));
}

async function loadContext(userId: string): Promise<CheckpointContext | null> {
  const [[profile], [clientProfile], [inforcePlan], lead, existingCheckpoints, [membership]] = await Promise.all([
    db.select({ role: profilesTable.role, createdAt: profilesTable.createdAt }).from(profilesTable).where(eq(profilesTable.id, userId)),
    db.select({ clientTrack: clientProfilesTable.clientTrack, onboardingStage: clientProfilesTable.onboardingStage })
      .from(clientProfilesTable).where(eq(clientProfilesTable.userId, userId)),
    db.select({ id: advisedPlansTable.id }).from(advisedPlansTable)
      .where(and(eq(advisedPlansTable.userId, userId), eq(advisedPlansTable.status, "inforce"))).limit(1),
    getLeadForUser(userId),
    loadExisting(userId),
    db.select().from(membershipsTable).where(eq(membershipsTable.userId, userId)),
  ]);
  if (!profile) return null;
  if (profile.role === "advisor" || profile.role === "super_admin") return null;
  const tier = resolveTier(
    profile.role, clientProfile?.clientTrack ?? null, !!inforcePlan,
    (membership?.status ?? "none") as MembershipStatus, membershipGraceUntil(membership?.currentPeriodEnd ?? null),
  );

  // Track A only ever gets the trial reminder, so its financial data isn't loaded.
  const skipData = tier === "track_a";
  const [goals, holdings, budgetMonths, scores, streakWeeks] = await Promise.all([
    skipData ? [] : loadGoals(userId),
    skipData ? [] : loadHoldings(userId),
    skipData ? [] : db.select().from(clientBudgetMonthsTable).where(eq(clientBudgetMonthsTable.userId, userId))
      .orderBy(desc(clientBudgetMonthsTable.month)).limit(3),
    skipData ? [] : db.select().from(healthScoresTable).where(eq(healthScoresTable.userId, userId))
      .orderBy(desc(healthScoresTable.scoreDate), desc(healthScoresTable.createdAt)).limit(1),
    skipData ? null : loadEngagementStreak(userId),
  ]);

  return {
    tier,
    onboardingComplete: clientProfile?.onboardingStage === "complete",
    signedUpAt: profile.createdAt,
    hasInforcePlan: !!inforcePlan,
    goals,
    holdings,
    budgetMonths: budgetMonths.map((m) => ({
      month: m.month,
      netSurplus: parseFloat(m.netSurplus ?? "0") || 0,
      totalIncome: parseFloat(m.totalIncome ?? "0") || 0,
    })),
    scores: scores.map((s) => ({ overallScore: s.overallScore, scoreDate: s.scoreDate, weakest: weakestDimension(s) })),
    engagement: streakWeeks === null ? null : { streakWeeks },
    existingCheckpoints,
    leadStatus: lead?.status ?? null,
    leadUpdatedAt: lead?.updatedAt ?? null,
    membership: membership
      ? { status: membership.status, trialEndsAt: membership.trialEndsAt, cancelAtPeriodEnd: membership.cancelAtPeriodEnd }
      : null,
    now: new Date(),
  };
}

/** Applies a decision under a per-user lock, so concurrent writes open at most one row. */
async function applyDecision(userId: string, candidates: CheckpointCandidate[]): Promise<void> {
  if (candidates.length === 0) return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`checkpoint:${userId}`}))`);
    const existing = await tx.select({
      id: conversionCheckpointsTable.id,
      code: conversionCheckpointsTable.code,
      firedAt: conversionCheckpointsTable.firedAt,
      dismissedAt: conversionCheckpointsTable.dismissedAt,
      acceptedAt: conversionCheckpointsTable.acceptedAt,
    }).from(conversionCheckpointsTable).where(eq(conversionCheckpointsTable.userId, userId));
    const { fire, supersede } = decide(candidates, existing);
    if (!fire) return;
    if (supersede) {
      await tx.update(conversionCheckpointsTable)
        .set({
          dismissedAt: new Date(),
          snapshot: sql`${conversionCheckpointsTable.snapshot} || ${JSON.stringify({ supersededBy: fire.code })}::jsonb`,
        })
        .where(eq(conversionCheckpointsTable.id, supersede.id));
    }
    await tx.insert(conversionCheckpointsTable)
      .values({ userId, code: fire.code, snapshot: fire.snapshot })
      .onConflictDoNothing();
  });
}

/** The post-write hook. Never fails the write that triggered it. */
export async function runCheckpointHook(userId: string): Promise<void> {
  try {
    const ctx = await loadContext(userId);
    if (ctx) await applyDecision(userId, evaluate(ctx));
  } catch (err) {
    logger.error({ err, userId }, "Checkpoint evaluation failed");
  }
}

/** Fires C2 or the sixth-holding path of C5 when requireAllowance refuses a free user. */
export async function raiseCheckpoint(userId: string, code: CheckpointCode, snapshot: Record<string, unknown>): Promise<void> {
  try {
    const [existingCheckpoints, lead] = await Promise.all([loadExisting(userId), getLeadForUser(userId)]);
    const suppressed = isSuppressed(code, {
      existingCheckpoints,
      leadStatus: lead?.status ?? null,
      leadUpdatedAt: lead?.updatedAt ?? null,
      now: new Date(),
    });
    if (!suppressed) await applyDecision(userId, [{ code, snapshot }]);
  } catch (err) {
    logger.error({ err, userId, code }, "Raising a checkpoint failed");
  }
}

export async function getOpenCheckpoint(userId: string): Promise<ConversionCheckpoint | null> {
  const [open] = await db.select().from(conversionCheckpointsTable).where(and(
    eq(conversionCheckpointsTable.userId, userId),
    isNull(conversionCheckpointsTable.dismissedAt),
    isNull(conversionCheckpointsTable.acceptedAt),
  ));
  return open ?? null;
}
