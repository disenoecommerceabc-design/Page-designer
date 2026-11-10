import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const interests = sqliteTable("interests", {
 email: text("email").primaryKey(),
 name: text("name").notNull(),
 plan: text("plan").notNull(),
 createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
 consentVersion: text("consent_version").notNull().default("launch-v1")
});

export const builderProjects = sqliteTable("builder_projects", {
 id: text("id").primaryKey(), owner: text("owner").notNull(), document: text("document").notNull(),
 revision: integer("revision").notNull(), updated: integer("updated").notNull()
});
export const builderSessions = sqliteTable("builder_sessions", {
 tokenHash: text("token_hash").primaryKey(), owner: text("owner").notNull(), expires: integer("expires").notNull()
});
export const builderAssets = sqliteTable("builder_assets", {
 filename: text("filename").primaryKey(), owner: text("owner").notNull(), mime: text("mime").notNull(),
 name: text("name").notNull()
});

export const builderAiOperations = sqliteTable("builder_ai_operations", {
 id: text("id").primaryKey(),
 owner: text("owner").notNull(),
 project: text("project").notNull(),
 kind: text("kind").notNull(),
 fingerprint: text("fingerprint").notNull(),
 cost: integer("cost").notNull(),
 day: text("day").notNull(),
 created: integer("created").notNull(),
 status: text("status").notNull(),
 providerId: text("provider_id"),
 result: text("result").notNull().default("{}"),
 pollUntil: integer("poll_until").notNull().default(0),
 inputTokens: integer("input_tokens").notNull().default(0),
 outputTokens: integer("output_tokens").notNull().default(0),
 providerCredits: text("provider_credits").notNull().default("0")
});
