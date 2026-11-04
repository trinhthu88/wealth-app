import { and, desc, eq, sql } from "drizzle-orm";
import {
  db, clientBudgetMonthsTable, clientProfilesTable, financialGoalsTable, healthScoresTable,
  profilesTable, userEngagementTable,
} from "@workspace/db";
import { computeGoalFundingSummary } from "./goalProgressSnapshot";
import { computeNetWorth } from "./netWorthService";
import { runCheckpointHook } from "./checkpointEngine";
import { logger } from "./logger";

const WEEK_MS = 7 * 86_400_000;

/** The Monday of this date's week, in UTC. */
export function weekStart(d: Date): Date {
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1));
  return monday;
}

/** Weekly streak, ported from the browser: same week holds, next week grows, a gap restarts. */
export function nextStreak(weeks: number, lastCheckinAt: Date | null, now: Date): number {
  if (!lastCheckinAt) return 1;
  const diffWeeks = Math.round((weekStart(now).getTime() - weekStart(lastCheckinAt).getTime()) / WEEK_MS);
  if (diffWeeks === 0) return Math.max(weeks, 1);
  return diffWeeks === 1 ? weeks + 1 : 1;
}

export interface MilestoneFacts {
  goalsCount: number;
  onboardingComplete: boolean;
  streakWeeks: number;
  netWorth: number;
  effectiveSavingsRate: number;
  goalOnTrack: boolean;
  healthScore: number;
  budgetMonthsCount: number;
}

// DECISION: plan_starter meant finishing the pathway wizard, which is gone, so it now means
// completing onboarding. Its key is unchanged so an earned chip keeps its meaning.
const MILESTONE_CHECKS: Record<string, (f: MilestoneFacts) => boolean> = {
  goal_setter: (f) => f.goalsCount >= 1,
  plan_starter: (f) => f.onboardingComplete,
  streak_4: (f) => f.streakWeeks >= 4,
  streak_12: (f) => f.streakWeeks >= 12,
  net_worth_pos: (f) => f.netWorth > 0,
  saver_20: (f) => f.effectiveSavingsRate >= 20,
  goal_on_track: (f) => f.goalOnTrack,
  score_70: (f) => f.healthScore >= 70,
  score_80: (f) => f.healthScore >= 80,
  budget_3months: (f) => f.budgetMonthsCount >= 3,
};

/** Milestones stay earned: this only ever adds keys. */
export function awardMilestones(earned: string[], facts: MilestoneFacts): string[] {
  const added = Object.keys(MILESTONE_CHECKS).filter((key) => !earned.includes(key) && MILESTONE_CHECKS[key](facts));
  return [...earned, ...added];
}

async function loadFacts(userId: string, streakWeeks: number): Promise<MilestoneFacts> {
  const [goals, budgetMonths, [score], [clientProfile], netWorth] = await Promise.all([
    db.select().from(financialGoalsTable).where(and(eq(financialGoalsTable.userId, userId), eq(financialGoalsTable.status, "active"))),
    db.select({ savingsRatePct: clientBudgetMonthsTable.savingsRatePct }).from(clientBudgetMonthsTable)
      .where(eq(clientBudgetMonthsTable.userId, userId)).orderBy(desc(clientBudgetMonthsTable.month)),
    db.select({ overallScore: healthScoresTable.overallScore }).from(healthScoresTable)
      .where(eq(healthScoresTable.userId, userId)).orderBy(desc(healthScoresTable.scoreDate)).limit(1),
    db.select({ onboardingStage: clientProfilesTable.onboardingStage }).from(clientProfilesTable)
      .where(eq(clientProfilesTable.userId, userId)),
    computeNetWorth(userId, { currency: "USD" }),
  ]);
  const summaries = await Promise.all(goals.map((goal) => computeGoalFundingSummary(userId, goal)));
  return {
    goalsCount: goals.length,
    onboardingComplete: clientProfile?.onboardingStage === "complete",
    streakWeeks,
    netWorth: netWorth.netWorth,
    effectiveSavingsRate: parseFloat(budgetMonths[0]?.savingsRatePct ?? "0") || 0,
    goalOnTrack: summaries.some((s) => s.pacing === "on_track"),
    healthScore: score?.overallScore ?? 0,
    budgetMonthsCount: budgetMonths.length,
  };
}

/**
 * Records the day's check-in once, updating the streak and milestones, then re-evaluates
 * checkpoints, which is how a streak or an elapsed 90 days reaches C6. Staff have no
 * engagement. Never fails the request it runs in.
 */
export async function dailyCheckin(userId: string, now: Date = new Date()): Promise<void> {
  try {
    const [profile] = await db.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, userId));
    if (profile?.role !== "free_user" && profile?.role !== "investment_client") return;

    const today = now.toISOString().slice(0, 10);
    const streakWeeks = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`engagement:${userId}`}))`);
      const [row] = await tx.select().from(userEngagementTable).where(eq(userEngagementTable.userId, userId));
      if (row?.lastCheckinAt?.toISOString().slice(0, 10) === today) return null;
      const weeks = nextStreak(row?.streakWeeks ?? 0, row?.lastCheckinAt ?? null, now);
      await tx.insert(userEngagementTable)
        .values({ userId, streakWeeks: weeks, lastCheckinAt: now, lastTipWeek: weekStart(now).toISOString().slice(0, 10) })
        .onConflictDoUpdate({
          target: userEngagementTable.userId,
          set: { streakWeeks: weeks, lastCheckinAt: now, lastTipWeek: weekStart(now).toISOString().slice(0, 10) },
        });
      return weeks;
    });
    if (streakWeeks === null) return;

    const [row] = await db.select({ milestones: userEngagementTable.milestones }).from(userEngagementTable)
      .where(eq(userEngagementTable.userId, userId));
    const milestones = awardMilestones(row?.milestones ?? [], await loadFacts(userId, streakWeeks));
    await db.update(userEngagementTable).set({ milestones }).where(eq(userEngagementTable.userId, userId));
    await runCheckpointHook(userId);
  } catch (err) {
    logger.error({ err, userId }, "Daily check-in failed");
  }
}

export async function getEngagement(userId: string) {
  const [row] = await db.select().from(userEngagementTable).where(eq(userEngagementTable.userId, userId));
  return {
    streakWeeks: row?.streakWeeks ?? 0,
    lastCheckinAt: row?.lastCheckinAt ?? null,
    milestones: row?.milestones ?? [],
    lastTipWeek: row?.lastTipWeek ?? null,
  };
}
