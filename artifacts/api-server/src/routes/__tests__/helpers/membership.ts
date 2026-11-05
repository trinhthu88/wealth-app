import { db, membershipsTable } from "@workspace/db";

/** Fixture: makes these users paying members, as the webhook would. */
export async function grantMembership(...userIds: string[]): Promise<void> {
  await db.insert(membershipsTable)
    .values(userIds.map((userId) => ({ userId, status: "active", plan: "member_monthly", source: "stripe" })))
    .onConflictDoNothing();
}
