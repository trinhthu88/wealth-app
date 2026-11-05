import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// The database closes idle connections now and then (a restart, a scale-down). The pool drops the
// closed one and opens a new one on the next query; without a listener the error ends the process.
pool.on("error", (err) => {
  console.error(`Database connection closed by the server; it will be replaced: ${err.message}`);
});
export const db = drizzle(pool, { schema });

export * from "./schema";
