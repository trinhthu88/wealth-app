import { computeAndSnapshotAllInvestmentClients } from "@workspace/net-worth";
import { pool } from "@workspace/db";

try {
  const count = await computeAndSnapshotAllInvestmentClients();
  console.log(`Updated today's net-worth snapshot for ${count} investment client(s).`);
} finally {
  await pool.end();
}
