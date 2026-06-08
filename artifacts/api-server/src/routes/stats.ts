import { Router, type IRouter } from "express";
import { eq, gte, sql, desc } from "drizzle-orm";
import { db, firmsTable, jobsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/stats", async (req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [counts] = await db
    .select({
      totalFirms: sql<number>`cast(count(distinct ${firmsTable.id}) as int)`,
      totalActiveJobs: sql<number>`cast(count(case when ${jobsTable.isActive} = true then 1 end) as int)`,
      newJobsToday: sql<number>`cast(count(case when ${jobsTable.isActive} = true and ${jobsTable.firstSeen} >= ${today} then 1 end) as int)`,
    })
    .from(firmsTable)
    .leftJoin(jobsTable, eq(jobsTable.firmId, firmsTable.id));

  const firmsScannedTodayResult = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(firmsTable)
    .where(gte(firmsTable.lastChecked, today));

  const firmsByAts = await db
    .select({
      atsType: firmsTable.atsType,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(firmsTable)
    .groupBy(firmsTable.atsType)
    .orderBy(desc(sql<number>`count(*)`));

  const recentJobs = await db
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
      firstSeen: jobsTable.firstSeen,
      lastSeen: jobsTable.lastSeen,
    })
    .from(jobsTable)
    .innerJoin(firmsTable, eq(jobsTable.firmId, firmsTable.id))
    .where(eq(jobsTable.isActive, true))
    .orderBy(desc(jobsTable.firstSeen))
    .limit(10);

  res.json({
    totalFirms: counts?.totalFirms ?? 0,
    totalActiveJobs: counts?.totalActiveJobs ?? 0,
    newJobsToday: counts?.newJobsToday ?? 0,
    firmsScannedToday: firmsScannedTodayResult[0]?.count ?? 0,
    firmsByAts,
    recentJobs: recentJobs.map((j) => ({
      ...j,
      firstSeen: j.firstSeen.toISOString(),
      lastSeen: j.lastSeen.toISOString(),
    })),
  });
});

export default router;
