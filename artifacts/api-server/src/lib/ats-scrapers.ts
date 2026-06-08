import { logger } from "./logger";

export type ScrapedJob = {
  title: string;
  location: string | null;
  applyUrl: string | null;
  term: string | null;
  contentHash: string;
};

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

function isInternship(title: string): boolean {
  const lower = title.toLowerCase();
  const isMatch = INTERN_KEYWORDS.some((kw) => lower.includes(kw));
  const isExcluded = EXCLUDE_KEYWORDS.some((kw) => lower.includes(kw));
  return isMatch && !isExcluded;
}

function detectTerm(title: string): string | null {
  const lower = title.toLowerCase();
  if (lower.includes("summer")) return "Summer";
  if (lower.includes("winter")) return "Winter";
  if (lower.includes("fall") || lower.includes("autumn")) return "Fall";
  if (lower.includes("spring")) return "Spring";
  return null;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

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

export async function scrapeWorkday(subdomain: string, tenant: string): Promise<ScrapedJob[]> {
  try {
    const url = `https://${subdomain}.wd5.myworkdayjobs.com/wday/cxs/${subdomain}/${tenant}/jobs`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "CPA-Intern-Radar/1.0",
      },
      body: JSON.stringify({ limit: 100, offset: 0, searchText: "intern" }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { jobPostings?: Array<{ title: string; locationsText?: string; externalPath?: string }> };
    const postings = data.jobPostings ?? [];
    return postings
      .filter((j) => isInternship(j.title))
      .map((j) => ({
        title: j.title,
        location: j.locationsText ?? null,
        applyUrl: j.externalPath
          ? `https://${subdomain}.wd5.myworkdayjobs.com${j.externalPath}`
          : null,
        term: detectTerm(j.title),
        contentHash: simpleHash(`workday:${subdomain}:${j.title}:${j.locationsText ?? ""}`),
      }));
  } catch (err) {
    logger.warn({ err, subdomain }, "Workday scrape failed");
    return [];
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

export type AtsType = "greenhouse" | "lever" | "workday" | "ashby" | "smartrecruiters" | "icims" | "jobvite" | "custom" | "unknown";

export async function detectAts(careersUrl: string): Promise<{ atsType: AtsType; atsUrl: string | null }> {
  try {
    const res = await fetch(careersUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "CPA-Intern-Radar/1.0" },
    });
    const finalUrl = res.url;
    return classifyAtsUrl(finalUrl);
  } catch {
    try {
      const res = await fetch(careersUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": "CPA-Intern-Radar/1.0" },
      });
      return classifyAtsUrl(res.url);
    } catch (err) {
      logger.warn({ err, careersUrl }, "ATS detection failed");
      return { atsType: "unknown", atsUrl: null };
    }
  }
}

function classifyAtsUrl(url: string): { atsType: AtsType; atsUrl: string | null } {
  if (url.includes("myworkdayjobs.com")) return { atsType: "workday", atsUrl: url };
  if (url.includes("greenhouse.io")) return { atsType: "greenhouse", atsUrl: url };
  if (url.includes("lever.co")) return { atsType: "lever", atsUrl: url };
  if (url.includes("icims.com")) return { atsType: "icims", atsUrl: url };
  if (url.includes("smartrecruiters.com")) return { atsType: "smartrecruiters", atsUrl: url };
  if (url.includes("ashbyhq.com")) return { atsType: "ashby", atsUrl: url };
  if (url.includes("jobvite.com")) return { atsType: "jobvite", atsUrl: url };
  return { atsType: "custom", atsUrl: url };
}

export function extractAtsSlug(atsType: AtsType, atsUrl: string | null): { subdomain?: string; slug?: string } {
  if (!atsUrl) return {};
  try {
    const url = new URL(atsUrl);
    if (atsType === "greenhouse") {
      const match = url.pathname.match(/\/boards\/([^/]+)/);
      return { slug: match?.[1] };
    }
    if (atsType === "lever") {
      const match = url.pathname.match(/\/postings\/([^/]+)/);
      return { slug: match?.[1] ?? url.hostname.split(".")[0] };
    }
    if (atsType === "workday") {
      const subdomain = url.hostname.split(".")[0];
      const tenant = url.pathname.split("/").filter(Boolean)[2] ?? "External";
      return { subdomain, slug: tenant };
    }
    if (atsType === "ashby") {
      const match = url.pathname.match(/\/([^/]+)$/);
      return { slug: match?.[1] };
    }
    if (atsType === "smartrecruiters") {
      const match = url.pathname.match(/\/([^/]+)$/);
      return { slug: match?.[1] ?? url.hostname.split(".")[0] };
    }
    return {};
  } catch {
    return {};
  }
}

export async function scrapeByAts(atsType: AtsType, atsUrl: string | null): Promise<ScrapedJob[]> {
  if (!atsUrl) return [];
  const { subdomain, slug } = extractAtsSlug(atsType, atsUrl);
  if (atsType === "greenhouse" && slug) return scrapeGreenhouse(slug);
  if (atsType === "lever" && slug) return scrapeLever(slug);
  if (atsType === "workday" && subdomain && slug) return scrapeWorkday(subdomain, slug);
  if (atsType === "ashby" && slug) return scrapeAshby(slug);
  if (atsType === "smartrecruiters" && slug) return scrapeSmartRecruiters(slug);
  return [];
}
