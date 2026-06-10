import { and, eq, gte, lt } from "drizzle-orm";
import { db, firmsTable, jobsTable } from "@workspace/db";
import { runFullScrape, type FullScrapeResult } from "./scrape-runner";
import { sendDailyDigest, type DigestJob } from "./email";
import { logger } from "./logger";

export type DailyJobResult = {
  firmsProcessed: number;
  jobsFound: number;
  jobsNew: number;
  emailSent: boolean;
  emailError: string | null;
};

const baseSelect = {
  title: jobsTable.title,
  location: jobsTable.location,
  applyUrl: jobsTable.applyUrl,
  term: jobsTable.term,
  firmName: firmsTable.name,
  firmRank: firmsTable.rank,
  firstSeen: jobsTable.firstSeen,
};

const toDigestJob = (row: {
  title: string;
  location: string | null;
  applyUrl: string | null;
  term: string | null;
  firmName: string;
  firstSeen: Date;
}): DigestJob => ({
  firmName: row.firmName,
  title: row.title,
  location: row.location,
  applyUrl: row.applyUrl,
  term: row.term,
  firstSeen: row.firstSeen,
});

async function buildAndSendDigest(): Promise<{ emailSent: boolean; emailError: string | null }> {
  // Window: last 24 hours (so midnight EST email captures the full previous day)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const newTodayRows = await db
    .select(baseSelect)
    .from(jobsTable)
    .innerJoin(firmsTable, eq(jobsTable.firmId, firmsTable.id))
    .where(and(eq(jobsTable.isActive, true), gte(jobsTable.firstSeen, cutoff)))
    .orderBy(firmsTable.rank);

  const stillOpenRows = await db
    .select(baseSelect)
    .from(jobsTable)
    .innerJoin(firmsTable, eq(jobsTable.firmId, firmsTable.id))
    .where(and(eq(jobsTable.isActive, true), lt(jobsTable.firstSeen, cutoff)))
    .orderBy(firmsTable.rank);

  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const totalActive = newTodayRows.length + stillOpenRows.length;

  const emailResult = await sendDailyDigest({
    date,
    newToday: newTodayRows.map(toDigestJob),
    stillOpen: stillOpenRows.map(toDigestJob),
    totalActive,
  });

  return { emailSent: emailResult.success, emailError: emailResult.error ?? null };
}

/**
 * Send the CPAList digest using current DB data — no scraping.
 * Fast (seconds). Used by the manual "Send Digest Now" button.
 */
export async function sendDigestFromDb(): Promise<DailyJobResult> {
  logger.info("Sending CPAList digest from current DB data");
  const { emailSent, emailError } = await buildAndSendDigest();
  return { firmsProcessed: 0, jobsFound: 0, jobsNew: 0, emailSent, emailError };
}

/**
 * Full daily job: scrape first, then send digest with fresh data.
 * Used for one-off manual full refreshes.
 */
export async function runDailyJob(): Promise<DailyJobResult> {
  logger.info("Daily job starting: scrape + digest");
  const scraped: FullScrapeResult = await runFullScrape();
  const { emailSent, emailError } = await buildAndSendDigest();
  logger.info({ emailSent, emailError }, "Daily job complete");
  return {
    firmsProcessed: scraped.firmsProcessed,
    jobsFound: scraped.jobsFound,
    jobsNew: scraped.jobsNew,
    emailSent,
    emailError,
  };
}
