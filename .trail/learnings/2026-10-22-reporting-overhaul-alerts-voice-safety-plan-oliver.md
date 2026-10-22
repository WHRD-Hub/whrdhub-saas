---
title: "Reporting overhaul: alerts, voice, safety plan, map privacy, Jev triage"
author: Oliver
date: 2026-10-22
branch: reporting-overhaul
cost: { minutes: 67, tokens: 623329 }
touches:
  - supabase/tests/32_support_types_and_country.sql
  - app/actions/report-submit.ts
  - app/actions/report-update.ts
  - "app/hub/reporting/reports/[id]/page.tsx"
  - components/reporting/report-form.tsx
  - components/reporting/voice-input.tsx
  - lib/supabase/storage.ts
  - lib/use-speech-to-text.ts
  - app/actions/listening.ts
  - app/hub/reporting/listening/page.tsx
---

## Decided
- Exact report coordinates stay in the DB but are generalised server-side (lib/geo-privacy.ts, ~11 km grid) before any page or map; never send raw lat/lng to a client component.
- Incident types, risks, support types, countries and urgency colours each live in one file (lib/reporting-options.ts, lib/urgency.ts). Add to those, not to individual pages.
- lib/abuse-profiles.ts drives both the safety plan and which reports count as critical for alerts.
- Alerts (lib/alerts.ts) never carry report text, contact or location. Escalation re-raises unacknowledged critical reports via /api/cron/escalate-reports; opening the case as a triager acknowledges it.
- Jev (lib/decide.ts) is the only decision model; no OpenRouter fallback. Private reports go to Jev only when JEV_PRIVATE_REPORTS=on. Listening triage learns from actioned/dismissed results used as examples.
- Staff landing uses is_hub_admin or user_type admin only, not defender.

## Tried and ruled out
- Running the codebase-memory-mcp installer: blocked by the permission classifier, left for the user to run.
- Docker/psql for SQL tests: engine not running here, so supabase/tests/32_support_types_and_country.sql is written but never executed.
- vercel.json cron: skipped, a sub-daily cron breaks Hobby-plan deploys.
- The Jev key (same in this repo and Sauti) returns 401 from api.typesafe.ai; code falls back to keywords-only.

## Watch out
- Migrations 016 and 017 must be applied; code tolerates missing 017 columns for listening and voice notes, but alerts and push need it.
- Pre-existing access bug: sign-up sets user_type "defender" from client metadata and can_triage_reports/getReportingAccess treat defender as staff, so ordinary members may reach the reporting console. Not fixed, needs a decision.
- On Windows, big python/bash heredocs through the shell tool fail; write scripts to a file and run them. Files are CRLF.
