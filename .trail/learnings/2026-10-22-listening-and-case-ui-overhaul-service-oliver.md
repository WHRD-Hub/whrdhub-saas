---
title: "Listening and case UI overhaul, service ordering, mentor verification"
author: Oliver
date: 2026-10-22
branch: reporting-overhaul
cost: { minutes: 22, tokens: 296361 }
touches:
  - supabase/022_declined_tags.sql
  - components/reporting/listening/post-embed.tsx
  - components/reporting/listening/tag-suggestions.tsx
  - components/reporting/listening/types.ts
  - components/reporting/listening/inbox.tsx
  - app/hub/reporting/listening/page.tsx
  - "app/hub/reporting/reports/[id]/page.tsx"
  - components/dashboard/dashboard-shell.tsx
  - components/ui/filter-bar.tsx
  - components/reporting/listening/listening-view.tsx
---

## Decided
- Post display: one PostView per post, Text or Post with photos (platform embed iframe), remembered in localStorage (whrd.showPostEmbeds). Embeds are the platforms' own iframes, never scraped, and only load while the photos view is on.
- Services: lib/service-match.ts orders services by incident type (and by requested support for reported cases). Reported cases get the top matches picked for the team to confirm; online-listening cases get nothing picked, just an ordered list with star marks. This is the convention.
- Mentor verification follows Sauti Salama: private bucket mentor-documents, one mentor_verifications row (status, documents jsonb, review notes), per-document and overall review by Hub admins at /hub/mentors, mentor notified on decision. Documents are optional at onboarding and in Profile > Verification; the femtorship page shows a banner that can be closed but returns each visit until ID and accreditation are in.
- Corners are 30 percent tighter through the radius tokens in app/globals.css.

## Watch out
- Migrations 022 (declined tags) and 023 (mentor verification and bucket) must be applied; the code tolerates them missing but uploads and declines then fail with a clear message.
- This repo's source files use CRLF; scripted edits must split on \r\n or anchors silently miss.
- The hub shell goes wide and tight (dense) only on /hub/reporting/listening and /hub/reporting/reports/[id].
