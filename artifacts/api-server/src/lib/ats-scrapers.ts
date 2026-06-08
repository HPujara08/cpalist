import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { logger } from "./logger";

function findChromiumExecutable(): string | undefined {
  try {
    const p = execSync("which chromium 2>/dev/null || which chromium-browser 2>/dev/null", { encoding: "utf-8" }).trim();
    return p || undefined;
  } catch {
    return undefined;
  }
}

const CHROMIUM_EXECUTABLE = findChromiumExecutable();

export type ScrapedJob = {
  title: string;
  location: string | null;
  applyUrl: string | null;
  term: string | null;
  contentHash: string;
};

export type AtsType = "greenhouse" | "lever" | "workday" | "ashby" | "smartrecruiters" | "icims" | "jobvite" | "custom" | "unknown";

const INTERN_KEYWORDS = [
  "intern",
  "internship",
  "co-op",
  "coop",
  "summer 2025",
  "summer 2026",
  "summer 2027",
  "winter 2025",
  "winter 2026",
  "winter 2027",
  "fall 2025",
  "fall 2026",
  "fall 2027",
];

const EXCLUDE_KEYWORDS = [
  "experienced",
  "senior",
  "manager",
  "director",
  "partner",
  "principal",
];

export function isInternship(title: string): boolean {
  const lower = title.toLowerCase();
  const isMatch = INTERN_KEYWORDS.some((kw) => lower.includes(kw));
  const isExcluded = EXCLUDE_KEYWORDS.some((kw) => lower.includes(kw));
  return isMatch && !isExcluded;
}

export function detectTerm(title: string): string | null {
  const lower = title.toLowerCase();
  if (lower.includes("summer")) return "summer";
  if (lower.includes("winter")) return "winter";
  if (lower.includes("fall") || lower.includes("autumn")) return "fall";
  if (lower.includes("spring")) return "spring";
  return null;
}

export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function classifyAtsUrl(url: string): { atsType: AtsType; atsUrl: string | null } {
  if (url.includes("myworkdayjobs.com")) return { atsType: "workday", atsUrl: url };
  if (url.includes("greenhouse.io")) return { atsType: "greenhouse", atsUrl: url };
  if (url.includes("lever.co")) return { atsType: "lever", atsUrl: url };
  if (url.includes("icims.com")) return { atsType: "icims", atsUrl: url };
  if (url.includes("smartrecruiters.com")) return { atsType: "smartrecruiters", atsUrl: url };
  if (url.includes("ashbyhq.com")) return { atsType: "ashby", atsUrl: url };
  if (url.includes("jobvite.com")) return { atsType: "jobvite", atsUrl: url };
  return { atsType: "custom", atsUrl: url };
}

const PLAYWRIGHT_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-extensions",
];

export async function scrapeGreenhouse(companySlug: string): Promise<ScrapedJob[]> {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs?content=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": "CPA-Intern-Radar/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { jobs?: Array<{ title: string; location?: { name?: string }; absolute_url?: string }> };
    const jobs = data.jobs ?? [];
    return jobs
      .filter((j) => isInternship(j.title))
      .map((j) => ({
        title: j.title,
        location: j.location?.name ?? null,
        applyUrl: j.absolute_url ?? null,
        term: detectTerm(j.title),
        contentHash: simpleHash(`greenhouse:${companySlug}:${j.title}:${j.location?.name ?? ""}`),
      }));
  } catch (err) {
    logger.warn({ err, companySlug }, "Greenhouse scrape failed");
    return [];
  }
}

export async function scrapeLever(companySlug: string): Promise<ScrapedJob[]> {
  try {
    const url = `https://api.lever.co/v0/postings/${companySlug}?mode=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "CPA-Intern-Radar/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const jobs = await res.json() as Array<{ text: string; categories?: { location?: string; commitment?: string }; hostedUrl?: string }>;
    return jobs
      .filter((j) => isInternship(j.text))
      .map((j) => ({
        title: j.text,
        location: j.categories?.location ?? null,
        applyUrl: j.hostedUrl ?? null,
        term: detectTerm(j.text),
        contentHash: simpleHash(`lever:${companySlug}:${j.text}:${j.categories?.location ?? ""}`),
      }));
  } catch (err) {
    logger.warn({ err, companySlug }, "Lever scrape failed");
    return [];
  }
}

type WorkdayPosting = {
  title: string;
  locationsText?: string;
  externalPath?: string;
  total?: number;
};

type WorkdayApiResponse = {
  jobPostings?: WorkdayPosting[];
  total?: number;
};

export async function scrapeWorkday(atsUrl: string): Promise<ScrapedJob[]> {
  const parsed = new URL(atsUrl);
  const subdomain = parsed.hostname.split(".")[0]!;
  const baseHost = parsed.hostname;
  const pathParts = parsed.pathname.split("/").filter(Boolean);
  const jobBoard = pathParts[0] ?? "External";
  const apiPath = `/wday/cxs/${subdomain}/${jobBoard}/jobs`;

  const browser = await chromium.launch({ headless: true, args: PLAYWRIGHT_ARGS, executablePath: CHROMIUM_EXECUTABLE });
  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto(atsUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    const allPostings: WorkdayPosting[] = [];
    const LIMIT = 50;

    const fetchPage = async (offset: number): Promise<WorkdayApiResponse> => {
      return page.evaluate(
        async ({ path, host, limit, offset: off }) => {
          const res = await fetch(`https://${host}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ limit, offset: off, searchText: "intern", appliedFacets: {} }),
          });
          return res.json();
        },
        { path: apiPath, host: baseHost, limit: LIMIT, offset }
      ) as Promise<WorkdayApiResponse>;
    };

    const first = await fetchPage(0);
    const postings = first.jobPostings ?? [];
    allPostings.push(...postings);

    const total = first.total ?? postings.length;
    const pages = Math.ceil(total / LIMIT);
    for (let p = 1; p < Math.min(pages, 5); p++) {
      const more = await fetchPage(p * LIMIT);
      allPostings.push(...(more.jobPostings ?? []));
    }

    return allPostings
      .filter((j) => isInternship(j.title))
      .map((j) => ({
        title: j.title,
        location: j.locationsText ?? null,
        applyUrl: j.externalPath ? `https://${baseHost}${j.externalPath}` : null,
        term: detectTerm(j.title),
        contentHash: simpleHash(`workday:${baseHost}:${j.title}:${j.locationsText ?? ""}`),
      }));
  } catch (err) {
    logger.warn({ err, atsUrl }, "Workday Playwright scrape failed");
    return [];
  } finally {
    await browser.close();
  }
}

