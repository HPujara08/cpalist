import { eq } from "drizzle-orm";
import { db, firmsTable, jobsTable } from "@workspace/db";
import { scrapeByAts, detectAts, type AtsType } from "./ats-scrapers";
import { logger } from "./logger";

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

export async function scrapeOneFirm(firm: typeof firmsTable.$inferSelect): Promise<FirmScrapeResult> {
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

    return { firmId: firm.id, firmName: firm.name, atsType, jobsFound: jobs.length, jobsNew, success: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { firmId: firm.id, firmName: firm.name, atsType: firm.atsType, jobsFound: 0, jobsNew: 0, success: false, error: message };
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
