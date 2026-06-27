import { logger } from "./logger";

export type ScrapedJob = {
  title: string;
  location: string | null;
  applyUrl: string | null;
  term: string | null;
  contentHash: string;
};

const US_STATE_CODES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);

const US_STATE_NAMES = new Set([
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut",
  "delaware","florida","georgia","hawaii","idaho","illinois","indiana","iowa",
  "kansas","kentucky","louisiana","maine","maryland","massachusetts","michigan",
  "minnesota","mississippi","missouri","montana","nebraska","nevada",
  "new hampshire","new jersey","new mexico","new york","north carolina",
  "north dakota","ohio","oklahoma","oregon","pennsylvania","rhode island",
  "south carolina","south dakota","tennessee","texas","utah","vermont",
  "virginia","washington","west virginia","wisconsin","wyoming",
  "district of columbia","washington dc","washington d.c.",
]);

// Major US cities — covers Workday postings that only include a city name (no state).
const US_CITIES = new Set([
  "new york","new york city","nyc","los angeles","chicago","houston","phoenix",
  "philadelphia","san antonio","san diego","dallas","san jose","austin",
  "jacksonville","fort worth","columbus","charlotte","indianapolis",
  "san francisco","seattle","denver","nashville","oklahoma city","el paso",
  "washington","boston","las vegas","memphis","louisville","portland",
  "milwaukee","albuquerque","tucson","fresno","mesa","sacramento",
  "kansas city","atlanta","omaha","colorado springs","raleigh","long beach",
  "virginia beach","minneapolis","tampa","new orleans","arlington","bakersfield",
  "honolulu","anaheim","aurora","santa ana","corpus christi","riverside",
  "lexington","stockton","pittsburgh","anchorage","saint paul","st. paul",
  "cincinnati","st. louis","st louis","greensboro","toledo","newark","orlando",
  "detroit","baltimore","cleveland","miami","richmond","buffalo",
  "salt lake city","rochester","birmingham","worcester","fort wayne",
  "madison","knoxville","grand rapids","des moines","shreveport","tulsa",
  "hartford","providence","spokane","baton rouge","st. petersburg",
  "columbia","garland","laredo","scottsdale","glendale","irving","chesapeake",
  "fremont","jersey city","norfolk","chula vista","chandler","henderson",
  "durham","lubbock","boise","plano","modesto","hialeah","tacoma",
  "fort lauderdale","moreno valley","fontana","montgomery","little rock",
  "akron","stamford","tempe","peoria","pasadena","irvine","santa clara",
  "sunnyvale","hayward","roseville","elk grove","corona","pomona",
  "torrance","bridgeport","paterson","macon","waco","dayton","eugene",
  "savannah","springfield","syracuse","albany","yonkers","fayetteville",
  "worcester","oxnard","joliet","rockford","naperville","providence",
  "chattanooga","fort collins","cape coral","huntsville","sioux falls",
  "santa rosa","rancho cucamonga","ontario","glendale","garden grove",
  "oceanside","brownsville","east los angeles","peoria","pembroke pines",
  "elk grove","salem","cary","murfreesboro","newark","cedar rapids",
  "killeen","surprise","midland","thousand oaks","denton","columbia",
  "sterling heights","warren","west valley city","green bay","high point",
  "wichita","olathe","topeka","lowell","cambridge","ann arbor","flint",
  "lansing","charleston","richmond","wilmington","dover","annapolis",
  "trenton","concord","manchester","burlington","montpelier","helena",
  "bismarck","pierre","cheyenne","juneau","honolulu","baton rouge",
  // Metro area and region names common in Workday
  "silicon valley","bay area","greater new york","greater chicago",
  "twin cities","research triangle","dc metro","dmv",
  "south florida","north jersey","long island","northern virginia",
  "greater boston","greater atlanta","greater houston","greater dallas",
  "greater philadelphia","greater seattle","greater denver",
]);

