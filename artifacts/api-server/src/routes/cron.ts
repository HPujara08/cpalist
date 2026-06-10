import { Router, type IRouter } from "express";
import { runDailyJob } from "../lib/daily-job";

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

  req.log.info("Manual daily job trigger received");
  const result = await runDailyJob();
  res.json(result);
});

export default router;
