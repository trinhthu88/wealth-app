import { pgTable, text, timestamp, uuid, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const advisorTasksTable = pgTable("advisor_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: text("client_id"),
  advisorId: text("advisor_id"),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: date("due_date"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("todo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAdvisorTaskSchema = createInsertSchema(advisorTasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAdvisorTask = z.infer<typeof insertAdvisorTaskSchema>;
export type AdvisorTask = typeof advisorTasksTable.$inferSelect;