export function isUsLocation(location: string | null): boolean {
  if (!location || location.trim() === "") return true; // unspecified → keep
  const loc = location.trim();
  if (/\bremote\b/i.test(loc)) return true;
  if (/\bunited states\b|\bU\.?S\.?A\.?\b/i.test(loc)) return true;
  if (/multiple.locations|various|nationwide/i.test(loc)) return true;

  // 2-letter state code anywhere: "New York, NY" or "NY, US"
  const stateMatch = loc.match(/\b([A-Z]{2})\b/g);
  if (stateMatch?.some((code) => US_STATE_CODES.has(code))) return true;

  // Check each comma/semicolon/pipe-separated segment
  const segments = loc.split(/[;|,]+/).map((s) => s.trim()).filter(Boolean);
  for (const s of segments) {
    // Full state name
    if (US_STATE_NAMES.has(s.toLowerCase())) return true;
    // Known US city (covers Workday bare-city format like "Chicago")
    if (US_CITIES.has(s.toLowerCase())) return true;
  }
  // Everything else (foreign cities, country names, etc.) — reject
  return false;
}

export type AtsType = "greenhouse" | "lever" | "workday" | "ashby" | "smartrecruiters" | "icims" | "jobvite" | "custom" | "unknown";

const INTERN_WORD_PATTERNS = [
  /\bintern(ship)?\b/i,
  /\bco[-\s]?op\b/i,
  /\bpraktikum\b/i,
  /\bsummer\s+20\d\d\b/i,
  /\bwinter\s+20\d\d\b/i,
  /\bfall\s+20\d\d\b/i,
  /\bspring\s+20\d\d\b/i,
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
  const isMatch = INTERN_WORD_PATTERNS.some((re) => re.test(title));
  const lower = title.toLowerCase();
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

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

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
      .filter((j) => isInternship(j.title) && isUsLocation(j.location?.name ?? null))
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
      .filter((j) => isInternship(j.text) && isUsLocation(j.categories?.location ?? null))
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

// Common board name fallbacks to try when the stored URL has no board path.
const WORKDAY_BOARD_FALLBACKS = [
  "External", "Campus", "Careers", "EarlyCareers", "CampusCareers",
  "Early_Careers", "ExternalCareers", "US_Careers",
];

async function workdayFetchPage(
  apiUrl: string,
  offset: number,
): Promise<WorkdayApiResponse> {
  const resp = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": FETCH_HEADERS["User-Agent"],
    },
    // Empty searchText = all jobs; we filter by title client-side.
    // This avoids HTTP 400s that some Workday tenants throw for keyword searches.
    body: JSON.stringify({ limit: 20, offset, searchText: "", appliedFacets: {} }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json() as Promise<WorkdayApiResponse>;
}

async function probeWorkdayBoard(baseHost: string, subdomain: string, board: string): Promise<boolean> {
  try {
    const apiUrl = `https://${baseHost}/wday/cxs/${subdomain}/${board}/jobs`;
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": FETCH_HEADERS["User-Agent"] },
      body: JSON.stringify({ limit: 1, offset: 0, searchText: "", appliedFacets: {} }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return false;
    const data = await resp.json() as WorkdayApiResponse;
    return typeof data.total === "number";
  } catch {
    return false;
  }
}

async function resolveWorkdayBoard(baseHost: string, subdomain: string, boardFromUrl: string | null): Promise<string | null> {
  // 1. Board from stored URL — trust it unconditionally.
  //    It was validated during ATS detection; probing again wastes time and
  //    risks rate-limiting from concurrent batch scrapes.
  if (boardFromUrl) return boardFromUrl;

  // 2. Try common board name fallbacks + subdomain-based patterns
  const fallbacks = [
    ...WORKDAY_BOARD_FALLBACKS,
    subdomain,
    `${subdomain}Campus`,
    `${subdomain}Careers`,
    `US${subdomain.charAt(0).toUpperCase()}${subdomain.slice(1)}`,
  ];

  for (const board of fallbacks) {
    if (await probeWorkdayBoard(baseHost, subdomain, board)) return board;
  }

  return null;
}

export async function scrapeWorkday(atsUrl: string): Promise<ScrapedJob[]> {
  const parsed = new URL(atsUrl);
  const subdomain = parsed.hostname.split(".")[0]!;
  const baseHost = parsed.hostname;
  const pathParts = parsed.pathname.split("/").filter(Boolean);
  const boardFromUrl = pathParts[0] ?? null;

  const board = await resolveWorkdayBoard(baseHost, subdomain, boardFromUrl);
  if (!board) {
    logger.warn({ atsUrl }, "Workday: no valid board found, skipping");
    return [];
  }

  const apiUrl = `https://${baseHost}/wday/cxs/${subdomain}/${board}/jobs`;
  const seen = new Map<string, ScrapedJob>();

  try {
    const LIMIT = 20;
    const first = await workdayFetchPage(apiUrl, 0);
    const postings = first.jobPostings ?? [];
    const total = first.total ?? postings.length;
    const pages = Math.ceil(total / LIMIT);
    // Cap at 10 pages (200 jobs) — enough for any CPA firm board
    for (let p = 1; p < Math.min(pages, 10); p++) {
      postings.push(...((await workdayFetchPage(apiUrl, p * LIMIT)).jobPostings ?? []));
    }
    for (const j of postings) {
      if (!isInternship(j.title) || !isUsLocation(j.locationsText ?? null)) continue;
      const hash = simpleHash(`workday:${baseHost}:${j.title}:${j.locationsText ?? ""}`);
      if (!seen.has(hash)) {
        seen.set(hash, {
          title: j.title,
          location: j.locationsText ?? null,
          applyUrl: j.externalPath ? `https://${baseHost}${j.externalPath}` : null,
          term: detectTerm(j.title),
          contentHash: hash,
        });
      }
    }
  } catch (err) {
    logger.warn({ err, atsUrl, board }, "Workday scrape failed");
  }

  return [...seen.values()];
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
      .filter((j) => isInternship(j.title) && isUsLocation(j.locationName ?? null))
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
      .filter((j) => {
        const loc = [j.location?.city, j.location?.region].filter(Boolean).join(", ") || null;
        return isInternship(j.name) && isUsLocation(loc);
      })
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

/** Extract slug candidates from a careers URL to probe ATS APIs. */
function slugCandidates(careersUrl: string): string[] {
  try {
    const host = new URL(careersUrl).hostname.replace(/^www\./, "");
    const base = host.split(".")[0]!; // e.g. "marcumllp" from "marcumllp.com"
    // Remove common suffixes like "llp", "cpa", "co", "inc" to get a cleaner slug
    const stripped = base.replace(/(?:llp|cpa|cpas|inc|co|grp|group)$/i, "").replace(/-+$/, "");
    const candidates = new Set([base, stripped].filter(Boolean));
    return [...candidates];
  } catch {
    return [];
  }
}

/**
 * Probe Workday — tries common tenant numbers.
 * Workday returns 406 (not 404) for existing tenants that reject our UA,
 * so we accept any non-404/non-DNS-error response as "host exists".
 * We then confirm by hitting the jobs JSON API with common board names.
 */
async function probeWorkday(slug: string): Promise<string | null> {
  const tenants = [1, 3, 5, 12, 2, 4];
  const commonBoards = ["External", "Campus", "Careers", slug, `${slug}Campus`, `${slug}Careers`];

  for (const n of tenants) {
    const host = `${slug}.wd${n}.myworkdayjobs.com`;
    let hostExists = false;

    // Step 1: check if the Workday tenant exists (406 = exists but rejected UA)
    try {
      const r = await fetch(`https://${host}/`, {
        headers: { "User-Agent": FETCH_HEADERS["User-Agent"] },
        redirect: "follow",
        signal: AbortSignal.timeout(6000),
      });
      // 406 means Workday exists; 200/3xx also OK; only 404 means absent
      if (r.status !== 404) hostExists = true;
      // If we got a proper redirect to a board URL, return it directly
      if (r.ok && r.url.includes("myworkdayjobs.com") && r.url !== `https://${host}/`) {
        return r.url;
      }
    } catch { /* DNS fail = host doesn't exist, try next tenant */ }

    if (!hostExists) continue;

    // Step 2: find the board name by trying the JSON API with common names
    for (const board of commonBoards) {
      try {
        const apiUrl = `https://${host}/wday/cxs/${slug}/${board}/jobs`;
        const r = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": FETCH_HEADERS["User-Agent"] },
          body: JSON.stringify({ limit: 1, offset: 0, searchText: "", appliedFacets: {} }),
          signal: AbortSignal.timeout(6000),
        });
        if (r.ok) {
          const data = await r.json() as { total?: number };
          if (typeof data.total === "number") {
            return `https://${host}/${board}`;
          }
        }
      } catch { /* try next board */ }
    }

    // Tenant exists but we couldn't identify the board — store base host so scraper can try
    return `https://${host}/`;
  }
  return null;
}

/** Probe Greenhouse API — returns atsUrl if slug exists, null otherwise. */
async function probeGreenhouse(slug: string): Promise<string | null> {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=false`;
    const r = await fetch(url, { headers: { "User-Agent": FETCH_HEADERS["User-Agent"] }, signal: AbortSignal.timeout(6000) });
    if (r.ok) return `https://boards.greenhouse.io/${slug}`;
  } catch { /* not greenhouse */ }
  return null;
}

