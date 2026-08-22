import { and, eq, ne } from "drizzle-orm";
import { db, financialGoalsTable, clientProfilesTable, advisorTasksTable } from "@workspace/db";
import { computeGoalProgress, type GoalStatus } from "@workspace/goal-math";
import { computeCurrentBreakdown } from "./goalProgressSnapshot";

// Only Sol's off-track nudge sets this — lets ensureOffTrackTask dedupe against
// an already-open task for the same goal instead of creating one on every view.
export const OFF_TRACK_AUTO_REASON = "goal_off_track";

export interface EnsureOffTrackTaskResult {
  created: boolean;
  status: GoalStatus;
}

/**
 * Re-derives the goal's pacing status server-side (never trusts the client's
 * own trackStatus). Called on every view of an active goal, not just
 * off-track ones, so it can do both sides of the job:
 *
 * - off_track and no open task yet → opens exactly one.
 * - off_track and one's already open → no-op (that's the anti-spam dedup).
 * - not off_track and an open auto-task is still sitting there → closes it.
 *   Without this, a task an advisor never resolved would silently keep
 *   blocking a *new* one the next time the goal relapses — a stale task from
 *   one episode is not evidence anyone's aware of a later one.
 */
export async function ensureOffTrackTask(userId: string, goalId: string): Promise<EnsureOffTrackTaskResult> {
  const [goal] = await db.select().from(financialGoalsTable)
    .where(and(eq(financialGoalsTable.id, goalId), eq(financialGoalsTable.userId, userId)));
  if (!goal) return { created: false, status: "no_target" };

  const { computedCurrentAmount } = await computeCurrentBreakdown(userId, goalId);
  const progress = computeGoalProgress({
    currentAmount: computedCurrentAmount,
    targetAmount: goal.targetAmount ? parseFloat(goal.targetAmount) : null,
    targetDate: goal.targetDate,
    createdAt: goal.createdAt.toISOString(),
  });

  const [existingOpenTask] = await db.select({ id: advisorTasksTable.id }).from(advisorTasksTable)
    .where(and(
      eq(advisorTasksTable.goalId, goalId),
      eq(advisorTasksTable.autoReason, OFF_TRACK_AUTO_REASON),
      ne(advisorTasksTable.status, "done"),
    ));

  if (progress.status !== "off_track") {
    if (existingOpenTask) {
      await db.update(advisorTasksTable).set({ status: "done" }).where(eq(advisorTasksTable.id, existingOpenTask.id));
    }
    return { created: false, status: progress.status };
  }

  if (existingOpenTask) return { created: false, status: "off_track" };

  const [cp] = await db.select({ advisorId: clientProfilesTable.advisorId }).from(clientProfilesTable)
    .where(eq(clientProfilesTable.userId, userId));
  if (!cp?.advisorId) return { created: false, status: "off_track" };

  await db.insert(advisorTasksTable).values({
    advisorId: cp.advisorId,
    clientId: userId,
    goalId,
    autoReason: OFF_TRACK_AUTO_REASON,
    title: `Review "${goal.title}" — off track`,
    description: `This goal fell behind its target pace. Sol already nudged the client toward running a scenario to see what closing the gap would take.`,
    priority: "medium",
    status: "todo",
  });

  return { created: true, status: "off_track" };
}
