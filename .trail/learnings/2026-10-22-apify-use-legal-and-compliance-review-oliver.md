---
title: "Apify use: legal and compliance review of social listening"
author: Oliver
date: 2026-10-22
branch: reporting-overhaul
cost: { minutes: 1, tokens: 45247 }
touches:
  - lib/social-fetch.ts
  - lib/listening-sources.ts
---

## Decided
- Apify is used only in lib/social-fetch.ts (apifyItems) for scheduled scans of watched Instagram/X/Facebook profiles and hashtags (lib/listening-sources.ts scanSources, max 15 sources, 10 posts each). Single-link lookups prefer Meta oEmbed (Instagram) and X's public oEmbed, with Apify only as an Instagram fallback.
- Review conclusion (not legal advice): main exposure is platform terms of service (Meta, X forbid scraping), not criminal law, since only public content is read with no login. Second exposure is Kenya Data Protection Act 2019: handles and post text are personal data, so ODPC registration, a DPIA, a legitimate-interests assessment, an Apify DPA and retention limits are needed.

## Tried and ruled out
- Nothing was changed in code; this was analysis only.

## Watch out
- Scraping on the same Meta app as the Facebook page integration (META_APP_ID) risks that app being reviewed or banned.
- The Political preset pack monitors political opinion (special-category data) and has a far weaker basis than the Usikimye GBV pack.
- detectBursts profiles accounts named in captures; keep it aimed at protecting targeted people.
- Never add logged-in sessions or cookies to scraping. Keep SOCIAL_PROVIDER=off as the kill switch.
