import { pgTable, text, integer, numeric, timestamp, uuid, date, boolean } from "drizzle-orm/pg-core";
// NOTE: milestone_comments table requires SQL migration (see Prompt 8 Step 1)
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientProfilesTable = pgTable("client_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  advisorId: text("advisor_id"),
  status: text("status").notNull().default("prospect"),
  kycStatus: text("kyc_status").notNull().default("not_started"),
  riskProfile: text("risk_profile"),
  riskScore: integer("risk_score"),
  investmentStyle: text("investment_style"),
  indicativeAmount: numeric("indicative_amount"),
  preCallNotes: text("pre_call_notes"),
  preferredContactTime: text("preferred_contact_time"),
  onboardingStep: integer("onboarding_step").notNull().default(1),
  prospectOnboardingComplete: boolean("prospect_onboarding_complete").notNull().default(false),
  fullOnboardingComplete: boolean("full_onboarding_complete").notNull().default(false),
  relationshipStartDate: date("relationship_start_date"),
  annualReviewDate: date("annual_review_date"),
  internalNotes: text("internal_notes"),
  advisorInternalNotes: text("advisor_internal_notes"),
  // Track A = has an advised investment plan; Track B = self-managed only
  clientTrack: text("client_track").notNull().default("track_b"),
  preferredDisplayCurrency: text("preferred_display_currency").notNull().default("USD"),
  onboardingTrackComplete: boolean("onboarding_track_complete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const kycDocumentsTable = pgTable("kyc_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  documentType: text("document_type").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name"),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});

export const financialPlansTable = pgTable("financial_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: text("client_id").notNull(),
  advisorId: text("advisor_id"),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  planData: text("plan_data"),
  nextReviewDate: date("next_review_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const planMilestonesTable = pgTable("plan_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull(),
  title: text("title").notNull(),
  targetDate: date("target_date"),
  completedDate: date("completed_date"),
  linkedGoalId: uuid("linked_goal_id"),
  status: text("status").notNull().default("upcoming"),
  notes: text("notes"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const milestoneCommentsTable = pgTable("milestone_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  milestoneId: uuid("milestone_id").notNull(),
  userId: text("user_id").notNull(),
  authorRole: text("author_role").notNull().default("client"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClientProfileSchema = createInsertSchema(clientProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKycDocumentSchema = createInsertSchema(kycDocumentsTable).omit({ id: true, uploadedAt: true });
export const insertFinancialPlanSchema = createInsertSchema(financialPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlanMilestoneSchema = createInsertSchema(planMilestonesTable).omit({ id: true, createdAt: true });

export type InsertClientProfile = z.infer<typeof insertClientProfileSchema>;
export type ClientProfile = typeof clientProfilesTable.$inferSelect;
export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;
export type KycDocument = typeof kycDocumentsTable.$inferSelect;
export type InsertFinancialPlan = z.infer<typeof insertFinancialPlanSchema>;
export type FinancialPlan = typeof financialPlansTable.$inferSelect;
export type InsertPlanMilestone = z.infer<typeof insertPlanMilestoneSchema>;
export type PlanMilestone = typeof planMilestonesTable.$inferSelect;
export type MilestoneComment = typeof milestoneCommentsTable.$inferSelect;
