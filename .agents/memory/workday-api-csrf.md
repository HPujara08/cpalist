---
name: Workday CXS API CSRF requirement
description: Workday's internal job listing API requires a browser session — raw fetch returns 422
---

Workday job boards expose a JSON endpoint at `/wday/cxs/{subdomain}/{jobBoard}/jobs` (POST). This endpoint is NOT a public API — it requires CSRF tokens set by the browser session. Direct `fetch()` calls return HTTP 422.

**Fix:** Use Playwright's `page.evaluate()` to call the API from within the browser context (which already has session cookies/CSRF):

```typescript
await page.goto(atsUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

const result = await page.evaluate(
  async ({ path, host, limit, offset }) => {
    const res = await fetch(`https://${host}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ limit, offset, searchText: "intern", appliedFacets: {} }),
    });
    return res.json();
  },
  { path: apiPath, host: baseHost, limit: LIMIT, offset: 0 }
);
```

**URL structure:**
- Job board display: `https://{subdomain}.wd{N}.myworkdayjobs.com/{JobBoard}`
- API path: `/wday/cxs/{subdomain}/{JobBoard}/jobs`
- Apply URL per-job: `https://{baseHost}{externalPath}` (externalPath from API response)

**Important:** The instance number `wdN` (wd1, wd3, wd5, etc.) varies per firm — always preserve it from the stored `ats_url`, never hardcode `.wd5.`.

**Why:** Workday uses CSRF protection on their internal API. The browser-session approach bypasses this cleanly without needing to extract tokens manually.
