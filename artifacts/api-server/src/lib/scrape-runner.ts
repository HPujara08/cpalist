import { eq, sql } from "drizzle-orm";
import { db, firmsTable, jobsTable } from "@workspace/db";
import { scrapeByAts, detectAts, discoverWorkdayBoardFromPage, type AtsType } from "./ats-scrapers";
import { logger } from "./logger";

let scrapeInProgress = false;

export type FirmScrapeResult = {
  firmId: number;
  firmName: string;
  atsType: string;
  jobsFound: number;
  jobsNew: number;
  success: boolean;
  error: string | null;
};

export type FullScrapeResult = {
  startedAt: string;
  firmsProcessed: number;
  jobsFound: number;
  jobsNew: number;
  errors: string[];
};

export async function scrapeOneFirm(
  firm: typeof firmsTable.$inferSelect,
  { skipDetection = false }: { skipDetection?: boolean } = {},
): Promise<FirmScrapeResult> {
  try {
    let atsType = firm.atsType as AtsType;
    let atsUrl = firm.atsUrl;

    if ((atsType === "unknown" || atsType === "custom") && firm.careersUrl && !skipDetection) {
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

    // Skip firms we still can't classify — no point scraping unknown/custom in batch mode
    if (skipDetection && (atsType === "unknown" || atsType === "custom")) {
      return { firmId: firm.id, firmName: firm.name, atsType, jobsFound: 0, jobsNew: 0, success: true, error: null };
    }

    // For Workday firms with a bare base URL (no board path), try to discover
    // the board by fetching the firm's careers page. This self-heals firms
    // whose ATS detection stored only the subdomain. Once found, the full URL
    // is saved so future scrapes use it directly without re-discovery.
    if (atsType === "workday" && atsUrl && firm.careersUrl) {
      const parsedWd = new URL(atsUrl);
      const hasBoardPath = parsedWd.pathname.split("/").filter(Boolean).length > 0;
      if (!hasBoardPath) {
        const discovered = await discoverWorkdayBoardFromPage(firm.careersUrl, parsedWd.hostname);
        if (discovered) {
          atsUrl = discovered;
          await db.update(firmsTable).set({ atsUrl: discovered }).where(eq(firmsTable.id, firm.id));
          logger.info({ firmId: firm.id, firmName: firm.name, atsUrl: discovered }, "Workday: discovered board from careers page");
        }
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

    return { firmId: firm.id, firmName: firm.name, atsType, jobsFound: jobs.length, jobsNew, success: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { firmId: firm.id, firmName: firm.name, atsType: firm.atsType, jobsFound: 0, jobsNew: 0, success: false, error: message };
  }
}

/**
 * Scrape the next N firms with the oldest last_checked timestamps
 * (NULL = never scraped, sorted first). Running this hourly with batchSize=21
 * covers all firms every ~24 hours in a rolling fashion.
 *
 * Playwright ATS detection is intentionally skipped here — it crashes the
 * production server due to missing graphics drivers. Unknown/custom firms
 * are skipped silently; use the per-firm "Scrape Now" button (which calls
 * scrapeOneFirm without skipDetection) to detect their ATS type manually.
 */
export async function scrapeNextBatch(batchSize = 21): Promise<FullScrapeResult & { skipped?: boolean }> {
  if (scrapeInProgress) {
    logger.warn("Batch scrape requested but one is already in progress — skipping");
    return { startedAt: new Date().toISOString(), firmsProcessed: 0, jobsFound: 0, jobsNew: 0, errors: [], skipped: true };
  }

  scrapeInProgress = true;
  const startedAt = new Date();

  try {
    // Only pick firms with a known ATS type to avoid Playwright detection in prod
    const firms = await db
      .select()
      .from(firmsTable)
      .orderBy(sql`COALESCE(${firmsTable.lastChecked}, '1970-01-01'::timestamptz) ASC`)
      .limit(batchSize);

    logger.info({ batchSize: firms.length }, "Starting batch scrape");

    let firmsProcessed = 0;
    let jobsFound = 0;
    let jobsNew = 0;
    const errors: string[] = [];

    for (const firm of firms) {
      const result = await scrapeOneFirm(firm, { skipDetection: true });
      firmsProcessed++;
      jobsFound += result.jobsFound;
      jobsNew += result.jobsNew;
      if (!result.success && result.error) {
        errors.push(`${firm.name}: ${result.error}`);
      }
    }

    logger.info({ firmsProcessed, jobsFound, jobsNew }, "Batch scrape complete");
    return { startedAt: startedAt.toISOString(), firmsProcessed, jobsFound, jobsNew, errors };
  } finally {
    scrapeInProgress = false;
  }
}

export async function runFullScrape(): Promise<FullScrapeResult> {
  const startedAt = new Date();
  logger.info("Starting full scrape run");

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

  logger.info({ firmsProcessed, jobsFound, jobsNew }, "Scrape run complete");
  return { startedAt: startedAt.toISOString(), firmsProcessed, jobsFound, jobsNew, errors };
}
