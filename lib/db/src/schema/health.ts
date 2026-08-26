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
  // Investment-client tier only (clientHealthScore.ts) — the free tier's 4
  // legacy columns above don't have a debt/liabilities dimension.
  debtToAssetScore: integer("debt_to_asset_score"),
  insights: jsonb("insights"),
  // Investment-client tier only: the full weighted 5-dimension breakdown
  // (savingsConsistency/investmentGrowth/goalProgress/debtToAsset/budgetSurplus
  // + weights + tier), kept separate from `insights` (the free tier's own
  // per-score metadata) so the two tiers' shapes never collide in one column.
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHealthScoreSchema = createInsertSchema(healthScoresTable).omit({ id: true, createdAt: true });
export type InsertHealthScore = z.infer<typeof insertHealthScoreSchema>;
export type HealthScore = typeof healthScoresTable.$inferSelect;
