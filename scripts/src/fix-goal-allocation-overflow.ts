import { asc, eq } from "drizzle-orm";
import { db, goalHoldingLinksTable, financialGoalsTable } from "@workspace/db";

// One-off (and re-runnable) reconciliation for goal_holding_links rows created before
// the 100%-per-holding cap (POST /client/goals/:id/links) was enforced server-side.
// A holding could end up linked past 100% across goals; this brings every over-allocated
// group back down to <=100% by honoring links in the order they were created (oldest
// link keeps its allocation, later links get capped to whatever's left, and are removed
// entirely if nothing's left) — the same "first come, first served" rule the new
// validation now enforces going forward.

async function run() {
  console.log("\nScanning for holdings allocated past 100% across goals...\n");

  const allLinks = await db.select().from(goalHoldingLinksTable).orderBy(asc(goalHoldingLinksTable.createdAt));

  const groups = new Map<string, typeof allLinks>();
  for (const link of allLinks) {
    const key = `${link.userId}::${link.sourceType}::${link.sourceId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(link);
  }

  let fixedGroups = 0;

  for (const [key, links] of groups) {
    const total = links.reduce((sum, l) => sum + (parseFloat(l.allocationPct) || 0), 0);
    if (total <= 100) continue;

    fixedGroups++;
    const [userId, sourceType, sourceId] = key.split("::");
    console.log(`→ ${userId} / ${sourceType} / ${sourceId} — total ${total}% across ${links.length} link(s)`);

    let remaining = 100;
    for (const link of links) {
      const requested = parseFloat(link.allocationPct) || 0;
      const goal = await db.select({ title: financialGoalsTable.title }).from(financialGoalsTable).where(eq(financialGoalsTable.id, link.goalId));
      const goalTitle = goal[0]?.title ?? link.goalId;

      if (requested <= remaining) {
        console.log(`    keep  ${requested}% → "${goalTitle}" (unchanged)`);
        remaining -= requested;
      } else if (remaining > 0) {
        console.log(`    cap   ${requested}% → ${remaining}% for "${goalTitle}"`);
        await db.update(goalHoldingLinksTable).set({ allocationPct: String(remaining) }).where(eq(goalHoldingLinksTable.id, link.id));
        remaining = 0;
      } else {
        console.log(`    remove ${requested}% link → "${goalTitle}" (nothing left to allocate)`);
        await db.delete(goalHoldingLinksTable).where(eq(goalHoldingLinksTable.id, link.id));
      }
    }
    console.log("");
  }

  if (fixedGroups === 0) console.log("Nothing to fix — no holding is allocated past 100%.\n");
  else console.log(`✅ Reconciled ${fixedGroups} over-allocated holding(s).\n`);

  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
