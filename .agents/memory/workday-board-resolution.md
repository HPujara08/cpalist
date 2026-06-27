---
name: Workday board resolution
description: Trust the stored boardFromUrl without re-probing; probing under concurrent batch load causes silent failures and 0 jobs returned.
---

## Rule
In `resolveWorkdayBoard`, if `boardFromUrl` is set (came from the stored `ats_url`), return it immediately without probing.

**Why:** During batch scrapes with 21 concurrent firms, the extra probe call gets rate-limited or times out, causing the function to fall through to fallback boards that also fail, ultimately returning `null` — even when the real board name is correct. This silently produced 0 Workday jobs across all 478 firms for weeks.

**How to apply:** Only probe when `boardFromUrl` is null (base URL stored with no path). For null URLs, try common board names: `External`, `Campus`, `Careers`, `EarlyCareers`, `CampusCareers`, `Early_Careers`, subdomain variants.

## Workday scraping notes
- Use `searchText: ""` (empty) with client-side `isInternship()` filtering — avoids HTTP 400 errors that some Workday tenants throw for keyword searches like "intern"
- `limit: 20` per page (not 50) is safer across tenants
- Base URLs (no board path) stored during detection mean the firm's board name couldn't be guessed from common patterns — the Big 4 (Deloitte, PwC, EY) fall into this category
