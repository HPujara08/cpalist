import { Router, type IRouter } from "express";
import healthRouter from "./health";
import firmsRouter from "./firms";
import jobsRouter from "./jobs";
import scrapeRouter from "./scrape";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(firmsRouter);
router.use(jobsRouter);
router.use(scrapeRouter);
router.use(statsRouter);

export default router;
