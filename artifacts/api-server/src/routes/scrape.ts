import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, firmsTable } from "@workspace/db";
import { ScrapeFirmParams } from "@workspace/api-zod";
import { detectAts, type AtsType } from "../lib/ats-scrapers";
import { scrapeOneFirm, runFullScrape } from "../lib/scrape-runner";

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
