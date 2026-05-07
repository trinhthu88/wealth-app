import { pgTable, text, integer, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pathwayProgressTable = pgTable("pathway_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  stepNumber: integer("step_number").notNull(),
  stepName: text("step_name").notNull(),
  status: text("status").notNull().default("not_started"),
  formData: jsonb("form_data"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPathwayProgressSchema = createInsertSchema(pathwayProgressTable).omit({ id: true, updatedAt: true });
export type InsertPathwayProgress = z.infer<typeof insertPathwayProgressSchema>;
export type PathwayProgress = typeof pathwayProgressTable.$inferSelect;
