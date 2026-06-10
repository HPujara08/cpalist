import { Router, type IRouter } from "express";
import healthRouter from "./health";
import firmsRouter from "./firms";
import jobsRouter from "./jobs";
import scrapeRouter from "./scrape";
import statsRouter from "./stats";
import cronRouter from "./cron";

const router: IRouter = Router();

router.use(healthRouter);
router.use(firmsRouter);
router.use(jobsRouter);
router.use(scrapeRouter);
router.use(statsRouter);
router.use(cronRouter);

export default router;
