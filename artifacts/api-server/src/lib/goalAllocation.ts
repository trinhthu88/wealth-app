import { and, eq, ne } from "drizzle-orm";
import { db, goalHoldingLinksTable } from "@workspace/db";

/**
 * Sums allocationPct across every goal a holding is linked to, excluding one
 * goal (the one currently being edited, so re-checking its own existing link
 * doesn't count against itself).
 */
export async function getAllocatedPct(
  userId: string,
  sourceType: string,
  sourceId: string,
  excludeGoalId?: string,
): Promise<number> {
  const rows = await db.select({ allocationPct: goalHoldingLinksTable.allocationPct })
    .from(goalHoldingLinksTable)
    .where(and(
      eq(goalHoldingLinksTable.userId, userId),
      eq(goalHoldingLinksTable.sourceType, sourceType),
      eq(goalHoldingLinksTable.sourceId, sourceId),
      ...(excludeGoalId ? [ne(goalHoldingLinksTable.goalId, excludeGoalId)] : []),
    ));

  return rows.reduce((sum, r) => sum + (parseFloat(r.allocationPct) || 0), 0);
}

export async function getRemainingPct(
  userId: string,
  sourceType: string,
  sourceId: string,
  excludeGoalId?: string,
): Promise<number> {
  const allocated = await getAllocatedPct(userId, sourceType, sourceId, excludeGoalId);
  return Math.max(0, 100 - allocated);
}
