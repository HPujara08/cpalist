import cron from "node-cron";
import { sendDigestFromDb } from "./daily-job";
import { scrapeNextBatch } from "./scrape-runner";
import { logger } from "./logger";

export function startCronJobs(): void {
  // Every hour at :00 — scrape the 21 firms with the oldest last_checked.
  // 21 firms × 24 runs = 504 firms covered per day, rotating through all 500.
  cron.schedule("0 * * * *", async () => {
    logger.info("Cron: hourly batch scrape starting");
    try {
      const result = await scrapeNextBatch(21);
      logger.info({ firmsProcessed: result.firmsProcessed, jobsNew: result.jobsNew }, "Cron: batch scrape complete");
    } catch (err) {
      logger.error({ err }, "Cron: batch scrape failed");
    }
  });

  // Daily at 05:00 UTC = midnight EST — send the CPAList digest email.
  // Shows all postings discovered in the past 24 hours.
  cron.schedule("0 5 * * *", async () => {
    logger.info("Cron: midnight EST digest triggered");
    try {
      const result = await sendDigestFromDb();
      logger.info({ emailSent: result.emailSent, emailError: result.emailError }, "Cron: digest complete");
    } catch (err) {
      logger.error({ err }, "Cron: digest send failed");
    }
  });

  logger.info("Cron jobs registered: hourly batch scrape + daily digest at midnight EST (05:00 UTC)");
}
