import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { firmsTable } from "./firms";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  firmId: integer("firm_id")
    .notNull()
    .references(() => firmsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  location: text("location"),
  applyUrl: text("apply_url"),
  term: text("term"),
  atsSource: text("ats_source").notNull().default("unknown"),
  isActive: boolean("is_active").notNull().default(true),
  contentHash: text("content_hash").notNull(),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  firstSeen: true,
  lastSeen: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
