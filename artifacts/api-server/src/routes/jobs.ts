import { Router, type IRouter } from "express";
import { eq, and, ilike, desc } from "drizzle-orm";
import { db, jobsTable, firmsTable } from "@workspace/db";
import { ListJobsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function formatJob(job: typeof jobsTable.$inferSelect & { firmName: string }) {
  return {
    id: job.id,
    firmId: job.firmId,
    firmName: job.firmName,
    title: job.title,
    location: job.location,
    applyUrl: job.applyUrl,
    term: job.term,
    atsSource: job.atsSource,
    isActive: job.isActive,
    firstSeen: job.firstSeen.toISOString(),
    lastSeen: job.lastSeen.toISOString(),
  };
}

router.get("/jobs", async (req, res): Promise<void> => {
  const query = ListJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];

  if (query.data.is_active !== undefined) {
    conditions.push(eq(jobsTable.isActive, query.data.is_active));
  } else {
    conditions.push(eq(jobsTable.isActive, true));
  }

  if (query.data.firm_id) {
    conditions.push(eq(jobsTable.firmId, query.data.firm_id));
  }
  if (query.data.search) {
    conditions.push(ilike(jobsTable.title, `%${query.data.search}%`));
  }
  if (query.data.term) {
    conditions.push(ilike(jobsTable.term, `%${query.data.term}%`));
  }
  if (query.data.ats_source) {
    conditions.push(eq(jobsTable.atsSource, query.data.ats_source));
  }

  const jobs = await db
    .select({
      id: jobsTable.id,
      firmId: jobsTable.firmId,
      firmName: firmsTable.name,
      title: jobsTable.title,
      location: jobsTable.location,
      applyUrl: jobsTable.applyUrl,
      term: jobsTable.term,
      atsSource: jobsTable.atsSource,
      isActive: jobsTable.isActive,
      contentHash: jobsTable.contentHash,
      firstSeen: jobsTable.firstSeen,
      lastSeen: jobsTable.lastSeen,
    })
    .from(jobsTable)
    .innerJoin(firmsTable, eq(jobsTable.firmId, firmsTable.id))
    .where(and(...conditions))
    .orderBy(desc(jobsTable.firstSeen))
    .limit(200);

  res.json(jobs.map(formatJob));
});

router.get("/jobs/digest", async (req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allActive = await db
    .select({
      id: jobsTable.id,
      firmId: jobsTable.firmId,
      firmName: firmsTable.name,
      title: jobsTable.title,
      location: jobsTable.location,
      applyUrl: jobsTable.applyUrl,
      term: jobsTable.term,
      atsSource: jobsTable.atsSource,
      isActive: jobsTable.isActive,
      contentHash: jobsTable.contentHash,
      firstSeen: jobsTable.firstSeen,
      lastSeen: jobsTable.lastSeen,
    })
    .from(jobsTable)
    .innerJoin(firmsTable, eq(jobsTable.firmId, firmsTable.id))
    .where(eq(jobsTable.isActive, true))
    .orderBy(desc(jobsTable.firstSeen));

  const newToday = allActive.filter((j) => j.firstSeen >= today);
  const stillOpen = allActive.filter((j) => j.firstSeen < today);

  res.json({
    date: today.toISOString().split("T")[0],
    newToday: newToday.map(formatJob),
    stillOpen: stillOpen.map(formatJob),
    totalActive: allActive.length,
  });
});

export default router;
