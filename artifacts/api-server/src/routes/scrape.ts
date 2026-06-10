import { Router, type IRouter } from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db, firmsTable, jobsTable } from "@workspace/db";
import { ScrapeFirmParams } from "@workspace/api-zod";
import { scrapeByAts, detectAts, type AtsType } from "../lib/ats-scrapers";

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

async function scrapeOneFirm(firm: typeof firmsTable.$inferSelect): Promise<{
  firmId: number;
  firmName: string;
  atsType: string;
  jobsFound: number;
  jobsNew: number;
  success: boolean;
  error: string | null;
}> {
  try {
    let atsType = firm.atsType as AtsType;
    let atsUrl = firm.atsUrl;

    if ((atsType === "unknown" || atsType === "custom") && firm.careersUrl) {
      const detected = await detectAts(firm.careersUrl);
      atsType = detected.atsType;
      atsUrl = detected.atsUrl;

      if (detected.atsType !== "unknown" && detected.atsType !== "custom") {
        await db
          .update(firmsTable)
          .set({ atsType: detected.atsType, atsUrl: detected.atsUrl })
          .where(eq(firmsTable.id, firm.id));
      }
    }

    const jobs = await scrapeByAts(atsType, atsUrl);

    let jobsNew = 0;
    for (const job of jobs) {
      const [existing] = await db
        .select({ id: jobsTable.id })
        .from(jobsTable)
        .where(eq(jobsTable.contentHash, job.contentHash));

      if (!existing) {
        await db.insert(jobsTable).values({
          firmId: firm.id,
          title: job.title,
          location: job.location,
          applyUrl: job.applyUrl,
          term: job.term,
          atsSource: atsType,
          isActive: true,
          contentHash: job.contentHash,
        });
        jobsNew++;
      } else {
        await db
          .update(jobsTable)
          .set({ lastSeen: new Date(), isActive: true, applyUrl: job.applyUrl })
          .where(eq(jobsTable.id, existing.id));
      }
    }

    await db
      .update(firmsTable)
      .set({ lastChecked: new Date() })
      .where(eq(firmsTable.id, firm.id));

    return {
      firmId: firm.id,
      firmName: firm.name,
      atsType,
      jobsFound: jobs.length,
      jobsNew,
      success: true,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      firmId: firm.id,
      firmName: firm.name,
      atsType: firm.atsType,
      jobsFound: 0,
      jobsNew: 0,
      success: false,
      error: message,
    };
  }
}

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
  const startedAt = new Date();
  req.log.info("Starting full scrape run");

  const allFirms = await db.select().from(firmsTable).orderBy(firmsTable.rank);

  let firmsProcessed = 0;
  let jobsFound = 0;
  let jobsNew = 0;
  const errors: string[] = [];

  for (const firm of allFirms) {
    const result = await scrapeOneFirm(firm);
    firmsProcessed++;
    jobsFound += result.jobsFound;
    jobsNew += result.jobsNew;
    if (!result.success && result.error) {
      errors.push(`${firm.name}: ${result.error}`);
    }
  }

  req.log.info({ firmsProcessed, jobsFound, jobsNew }, "Scrape run complete");

  res.json({
    startedAt: startedAt.toISOString(),
    firmsProcessed,
    jobsFound,
    jobsNew,
    errors,
  });
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
