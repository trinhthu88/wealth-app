import { pgTable, text, numeric, timestamp, uuid, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const financialGoalsTable = pgTable("financial_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  goalType: text("goal_type").notNull(),
  targetAmount: numeric("target_amount"),
  currentAmount: numeric("current_amount").notNull().default("0"),
  monthlyContribution: numeric("monthly_contribution").notNull().default("0"),
  targetDate: date("target_date"),
  currency: text("currency").notNull().default("USD"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("on_track"),
  notes: text("notes"),
  isAdvisorManaged: boolean("is_advisor_managed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFinancialGoalSchema = createInsertSchema(financialGoalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinancialGoal = z.infer<typeof insertFinancialGoalSchema>;
export type FinancialGoal = typeof financialGoalsTable.$inferSelect;
