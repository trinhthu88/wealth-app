import {
  pgTable, text, numeric, timestamp, uuid, boolean, jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { financialGoalsTable } from "./goals";

export const scenarioRunsTable = pgTable("scenario_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),

  scenarioName: text("scenario_name"),
  scenarioType: text("scenario_type").notNull(),

  sourceType: text("source_type"),
  sourceId: uuid("source_id"),
  linkedGoalId: uuid("linked_goal_id").references(() => financialGoalsTable.id),

  parameters: jsonb("parameters").notNull().default({}),
  projectionData: jsonb("projection_data").notNull().default([]),

  baselineFinalValue: numeric("baseline_final_value"),
  scenarioFinalValue: numeric("scenario_final_value"),
  deltaValue: numeric("delta_value"),
  deltaPct: numeric("delta_pct"),

  isSaved: boolean("is_saved").notNull().default(false),
  isAdvisorPushed: boolean("is_advisor_pushed").notNull().default(false),
  alertStatus: text("status").notNull().default("new"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScenarioRunSchema = createInsertSchema(scenarioRunsTable).omit({ id: true, createdAt: true });

export type ScenarioRun = typeof scenarioRunsTable.$inferSelect;
export type InsertScenarioRun = z.infer<typeof insertScenarioRunSchema>;
