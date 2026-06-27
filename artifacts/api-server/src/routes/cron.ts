import { Router, type IRouter } from "express";
import { sendDigestFromDb } from "../lib/daily-job";
import { scrapeNextBatch } from "../lib/scrape-runner";
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

  // Send email from current DB data — one email, no re-send after scrape
  const result = await sendDigestFromDb();
  res.json(result);

  // Kick off a background scrape so data is fresh for tomorrow (no extra email)
  scrapeNextBatch(21)
    .then((r) => logger.info({ firmsProcessed: r.firmsProcessed, jobsNew: r.jobsNew }, "Post-digest scrape complete"))
    .catch((err) => logger.error({ err }, "Post-digest scrape failed"));
});

export default router;
