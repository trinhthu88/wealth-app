import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

// Streak, milestones and the weekly tip as server facts. The browser keeps only a cache.
export const userEngagementTable = pgTable("user_engagement", {
  userId: text("user_id").primaryKey().references(() => profilesTable.id, { onDelete: "cascade" }),
  streakWeeks: integer("streak_weeks").notNull().default(0),
  lastCheckinAt: timestamp("last_checkin_at", { withTimezone: true }),
  milestones: jsonb("milestones").$type<string[]>().notNull().default([]),
  // The Monday (YYYY-MM-DD, UTC) of the week the user last got a tip.
  lastTipWeek: text("last_tip_week"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserEngagementSchema = createInsertSchema(userEngagementTable);
export type InsertUserEngagement = z.infer<typeof insertUserEngagementSchema>;
export type UserEngagement = typeof userEngagementTable.$inferSelect;
