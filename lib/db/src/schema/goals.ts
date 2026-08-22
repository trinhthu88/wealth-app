import { pgTable, text, numeric, timestamp, uuid, date, boolean, unique, jsonb } from "drizzle-orm/pg-core";
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
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(), // 'advised_plan' | 'self_holding'
  sourceId: uuid("source_id").notNull(),
  allocationPct: numeric("allocation_pct").notNull().default("100"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("goal_holding_links_unique").on(t.goalId, t.sourceType, t.sourceId),
]);

// One row per goal per day it was observed — powers Sol's "why did this goal move"
// explanation (see api-server/src/lib/goalProgressSnapshot.ts). `linkBreakdown` freezes
// each active link's allocation % and underlying source value at snapshot time, so a
// later diff against the next day's snapshot can tell market movement, a new/removed
// link, and a reallocation (same link, changed %) apart — Sol only ever phrases that
// pre-computed diff, it never computes it.
export const goalProgressSnapshotsTable = pgTable("goal_progress_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").notNull().references(() => financialGoalsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  snapshotDate: date("snapshot_date").notNull(),
  computedCurrentAmount: numeric("computed_current_amount").notNull(),
  linkBreakdown: jsonb("link_breakdown").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("goal_progress_snapshots_unique").on(t.goalId, t.snapshotDate)]);

export const insertFinancialGoalSchema = createInsertSchema(financialGoalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFinancialGoal = z.infer<typeof insertFinancialGoalSchema>;
export type FinancialGoal = typeof financialGoalsTable.$inferSelect;
export type GoalHoldingLink = typeof goalHoldingLinksTable.$inferSelect;
export type GoalProgressSnapshot = typeof goalProgressSnapshotsTable.$inferSelect;
