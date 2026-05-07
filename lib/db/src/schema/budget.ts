import { pgTable, text, numeric, timestamp, uuid, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const budgetEntriesTable = pgTable("budget_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  periodMonth: date("period_month").notNull(),
  currency: text("currency").notNull().default("USD"),
  income: numeric("income"),
  needsActual: numeric("needs_actual"),
  wantsActual: numeric("wants_actual"),
  savingsActual: numeric("savings_actual"),
  savingsRatePercent: numeric("savings_rate_percent"),
  housing: numeric("housing"),
  food: numeric("food"),
  transport: numeric("transport"),
  utilities: numeric("utilities"),
  entertainment: numeric("entertainment"),
  other: numeric("other"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBudgetEntrySchema = createInsertSchema(budgetEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBudgetEntry = z.infer<typeof insertBudgetEntrySchema>;
export type BudgetEntry = typeof budgetEntriesTable.$inferSelect;
