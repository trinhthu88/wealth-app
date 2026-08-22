import { pgTable, text, timestamp, uuid, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { financialGoalsTable } from "./goals";

export const advisorTasksTable = pgTable("advisor_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: text("client_id"),
  advisorId: text("advisor_id"),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: date("due_date"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("todo"),
  // Set only for auto-generated tasks (e.g. Sol's off-track nudge, see
  // api-server/src/lib/offTrackTasks.ts) — lets that job dedupe against an
  // already-open task for the same goal instead of spamming a new one on
  // every view. Both null for a task an advisor created by hand.
  goalId: uuid("goal_id").references(() => financialGoalsTable.id, { onDelete: "cascade" }),
  autoReason: text("auto_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAdvisorTaskSchema = createInsertSchema(advisorTasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAdvisorTask = z.infer<typeof insertAdvisorTaskSchema>;
export type AdvisorTask = typeof advisorTasksTable.$inferSelect;