export async function scrapeAshby(companySlug: string): Promise<ScrapedJob[]> {
  try {
    const url = `https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "CPA-Intern-Radar/1.0",
      },
      body: JSON.stringify({
        operationName: "ApiJobBoardWithTeams",
        variables: { organizationHostedJobsPageName: companySlug },
        query: `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
          jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
            jobPostings { id title locationName jobUrl }
          }
        }`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { data?: { jobBoard?: { jobPostings?: Array<{ title: string; locationName?: string; jobUrl?: string }> } } };
    const postings = data.data?.jobBoard?.jobPostings ?? [];
    return postings
      .filter((j) => isInternship(j.title))
      .map((j) => ({
        title: j.title,
        location: j.locationName ?? null,
        applyUrl: j.jobUrl ?? null,
        term: detectTerm(j.title),
        contentHash: simpleHash(`ashby:${companySlug}:${j.title}:${j.locationName ?? ""}`),
      }));
  } catch (err) {
    logger.warn({ err, companySlug }, "Ashby scrape failed");
    return [];
  }
}

export async function scrapeSmartRecruiters(companyId: string): Promise<ScrapedJob[]> {
  try {
    const url = `https://api.smartrecruiters.com/v1/companies/${companyId}/postings?q=intern&limit=100`;
    const res = await fetch(url, {
      headers: { "User-Agent": "CPA-Intern-Radar/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { content?: Array<{ name: string; location?: { city?: string; region?: string }; ref?: string }> };
    const postings = data.content ?? [];
    return postings
      .filter((j) => isInternship(j.name))
      .map((j) => ({
        title: j.name,
        location: [j.location?.city, j.location?.region].filter(Boolean).join(", ") || null,
        applyUrl: j.ref ?? null,
        term: detectTerm(j.name),
        contentHash: simpleHash(`smartrecruiters:${companyId}:${j.name}:${j.location?.city ?? ""}`),
      }));
  } catch (err) {
    logger.warn({ err, companyId }, "SmartRecruiters scrape failed");
    return [];
  }
}

export async function detectAts(careersUrl: string): Promise<{ atsType: AtsType; atsUrl: string | null }> {
  const browser = await chromium.launch({ headless: true, args: PLAYWRIGHT_ARGS, executablePath: CHROMIUM_EXECUTABLE });
  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    const requestedUrls: string[] = [];
    page.on("request", (req) => {
      requestedUrls.push(req.url());
    });

    try {
      await page.goto(careersUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(3000);
    } catch {
      // proceed with whatever we got
    }

    const finalUrl = page.url();
    const fromFinal = classifyAtsUrl(finalUrl);
    if (fromFinal.atsType !== "custom" && fromFinal.atsType !== "unknown") {
      return fromFinal;
    }

    for (const url of requestedUrls) {
      const c = classifyAtsUrl(url);
      if (c.atsType !== "custom" && c.atsType !== "unknown") {
        return c;
      }
    }

    const iframeSrcs = await page
      .$$eval("iframe[src]", (els) => els.map((e) => e.getAttribute("src") ?? ""))
      .catch(() => [] as string[]);
    for (const src of iframeSrcs) {
      const c = classifyAtsUrl(src);
      if (c.atsType !== "custom" && c.atsType !== "unknown") {
        return c;
      }
    }

    const links = await page
      .$$eval("a[href]", (els) => els.map((e) => e.getAttribute("href") ?? ""))
      .catch(() => [] as string[]);
    for (const link of links) {
      const c = classifyAtsUrl(link);
      if (c.atsType !== "custom" && c.atsType !== "unknown") {
        return c;
      }
    }

    return { atsType: "custom", atsUrl: finalUrl };
  } catch (err) {
    logger.warn({ err, careersUrl }, "Playwright ATS detection failed");
    return { atsType: "unknown", atsUrl: null };
  } finally {
    await browser.close();
  }
}

function extractPathSlug(atsUrl: string): string | null {
  try {
    const url = new URL(atsUrl);
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
}

export async function scrapeByAts(atsType: AtsType, atsUrl: string | null): Promise<ScrapedJob[]> {
  if (!atsUrl) return [];
  if (atsType === "greenhouse") {
    const slug = extractPathSlug(atsUrl);
    return slug ? scrapeGreenhouse(slug) : [];
  }
  if (atsType === "lever") {
    const slug = extractPathSlug(atsUrl);
    return slug ? scrapeLever(slug) : [];
  }
  if (atsType === "workday") return scrapeWorkday(atsUrl);
  if (atsType === "ashby") {
    const slug = extractPathSlug(atsUrl);
    return slug ? scrapeAshby(slug) : [];
  }
  if (atsType === "smartrecruiters") {
    const slug = extractPathSlug(atsUrl);
    return slug ? scrapeSmartRecruiters(slug) : [];
  }
  return [];
}
