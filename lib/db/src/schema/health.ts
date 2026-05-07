import { pgTable, text, integer, timestamp, uuid, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const healthScoresTable = pgTable("health_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  scoreDate: date("score_date").notNull(),
  overallScore: integer("overall_score"),
  budgetScore: integer("budget_score"),
  goalsScore: integer("goals_score"),
  netWorthScore: integer("net_worth_score"),
  savingsScore: integer("savings_score"),
  insights: jsonb("insights"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHealthScoreSchema = createInsertSchema(healthScoresTable).omit({ id: true, createdAt: true });
export type InsertHealthScore = z.infer<typeof insertHealthScoreSchema>;
export type HealthScore = typeof healthScoresTable.$inferSelect;
