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

export async function runDailyJob(): Promise<DailyJobResult> {
  logger.info("Daily job starting: scrape + digest");

  const scraped: FullScrapeResult = await runFullScrape();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const baseSelect = {
    title: jobsTable.title,
    location: jobsTable.location,
    applyUrl: jobsTable.applyUrl,
    term: jobsTable.term,
    firmName: firmsTable.name,
    firmRank: firmsTable.rank,
  };

  const newTodayRows = await db
    .select(baseSelect)
    .from(jobsTable)
    .innerJoin(firmsTable, eq(jobsTable.firmId, firmsTable.id))
    .where(and(eq(jobsTable.isActive, true), gte(jobsTable.firstSeen, todayStart)))
    .orderBy(firmsTable.rank);

  const stillOpenRows = await db
    .select(baseSelect)
    .from(jobsTable)
    .innerJoin(firmsTable, eq(jobsTable.firmId, firmsTable.id))
    .where(and(eq(jobsTable.isActive, true), lt(jobsTable.firstSeen, todayStart)))
    .orderBy(firmsTable.rank);

  const toDigestJob = (row: typeof newTodayRows[0]): DigestJob => ({
    firmName: row.firmName,
    title: row.title,
    location: row.location,
    applyUrl: row.applyUrl,
    term: row.term,
  });

  const date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const totalActive = newTodayRows.length + stillOpenRows.length;

  const emailResult = await sendDailyDigest({
    date,
    newToday: newTodayRows.map(toDigestJob),
    stillOpen: stillOpenRows.map(toDigestJob),
    totalActive,
  });

  logger.info({ emailSent: emailResult.success, emailError: emailResult.error ?? null }, "Daily job complete");

  return {
    firmsProcessed: scraped.firmsProcessed,
    jobsFound: scraped.jobsFound,
    jobsNew: scraped.jobsNew,
    emailSent: emailResult.success,
    emailError: emailResult.error ?? null,
  };
}
