---
title: "Documents are served by the site itself, so a missing file shows a visitor page instead of the storage error"
author: Oliver
date: 2026-11-12
branch: fix/files-friendly-error
cost: { minutes: 3, tokens: 26280 }
id: l-2e17a0b5
scope: repo
status: active
src: agent
touches:
  - lib/storage/neon.ts
  - "app/files/[...path]/route.ts"
  - next.config.ts
---

## Decided
/files is now served by the site (route handler) instead of a rewrite to the storage service. Missing files show an HTML page that says the file is not available yet and links back to publications, with status 404 and no caching. Other storage failures show a separate page with status 503. Only the public buckets are served; private buckets and unknown bucket names get the same 404 page.

In the code:
- app/files/[...path]/route.ts: GET and HEAD, the page builder, and the headers (noindex, no AI training, one-hour browser and one-day CDN cache for files).
- lib/storage/neon.ts: getPublicObject() returns null for a missing key instead of throwing.
- next.config.ts: the /files rewrite and its headers are removed; the handler sets them.

## Tried and ruled out
- Keeping the rewrite and hoping storage returns a friendlier error: it returns raw XML, which is what visitors saw.
- Setting cache headers in next.config for /files and also in the handler: the handler is now the only place they are set.

## Watch out
- Until the 53 publications are uploaded, every document link shows the "not available yet" page. That is expected, not a bug.
- Redirects from a path with a trailing slash (for example /files/publications/) return 308 and do not reach the handler.
- Range requests are not supported, so the browser's PDF viewer downloads the whole file.
