---
name: Workday location format
description: Workday's locationsText field often contains just a city name with no state or country, which breaks strict US-only location filters.
---

## Rule
`isUsLocation` must check a `US_CITIES` set in addition to state codes/names, or bare city names like "Chicago", "Boston", "New York" will be silently rejected.

**Why:** Workday stores location as `locationsText` which for many firms is just the city: `"Chicago"`, `"Cleveland"`, `"San Francisco"`. The prior filter required a 2-letter state code or "United States" substring, so all these passed through the board API but got dropped client-side — producing 0 jobs from boards that had real intern postings.

**How to apply:** The `US_CITIES` set in `ats-scrapers.ts` contains 200+ major US cities and metro region names. Check each comma-separated segment against this set after checking state codes and state names.

## Location format examples seen from Workday
- `"Chicago"` — bare city, no state
- `"Columbus"` — ambiguous (Ohio? Georgia?)
- `"Washington, D.C. Metro (Bethesda)"` — matches "washington" in cities set
- `"Austin, Texas"` — matches state name "texas"
- `"Remote, United States"` — matches "remote" shortcut
