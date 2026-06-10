import { Router, type IRouter } from "express";
import { sendDigestFromDb, runDailyJob } from "../lib/daily-job";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/cron/daily", async (req, res): Promise<void> => {
  const secret = process.env["CRON_SECRET"];
  if (secret) {
    const provided = req.headers["x-cron-secret"];
    if (provided !== secret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  req.log.info("Send digest triggered: emailing current DB data immediately");

  // Send email from current DB data right away — fast (no scrape wait)
  const result = await sendDigestFromDb();
  res.json(result);

  // Kick off a background scrape so data is fresh for tomorrow
  runDailyJob()
    .then((r) => logger.info({ firmsProcessed: r.firmsProcessed, jobsNew: r.jobsNew }, "Background scrape complete"))
    .catch((err) => logger.error({ err }, "Background scrape failed"));
});

export default router;
