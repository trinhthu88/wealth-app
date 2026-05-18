import { pgTable, text, numeric, timestamp, uuid, date, boolean } from "drizzle-orm/pg-core";
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

export const budgetTransactionsTable = pgTable("budget_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  periodMonth: text("period_month").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount").notNull(),
  type: text("type").notNull().default("expense"),
  category: text("category").notNull().default("other"),
  transactionDate: date("transaction_date").notNull(),
  isRecurring: boolean("is_recurring").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBudgetEntrySchema = createInsertSchema(budgetEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBudgetEntry = z.infer<typeof insertBudgetEntrySchema>;
export type BudgetEntry = typeof budgetEntriesTable.$inferSelect;

export const insertBudgetTransactionSchema = createInsertSchema(budgetTransactionsTable).omit({ id: true, createdAt: true });
export type InsertBudgetTransaction = z.infer<typeof insertBudgetTransactionSchema>;
export type BudgetTransaction = typeof budgetTransactionsTable.$inferSelect;
