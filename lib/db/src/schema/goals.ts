import { pgTable, text, numeric, timestamp, uuid, date, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

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

export const goalHoldingLinksTable = pgTable("goal_holding_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").notNull().references(() => financialGoalsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(), // 'advised_plan' | 'self_holding'
  sourceId: uuid("source_id").notNull(),
  allocationPct: numeric("allocation_pct").notNull().default("100"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("goal_holding_links_unique").on(t.goalId, t.sourceType, t.sourceId),
]);

export const insertFinancialGoalSchema = createInsertSchema(financialGoalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinancialGoal = z.infer<typeof insertFinancialGoalSchema>;
export type FinancialGoal = typeof financialGoalsTable.$inferSelect;
export type GoalHoldingLink = typeof goalHoldingLinksTable.$inferSelect;
