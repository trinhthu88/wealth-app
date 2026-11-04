import { eq } from "drizzle-orm";
import { db, userEngagementTable } from "@workspace/db";

/** The user's streak in weeks, or null before their first check-in. */
export async function loadEngagementStreak(userId: string): Promise<number | null> {
  const [row] = await db.select({ streakWeeks: userEngagementTable.streakWeeks })
    .from(userEngagementTable).where(eq(userEngagementTable.userId, userId));
  return row?.streakWeeks ?? null;
}
