import cron from "node-cron";
import { sendDigestFromDb } from "./daily-job";
import { scrapeNextBatch } from "./scrape-runner";
import { logger } from "./logger";

export function startCronJobs(): void {
  // Every hour at :02 — scrape the 21 firms with the oldest last_checked.
  // Offset by 2 min to avoid GitHub Actions' high-contention :00 window.
  cron.schedule("2 * * * *", async () => {
    logger.info("Cron: hourly batch scrape starting");
    try {
      const result = await scrapeNextBatch(21);
      logger.info({ firmsProcessed: result.firmsProcessed, jobsNew: result.jobsNew }, "Cron: batch scrape complete");
    } catch (err) {
      logger.error({ err }, "Cron: batch scrape failed");
    }
  }, { timezone: "UTC" });

  // Daily at 05:07 UTC = ~midnight EST — send the CPAList digest email.
  // Offset by 7 min to avoid GitHub Actions' congested :00 window.
  cron.schedule("7 5 * * *", async () => {
    logger.info("Cron: midnight EST digest triggered");
    try {
      const result = await sendDigestFromDb();
      logger.info({ emailSent: result.emailSent, emailError: result.emailError }, "Cron: digest complete");
    } catch (err) {
      logger.error({ err }, "Cron: digest send failed");
    }
  }, { timezone: "UTC" });

  logger.info("Cron jobs registered: hourly batch scrape (UTC :02) + daily digest at 05:07 UTC");
}
