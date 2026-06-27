import cron from "node-cron";
import { scrapeNextBatch } from "./scrape-runner";
import { logger } from "./logger";

export function startCronJobs(): void {
  // Every hour at :02 UTC — scrape the 21 firms with the oldest last_checked.
  // Offset by 2 min to avoid GitHub Actions' high-contention :00 window.
  // The daily digest is triggered separately by GitHub Actions at 05:07 UTC
  // via POST /api/cron/daily — not by this in-process cron — to prevent duplicates.
  cron.schedule("2 * * * *", async () => {
    logger.info("Cron: hourly batch scrape starting");
    try {
      const result = await scrapeNextBatch(21);
      logger.info({ firmsProcessed: result.firmsProcessed, jobsNew: result.jobsNew }, "Cron: batch scrape complete");
    } catch (err) {
      logger.error({ err }, "Cron: batch scrape failed");
    }
  }, { timezone: "UTC" });

  logger.info("Cron jobs registered: hourly batch scrape at UTC :02 (digest handled by GitHub Actions)");
}