/** Probe Lever API — returns atsUrl if slug exists, null otherwise. */
async function probeLever(slug: string): Promise<string | null> {
  try {
    const url = `https://api.lever.co/v0/postings/${slug}?mode=json&limit=1`;
    const r = await fetch(url, { headers: { "User-Agent": FETCH_HEADERS["User-Agent"] }, signal: AbortSignal.timeout(6000) });
    if (r.ok) return `https://jobs.lever.co/${slug}`;
  } catch { /* not lever */ }
  return null;
}

/** Probe Ashby GraphQL — returns atsUrl if slug exists, null otherwise. */
async function probeAshby(slug: string): Promise<string | null> {
  try {
    const r = await fetch("https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": FETCH_HEADERS["User-Agent"] },
      body: JSON.stringify({
        operationName: "ApiJobBoardWithTeams",
        variables: { organizationHostedJobsPageName: slug },
        query: `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) { jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) { id } }`,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const data = await r.json() as { data?: { jobBoard?: { id?: string } | null } };
      if (data.data?.jobBoard?.id) return `https://jobs.ashbyhq.com/${slug}`;
    }
  } catch { /* not ashby */ }
  return null;
}

export async function detectAts(careersUrl: string): Promise<{ atsType: AtsType; atsUrl: string | null }> {
  // ── Step 1: follow redirects and scan the HTML ──────────────────────────────
  let finalUrl = careersUrl;
  let html = "";
  try {
    const resp = await fetch(careersUrl, {
      method: "GET",
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    finalUrl = resp.url;

    // Check final URL after redirects
    const fromFinal = classifyAtsUrl(finalUrl);
    if (fromFinal.atsType !== "custom" && fromFinal.atsType !== "unknown") return fromFinal;

    html = await resp.text();

    // Scan href/src/action attributes
    const attrPattern = /(?:href|src|action|data-src)=["']([^"']{10,})["']/gi;
    let m: RegExpExecArray | null;
    while ((m = attrPattern.exec(html)) !== null) {
      const c = classifyAtsUrl(m[1]);
      if (c.atsType !== "custom" && c.atsType !== "unknown") return c;
    }

    // Scan bare ATS URLs in script blobs / JSON
    const barePattern = /https?:\/\/[^\s"'<>]{10,}/g;
    while ((m = barePattern.exec(html)) !== null) {
      const c = classifyAtsUrl(m[0]);
      if (c.atsType !== "custom" && c.atsType !== "unknown") return c;
    }
  } catch {
    // Page unreachable — still try API probing below
  }

  // ── Step 2: probe ATS APIs with domain slug candidates ───────────────────────
  const slugs = slugCandidates(careersUrl);
  for (const slug of slugs) {
    // Run all probes in parallel for speed
    const [ghUrl, lvUrl, ashbyUrl, wdUrl] = await Promise.all([
      probeGreenhouse(slug),
      probeLever(slug),
      probeAshby(slug),
      probeWorkday(slug),
    ]);
    if (ghUrl) return { atsType: "greenhouse", atsUrl: ghUrl };
    if (lvUrl) return { atsType: "lever", atsUrl: lvUrl };
    if (ashbyUrl) return { atsType: "ashby", atsUrl: ashbyUrl };
    if (wdUrl) return { atsType: "workday", atsUrl: wdUrl };
  }

  logger.warn({ careersUrl }, "ATS detection: no provider found");
  return { atsType: finalUrl !== careersUrl ? "custom" : "unknown", atsUrl: finalUrl !== careersUrl ? finalUrl : null };
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
