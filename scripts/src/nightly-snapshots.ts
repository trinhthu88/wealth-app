import { computeAndSnapshotEligibleUsers } from "@workspace/net-worth";
import { pool } from "@workspace/db";

try {
  const count = await computeAndSnapshotEligibleUsers();
  console.log(`Updated today's net-worth snapshot for ${count} eligible user(s).`);
} finally {
  await pool.end();
}
