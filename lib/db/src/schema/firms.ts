import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const firmsTable = pgTable("firms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  rank: integer("rank").notNull(),
  hqCity: text("hq_city").notNull(),
  hqState: text("hq_state").notNull(),
  websiteUrl: text("website_url").notNull(),
  careersUrl: text("careers_url").notNull(),
  atsType: text("ats_type").notNull().default("unknown"),
  atsUrl: text("ats_url"),
  lastChecked: timestamp("last_checked", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFirmSchema = createInsertSchema(firmsTable).omit({
  id: true,
  createdAt: true,
  lastChecked: true,
});

export type InsertFirm = z.infer<typeof insertFirmSchema>;
export type Firm = typeof firmsTable.$inferSelect;
