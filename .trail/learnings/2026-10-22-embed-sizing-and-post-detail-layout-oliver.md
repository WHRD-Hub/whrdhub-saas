---
title: Embed sizing and post/detail layout for cases and the inbox
author: Oliver
date: 2026-10-22
branch: reporting-overhaul
cost: { minutes: 3, tokens: 38137 }
touches:
  - components/reporting/listening/post-embed.tsx
  - lib/hashtags.ts
  - lib/listening-tags.ts
---

## Decided
- Embeds size themselves: PostView listens for the platform resize messages (Instagram MEASURE, X twttr.private.resize) from the iframe it owns, with taller fallbacks. Facebook sends none.
- Case page and inbox put the post in a 32-34rem column with a detail rail beside it; inbox actions live in a sticky header row; the "found online" banner is now a header chip with a tooltip.

## Watch out
- Client components must import hashtags from lib/hashtags.ts, not lib/listening-tags.ts, which pulls in the server-only admin client.
- Heredocs through the Bash tool lose backslashes in node scripts; write scripts with the Write tool.
