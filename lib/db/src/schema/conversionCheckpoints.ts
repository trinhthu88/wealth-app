import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { leadsTable } from "./leads";

// The only memory of what was fired, shown, dismissed or accepted. Open means neither
// dismissed nor accepted. Codes are listed in @workspace/tier-policy (CHECKPOINT_CODES).
export const conversionCheckpointsTable = pgTable("conversion_checkpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  firedAt: timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
  // The data that triggered it, as it was then.
  snapshot: jsonb("snapshot").notNull().default({}),
  shownAt: timestamp("shown_at", { withTimezone: true }),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  leadId: uuid("lead_id").references(() => leadsTable.id, { onDelete: "set null" }),
}, (t) => [
  // DECISION: the brief's firedAt::date is not immutable on a timestamptz, so Postgres
  // rejects it in an index. The date is taken in UTC.
  uniqueIndex("conversion_checkpoints_user_code_day").on(t.userId, t.code, sql`((${t.firedAt} at time zone 'UTC')::date)`),
  // At most one open checkpoint per user, enforced by the database.
  uniqueIndex("conversion_checkpoints_one_open").on(t.userId).where(sql`${t.dismissedAt} is null and ${t.acceptedAt} is null`),
  index("conversion_checkpoints_user_idx").on(t.userId),
]);

export const insertConversionCheckpointSchema = createInsertSchema(conversionCheckpointsTable).omit({ id: true });
export type InsertConversionCheckpoint = z.infer<typeof insertConversionCheckpointSchema>;
export type ConversionCheckpoint = typeof conversionCheckpointsTable.$inferSelect;
