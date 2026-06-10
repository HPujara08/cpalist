import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, firmsTable } from "@workspace/db";
import { ScrapeFirmParams } from "@workspace/api-zod";
import { detectAts, type AtsType } from "../lib/ats-scrapers";
import { scrapeOneFirm, runFullScrape, scrapeNextBatch } from "../lib/scrape-runner";
import { logger } from "../lib/logger";

async function runConcurrent<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

const router: IRouter = Router();

router.post("/scrape/detect-ats", async (req, res): Promise<void> => {
  const rawLimit = parseInt(String(req.query.limit ?? "20"), 10);
  const limit = Math.min(isNaN(rawLimit) ? 20 : rawLimit, 50);

  const unknownFirms = await db
    .select()
    .from(firmsTable)
    .where(eq(firmsTable.atsType, "unknown"))
    .orderBy(firmsTable.rank)
    .limit(limit);

  req.log.info({ count: unknownFirms.length }, "Starting batch ATS detection");

  type DetectResult = { firmId: number; firmName: string; atsType: string; atsUrl: string | null; success: boolean };
  const results: DetectResult[] = [];

  await runConcurrent(
    unknownFirms,
    async (firm) => {
      try {
        const detected = await detectAts(firm.careersUrl);
        const resolved = detected.atsType !== "unknown" && detected.atsType !== "custom";
        if (resolved) {
          await db
            .update(firmsTable)
            .set({ atsType: detected.atsType, atsUrl: detected.atsUrl })
            .where(eq(firmsTable.id, firm.id));
        }
        results.push({ firmId: firm.id, firmName: firm.name, atsType: detected.atsType, atsUrl: detected.atsUrl, success: resolved });
      } catch {
        results.push({ firmId: firm.id, firmName: firm.name, atsType: "unknown", atsUrl: null, success: false });
      }
    },
    3,
  );

  const [{ remaining }] = await db
    .select({ remaining: sql<number>`count(*)` })
    .from(firmsTable)
    .where(eq(firmsTable.atsType, "unknown"));

  const detected = results.filter((r) => r.success).length;
  req.log.info({ processed: results.length, detected }, "Batch ATS detection complete");

  res.json({
    processed: results.length,
    detected,
    unknownRemaining: Number(remaining),
    results,
  });
});

// Batch scrape: picks the 21 oldest-scraped firms, fire-and-forget.
// Called by GitHub Actions every hour to keep all 500 firms fresh.
router.post("/scrape/batch", async (req, res): Promise<void> => {
  res.status(202).json({ queued: true, message: "Batch scrape started in background" });
  scrapeNextBatch(21)
    .then((r) => logger.info({ firmsProcessed: r.firmsProcessed, jobsNew: r.jobsNew }, "Scheduled batch scrape complete"))
    .catch((err) => logger.error({ err }, "Scheduled batch scrape failed"));
});

router.post("/scrape/run", async (req, res): Promise<void> => {
  req.log.info("Full scrape triggered via API");
  const result = await runFullScrape();
  res.json(result);
});

router.post("/scrape/firms/:id", async (req, res): Promise<void> => {
  const params = ScrapeFirmParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [firm] = await db
    .select()
    .from(firmsTable)
    .where(eq(firmsTable.id, params.data.id));

  if (!firm) {
    res.status(404).json({ error: "Firm not found" });
    return;
  }

  req.log.info({ firmId: firm.id, atsType: firm.atsType }, "Scraping firm");
  const result = await scrapeOneFirm(firm);
  res.json(result);
});

export default router;
