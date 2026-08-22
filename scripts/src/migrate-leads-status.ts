import { eq } from "drizzle-orm";
import { db, leadsTable } from "@workspace/db";

// One-off (and re-runnable) remap for the lead-pipeline redesign's new status
// meaning: unassigned (default) → active → cold | churned | client. Pre-redesign
// values mapped as follows, per the redesign brief:
//   new / contacted / qualified  → unassigned (assignedAdvisorId null)
//                                 → active     (assignedAdvisorId already set)
//   lost                         → churned
//   converted                    → client
// Anything already a valid new-scheme value is left untouched. Anything else
// unrecognized is logged and skipped rather than guessed at.

const NEW_STATUSES = new Set(["unassigned", "active", "cold", "churned", "client"]);
const LEGACY_ELASTIC = new Set(["new", "contacted", "qualified"]); // → unassigned or active, by assignment

function remapStatus(status: string, hasAdvisor: boolean): string | null {
  if (NEW_STATUSES.has(status)) return null; // already fine, nothing to do
  if (LEGACY_ELASTIC.has(status)) return hasAdvisor ? "active" : "unassigned";
  if (status === "lost") return "churned";
  if (status === "converted") return "client";
  return "UNRECOGNIZED";
}

async function run() {
  console.log("\nRemapping leads.status to the new pipeline's meaning...\n");

  const leads = await db.select().from(leadsTable);
  let migrated = 0;
  let unrecognized = 0;

  for (const lead of leads) {
    const next = remapStatus(lead.status, !!lead.assignedAdvisorId);
    if (next === null) continue;

    if (next === "UNRECOGNIZED") {
      unrecognized++;
      console.log(`  ⚠ ${lead.id} (${lead.email}) — unrecognized status "${lead.status}", left as-is. Needs manual review.`);
      continue;
    }

    await db.update(leadsTable).set({ status: next }).where(eq(leadsTable.id, lead.id));
    console.log(`  ✓ ${lead.id} (${lead.email}) — "${lead.status}" → "${next}"${lead.assignedAdvisorId ? ` (advisor ${lead.assignedAdvisorId})` : ""}`);
    migrated++;
  }

  console.log(`\nDone. ${migrated} row(s) remapped, ${unrecognized} unrecognized (left untouched), ${leads.length - migrated - unrecognized} already in the new scheme.\n`);
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
