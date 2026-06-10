import cron from "node-cron";
import { runDailyJob } from "./daily-job";
import { logger } from "./logger";

export function startCronJobs(): void {
  // Daily at 07:00 UTC (adjust via CRON_SCHEDULE env var if needed)
  const schedule = process.env["CRON_SCHEDULE"] ?? "0 7 * * *";

  cron.schedule(schedule, async () => {
    logger.info({ schedule }, "Cron: daily job triggered");
    try {
      const result = await runDailyJob();
      logger.info({ result }, "Cron: daily job finished");
    } catch (err) {
      logger.error({ err }, "Cron: daily job failed");
    }
  });

  logger.info({ schedule }, "Cron jobs registered");
}
