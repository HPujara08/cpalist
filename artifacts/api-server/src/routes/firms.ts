import { Router, type IRouter } from "express";
import { eq, sql, count, and, ilike } from "drizzle-orm";
import { db, firmsTable, jobsTable } from "@workspace/db";
import {
  ListFirmsQueryParams,
  CreateFirmBody,
  GetFirmParams,
  UpdateFirmParams,
  UpdateFirmBody,
  DetectFirmAtsParams,
} from "@workspace/api-zod";
import { detectAts } from "../lib/ats-scrapers";

const router: IRouter = Router();

router.get("/firms", async (req, res): Promise<void> => {
  const query = ListFirmsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.ats_type) {
    conditions.push(eq(firmsTable.atsType, query.data.ats_type));
  }
  if (query.data.search) {
    conditions.push(ilike(firmsTable.name, `%${query.data.search}%`));
  }

  const firms = await db
    .select({
      id: firmsTable.id,
      name: firmsTable.name,
      rank: firmsTable.rank,
      hqCity: firmsTable.hqCity,
      hqState: firmsTable.hqState,
      websiteUrl: firmsTable.websiteUrl,
      careersUrl: firmsTable.careersUrl,
      atsType: firmsTable.atsType,
      atsUrl: firmsTable.atsUrl,
      lastChecked: firmsTable.lastChecked,
      createdAt: firmsTable.createdAt,
      jobsCount: sql<number>`cast(count(${jobsTable.id}) as int)`,
    })
    .from(firmsTable)
    .leftJoin(
      jobsTable,
      and(eq(jobsTable.firmId, firmsTable.id), eq(jobsTable.isActive, true))
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(firmsTable.id)
    .orderBy(firmsTable.rank);

  res.json(
    firms.map((f) => ({
      ...f,
      lastChecked: f.lastChecked ? f.lastChecked.toISOString() : null,
      createdAt: f.createdAt.toISOString(),
      jobsCount: f.jobsCount ?? 0,
    }))
  );
});

router.post("/firms", async (req, res): Promise<void> => {
  const parsed = CreateFirmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [firm] = await db.insert(firmsTable).values(parsed.data).returning();
  res.status(201).json({
    ...firm,
    lastChecked: firm.lastChecked ? firm.lastChecked.toISOString() : null,
    createdAt: firm.createdAt.toISOString(),
    jobsCount: 0,
  });
});

router.get("/firms/:id", async (req, res): Promise<void> => {
  const params = GetFirmParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [firm] = await db
    .select({
      id: firmsTable.id,
      name: firmsTable.name,
      rank: firmsTable.rank,
      hqCity: firmsTable.hqCity,
      hqState: firmsTable.hqState,
      websiteUrl: firmsTable.websiteUrl,
      careersUrl: firmsTable.careersUrl,
      atsType: firmsTable.atsType,
      atsUrl: firmsTable.atsUrl,
      lastChecked: firmsTable.lastChecked,
      createdAt: firmsTable.createdAt,
      jobsCount: sql<number>`cast(count(${jobsTable.id}) as int)`,
    })
    .from(firmsTable)
    .leftJoin(
      jobsTable,
      and(eq(jobsTable.firmId, firmsTable.id), eq(jobsTable.isActive, true))
    )
    .where(eq(firmsTable.id, params.data.id))
    .groupBy(firmsTable.id);

  if (!firm) {
    res.status(404).json({ error: "Firm not found" });
    return;
  }

  res.json({
    ...firm,
    lastChecked: firm.lastChecked ? firm.lastChecked.toISOString() : null,
    createdAt: firm.createdAt.toISOString(),
    jobsCount: firm.jobsCount ?? 0,
  });
});

router.patch("/firms/:id", async (req, res): Promise<void> => {
  const params = UpdateFirmParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFirmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [firm] = await db
    .update(firmsTable)
    .set(parsed.data)
    .where(eq(firmsTable.id, params.data.id))
    .returning();

  if (!firm) {
    res.status(404).json({ error: "Firm not found" });
    return;
  }

  res.json({
    ...firm,
    lastChecked: firm.lastChecked ? firm.lastChecked.toISOString() : null,
    createdAt: firm.createdAt.toISOString(),
    jobsCount: 0,
  });
});

router.post("/firms/:id/detect-ats", async (req, res): Promise<void> => {
  const params = DetectFirmAtsParams.safeParse(req.params);
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

  req.log.info({ firmId: firm.id, careersUrl: firm.careersUrl }, "Detecting ATS");
  const { atsType, atsUrl } = await detectAts(firm.careersUrl);

  await db
    .update(firmsTable)
    .set({ atsType, atsUrl, lastChecked: new Date() })
    .where(eq(firmsTable.id, firm.id));

  res.json({
    firmId: firm.id,
    atsType,
    detectedUrl: atsUrl,
    success: true,
    message: `Detected ATS: ${atsType}`,
  });
});

export default router;
