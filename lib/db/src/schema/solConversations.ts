import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const solConversationsTable = pgTable("sol_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const solMessagesTable = pgTable("sol_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull(),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  // Records which tool calls backed this reply, for auditing Sol's answers
  // against the "never invent a number" rule.
  toolCalls: jsonb("tool_calls"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSolConversationSchema = createInsertSchema(solConversationsTable).omit({ id: true, createdAt: true });
export const insertSolMessageSchema = createInsertSchema(solMessagesTable).omit({ id: true, sentAt: true });

export type InsertSolConversation = z.infer<typeof insertSolConversationSchema>;
export type SolConversation = typeof solConversationsTable.$inferSelect;
export type InsertSolMessage = z.infer<typeof insertSolMessageSchema>;
export type SolMessage = typeof solMessagesTable.$inferSelect;
