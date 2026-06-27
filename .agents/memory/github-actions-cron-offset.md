---
name: GitHub Actions cron at :00 offset
description: GitHub Actions scheduled workflows at exact :00 minutes are frequently skipped during high-load periods; offset by 5-10 minutes.
---

## Rule
Never schedule GitHub Actions workflows at `* * * * *` patterns where the minute is `0`. Offset by at least 5 minutes.

**Why:** GitHub docs warn that `:00` minute crons are high-contention (start of every hour is when thousands of workflows trigger simultaneously). The daily-digest.yml at `0 5 * * *` was silently skipped on multiple nights, causing missed newsletter sends.

**How to apply:**
- Hourly scrape: `2 * * * *` (runs at :02 each hour)
- Daily digest: `7 5 * * *` (runs at 05:07 UTC = ~12:07am EST)
- Match the in-process node-cron timezone explicitly: `{ timezone: "UTC" }` option to avoid container local-time surprises
